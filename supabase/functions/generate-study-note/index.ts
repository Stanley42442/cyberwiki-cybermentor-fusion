// supabase/functions/generate-study-note/index.ts
//
// SYNTHESIS ONLY — reads pre-saved raw_extractions from every approved
// contribution for the course and synthesises the final study note.
//
// Checks extraction_status before proceeding:
//   - 'complete'     → use this contribution's extractions
//   - 'in_progress'  → warn the admin, skip (still being extracted)
//   - null           → warn the admin, skip (never extracted — old contribution)
//
// Force Generate is always ~30-40s regardless of how many contributions
// exist because extraction already happened at approval time.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

// ── Gemini Flash — synthesis model ────────────────────────────────────────────
async function callGemini(
  key: string,
  prompt: string,
  systemText: string,
  maxTokens: number,
  temperature = 0.7
): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Synthesise final study note ───────────────────────────────────────────────
async function synthesiseStudyNote(
  key: string,
  courseCode: string,
  courseTitle: string,
  courseDescription: string,
  allExtractions: string
): Promise<string> {
  return await callGemini(
    key,
    `Write a comprehensive, textbook-quality study note for "${courseCode} — ${courseTitle}" at the University of Port Harcourt (UNIPORT), Nigeria.

Course Description: ${courseDescription || 'Not provided'}

Below are structured concept extractions from every page and chapter of every approved student contribution. Merge all of this into one authoritative, well-organised academic document covering EVERY topic present. Do not drop anything.

EXTRACTED CONCEPTS FROM ALL CONTRIBUTIONS:
${allExtractions}

WRITING REQUIREMENTS:
1. Cover EVERY topic and concept found above. Do not drop anything.
2. Use ALL CAPS for main section headings (e.g. INTRODUCTION TO CRYPTOGRAPHY).
3. Use numbered sub-sections (1.1, 1.2 etc.) for sub-topics.
4. Define every technical term clearly when first introduced.
5. For every major concept, provide a real-world Nigerian example (UNIPORT, banks, government offices, markets etc.).
6. Add an EXAM TIP at the end of each major section — what examiners typically ask and how to answer well.
7. End with a KEY POINTS SUMMARY bullet list covering the entire document.
8. Do NOT use markdown symbols like #, **, or *. Plain text only.
9. Write in formal academic English. A student should be able to pass the exam from this document alone.

Write the complete study note now:`,
    'You are a world-class academic textbook author writing for Nigerian university students preparing for high-stakes exams. Your writing is clear, thorough, and exam-focused.',
    8192
  );
}

// ── Extract sidebar topics (non-fatal) ────────────────────────────────────────
async function extractTopics(
  key: string,
  courseId: string,
  studyNote: string,
  generatedAt: string,
  sb: ReturnType<typeof createClient>
): Promise<boolean> {
  try {
    const raw = await callGemini(
      key,
      `Extract the main topics from this study note. Return ONLY a raw JSON array (no markdown, no code fences):
[{"name":"Topic Name","slug":"topic-name","description":"One exam-focused sentence.","order":1,"source_section":"Exact heading from note"}]

Rules: 5-15 topics, proper case names, URL-safe slugs, order from 1.

Study Note (first 6000 chars):
${studyNote.slice(0, 6000)}`,
      'You extract topics from study notes. Return only a valid JSON array. No markdown. No commentary.',
      600,
      0.1
    );

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array found');
    const topics = JSON.parse(match[0]) as {
      name: string; slug: string; description: string; order: number; source_section: string;
    }[];
    if (!Array.isArray(topics) || topics.length === 0) throw new Error('Empty topics array');

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
    if (error) { console.error('[gen-note] topic upsert error:', error.message); return false; }
    console.log(`[gen-note] ${rows.length} topics saved for ${courseId}`);
    return true;
  } catch (e) {
    console.error('[gen-note] topic extraction failed (non-fatal):', e);
    return false;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { courseId, courseTitle, courseCode, courseDescription } = await req.json();

    if (!courseId) {
      return new Response(
        JSON.stringify({ error: 'courseId is required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all approved contributions with their extraction status
    const { data: contribs, error: fetchError } = await sb
      .from('contributions')
      .select('id, title, raw_extractions, extraction_status')
      .eq('course_id', courseId)
      .eq('status', 'admin_approved');

    if (fetchError) throw new Error(`Failed to fetch contributions: ${fetchError.message}`);
    if (!contribs || contribs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No approved contributions found for this course.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Separate contributions by extraction state
    const ready = contribs.filter(c => c.extraction_status === 'complete' && c.raw_extractions);
    const inProgress = contribs.filter(c => c.extraction_status === 'in_progress');
    // Legacy: approved before extract-concepts existed — use raw content directly
    const notStarted = contribs.filter(c => !c.extraction_status && !c.raw_extractions);

    console.log(`[gen-note] ${courseCode}: ${ready.length} ready, ${inProgress.length} in-progress, ${notStarted.length} legacy (no extractions)`);

    // Build warnings for skipped/legacy contributions
    const warnings: string[] = [];
    if (inProgress.length > 0) {
      warnings.push(`${inProgress.length} contribution(s) still extracting — will be included after regeneration: ${inProgress.map(c => c.title).join(', ')}`);
    }
    if (notStarted.length > 0) {
      warnings.push(`${notStarted.length} legacy contribution(s) used raw content (approve again to enable full extraction): ${notStarted.map(c => c.title).join(', ')}`);
    }
    warnings.forEach(w => console.warn(`[gen-note] WARNING: ${w}`));

    // Combine: ready extractions + legacy raw content + in-progress raw content fallback
    const usableContribs = [
      ...ready.map(c => ({ title: c.title, text: c.raw_extractions as string })),
      // Legacy: use raw content directly — not as rich as extracted but still valid input
      ...notStarted.map(c => ({ title: c.title, text: c.content as string ?? '' })),
      // In-progress: use whatever partial extractions are saved, fall back to raw content
      ...inProgress.map(c => ({ title: c.title, text: (c.raw_extractions as string) || (c.content as string) || '' })),
    ].filter(c => c.text?.trim().length > 0);

    if (usableContribs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No usable content found in any approved contributions.' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const allExtractions = usableContribs
      .map(c => `=== CONTRIBUTION: ${c.title} ===\n${c.text}`)
      .join('\n\n' + '='.repeat(60) + '\n\n');

    console.log(`[gen-note] synthesising from ${ready.length} contribution(s) — ${allExtractions.length} chars`);

    const studyNote = await synthesiseStudyNote(
      KEY, courseCode, courseTitle, courseDescription || '', allExtractions
    );
    const generatedAt = new Date().toISOString();
    console.log(`[gen-note] synthesis complete — ${studyNote.length} chars`);

    // Save final note
    const { error: saveError } = await sb
      .from('study_notes')
      .upsert(
        { course_id: courseId, content: studyNote, generated_at: generatedAt, updated_at: generatedAt },
        { onConflict: 'course_id' }
      );
    if (saveError) console.error('[gen-note] note save error:', saveError.message);

    // Extract sidebar topics
    let topicsExtracted = false;
    if (studyNote.length > 100) {
      topicsExtracted = await extractTopics(KEY, courseId, studyNote, generatedAt, sb);
    }

    return new Response(
      JSON.stringify({ studyNote, generatedAt, topicsExtracted, warnings }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[gen-note] fatal error:', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
