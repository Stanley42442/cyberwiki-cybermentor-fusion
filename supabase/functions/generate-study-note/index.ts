// supabase/functions/generate-study-note/index.ts
// Generates textbook-quality study note + extracts course topics automatically.
// Token budgets kept low to stay within Supabase 150s wall clock limit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

async function callGemma(key: string, prompt: string, systemText: string, maxTokens: number, temp: number) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: temp },
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemma ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const parts = d.candidates?.[0]?.content?.parts;
  if (!parts?.length) throw new Error('Empty response from Gemma');
  const answerPart = parts.find((p: Record<string, unknown>) => p.text && !p.thought) ?? parts[parts.length - 1];
  return answerPart?.text ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { courseTitle, courseCode, courseDescription, contributions, courseId } = await req.json();

    if (!contributions?.length) {
      return new Response(JSON.stringify({ error: 'No contributions provided' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Limit contribution text to avoid huge prompts
    const contribText = contributions
      .map((c: { title: string; content: string; type: string }, i: number) =>
        `[CONTRIBUTION ${i + 1}]\nTitle: ${c.title}\nType: ${c.type}\n${c.content.slice(0, 1500)}`)
      .join('\n\n---\n\n')
      .slice(0, 8000); // hard cap on total input

    // ── Step 1: Generate study note as a clean document (no markdown symbols) ──
    const studyNote = await callGemma(
      GEMINI_KEY,
      `Write a comprehensive, exam-ready study note for "${courseCode} — ${courseTitle}" at UNIPORT Nigeria.

Course Description: ${courseDescription || 'Not provided'}

Student Contributions to synthesise:
${contribText}

FORMATTING RULES — STRICTLY FOLLOW:
- Write like a professional academic document, NOT a markdown file
- Use SECTION HEADINGS in ALL CAPS followed by a blank line (e.g. "1. INTRODUCTION TO DIGITAL FORENSICS")
- Use SUB-HEADINGS in Title Case followed by a colon (e.g. "Chain of Custody:")
- Use plain numbered lists (1. 2. 3.) and lettered sub-items (a. b. c.) — no asterisks, no hyphens, no pound signs
- Bold key terms by writing them in CAPITALS inline (e.g. "The CIA TRIAD consists of...")
- Separate paragraphs with a blank line
- Do NOT use #, ##, **, *, \`, or any other markdown symbols anywhere
- Write complete sentences and full paragraphs — not bullet dumps

CONTENT REQUIREMENTS:
- Define every key term clearly
- Explain concepts with Nigerian/African real-world examples
- Include exam tips at the end of each section in plain text: "EXAM TIP: ..."
- End with a KEY POINTS SUMMARY section listing the 10 most important facts
- Write enough to study from without needing other resources

Write the complete study note now:`,
      'You are a senior UNIPORT cybersecurity lecturer writing an official course study document. Write in clear, professional academic prose. Never use markdown formatting symbols.',
      6000, // reduced from 16384 to fit within timeout
      0.7
    );

    const generatedAt = new Date().toISOString();

    // ── Step 2: Extract topics (kept short to stay within time budget) ─────────
    let topicsExtracted = false;
    if (courseId && studyNote.length > 100) {
      try {
        const raw = await callGemma(
          GEMINI_KEY,
          `Extract the main section topics from this study note. Return ONLY a raw JSON array, nothing else:
[{"name":"Topic Name","slug":"topic-name","description":"One sentence.","order":1}]

Rules: 5-12 topics maximum, proper Title Case names, URL-safe slugs (lowercase, hyphens only), order starting from 1.

Study Note (first 3000 chars):
${studyNote.slice(0, 3000)}`,
          'Extract topics as JSON only. No explanation, no markdown, just the raw JSON array.',
          600, // very small — just needs topic names
          0.2
        );

        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        // Find the JSON array in the response even if there's surrounding text
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (match) {
          const topics = JSON.parse(match[0]) as { name: string; slug: string; description: string; order: number }[];
          if (Array.isArray(topics) && topics.length > 0) {
            const rows = topics.map(t => ({
              course_id: courseId,
              name: t.name?.trim() || 'Unnamed Topic',
              slug: t.slug?.trim() || slugify(t.name || 'unnamed'),
              description: t.description?.trim() || null,
              topic_order: t.order || 0,
              source_section: null,
              extracted_at: generatedAt,
            }));
            const { error } = await sb.from('course_topics').upsert(rows, { onConflict: 'course_id,slug' });
            if (error) {
              console.error('[gen-note] topic upsert error:', error.message);
            } else {
              topicsExtracted = true;
              console.log(`[gen-note] extracted ${rows.length} topics for ${courseId}`);
            }
          }
        }
      } catch (e) {
        console.error('[gen-note] topic extraction failed (non-fatal):', e);
      }
    }

    return new Response(JSON.stringify({ studyNote, generatedAt, topicsExtracted }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[gen-note] error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
