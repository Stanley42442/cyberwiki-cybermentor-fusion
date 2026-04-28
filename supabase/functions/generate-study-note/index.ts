// supabase/functions/generate-study-note/index.ts
// Generates textbook-quality study note + extracts course topics automatically.

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
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { courseTitle, courseCode, courseDescription, contributions, courseId } = await req.json();

    if (!contributions?.length) {
      return new Response(JSON.stringify({ error: 'No contributions provided' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const contribText = contributions
      .map((c: { title: string; content: string; type: string }, i: number) =>
        `[CONTRIBUTION ${i + 1}]\nTitle: ${c.title}\nType: ${c.type}\n${c.content}`)
      .join('\n\n---\n\n');

    // ── Step 1: Generate study note ─────────────────────────────
    const studyNote = await callGemma(
      GEMINI_KEY,
      `Create a comprehensive textbook-quality study note for "${courseCode} — ${courseTitle}" at UNIPORT Nigeria, based on these student contributions. Structure with numbered markdown sections. Each section: define all terms, explain deeply, give real-world examples, note exam relevance. Add a "Key Points" summary at the end of each major section. Make it complete enough to study from without other resources. Use Nigerian/African examples where relevant.\n\nCourse Description: ${courseDescription || 'Not provided'}\n\nCONTRIBUTIONS:\n${contribText}\n\nWrite the complete study note now:`,
      'You are a world-class academic textbook author writing for Nigerian university students preparing for high-stakes exams.',
      16384, 0.7
    );

    const generatedAt = new Date().toISOString();

    // ── Step 2: Extract topics (non-fatal if it fails) ──────────
    let topicsExtracted = false;
    if (courseId && studyNote.length > 100) {
      try {
        const raw = await callGemma(
          GEMINI_KEY,
          `Extract the main topics from this study note. Return ONLY a raw JSON array (no markdown):\n[{"name":"Topic Name","slug":"topic-name","description":"One exam-focused sentence.","order":1,"source_section":"Exact heading from note"}]\n\nRules: 5-15 main topics, proper case names, URL-safe slugs, order starting from 1.\n\nStudy Note:\n${studyNote.slice(0, 8000)}`,
          'You extract topics from study notes. Return only valid JSON arrays. No markdown fences.',
          2000, 0.2
        );

        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const topics = JSON.parse(cleaned) as { name: string; slug: string; description: string; order: number; source_section: string }[];

        if (Array.isArray(topics) && topics.length > 0) {
          const rows = topics.map(t => ({
            course_id: courseId,
            name: t.name?.trim() || 'Unnamed Topic',
            slug: t.slug?.trim() || slugify(t.name || 'unnamed'),
            description: t.description?.trim() || null,
            topic_order: t.order || 0,
            source_section: t.source_section?.trim() || null,
            extracted_at: generatedAt,
          }));
          const { error } = await sb.from('course_topics').upsert(rows, { onConflict: 'course_id,slug' });
          if (error) console.error('[gen-note] topic upsert error:', error.message);
          else { topicsExtracted = true; console.log(`[gen-note] extracted ${rows.length} topics for ${courseId}`); }
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
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
