// supabase/functions/extract-concepts/index.ts
//
// Processes ONE contribution in batches of 4 chunks per call.
// The client calls this repeatedly with increasing batchOffset until
// the response contains { done: true }.
//
// Example for a 10-chunk document:
//   Call 1: batchOffset=0  → processes chunks 0-3 → { done: false, nextBatchOffset: 4 }
//   Call 2: batchOffset=4  → processes chunks 4-7 → { done: false, nextBatchOffset: 8 }
//   Call 3: batchOffset=8  → processes chunks 8-9 → { done: true }
//
// Each call takes ~80-100s max (4 chunks × ~25s). Always under 150s.
// extraction_status tracks progress so generate-study-note can warn
// the admin if they click Force Generate before extraction finishes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function callGemma(key: string, prompt: string, systemText: string, maxTokens: number): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.1 },
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemma ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function chunkText(text: string, chunkSize = 4000, overlap = 200): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const {
      contributionId,
      contributionTitle,
      contributionContent,
      courseCode,
      courseTitle,
      batchOffset = 0,
      batchSize = 4,
    } = await req.json();

    if (!contributionId || !contributionContent) {
      return new Response(
        JSON.stringify({ error: 'contributionId and contributionContent are required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const allChunks = chunkText(contributionContent);
    const totalChunks = allChunks.length;
    const batch = allChunks.slice(batchOffset, batchOffset + batchSize);
    const isFirstBatch = batchOffset === 0;
    const isLastBatch = batchOffset + batchSize >= totalChunks;

    console.log(
      `[extract-concepts] "${contributionTitle}" — batch offset ${batchOffset}, ` +
      `processing ${batch.length} of ${totalChunks} chunks`
    );

    // Extract each chunk in this batch sequentially
    // Gemma's ~25s response time naturally prevents rate limiting
    const extractedParts: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      const chunk = batch[i];
      const chunkIndex = batchOffset + i;
      const label = `${contributionTitle} — chunk ${chunkIndex + 1}/${totalChunks}`;
      console.log(`[extract-concepts] extracting chunk ${chunkIndex + 1}/${totalChunks}`);

      let extracted: string;
      try {
        extracted = await callGemma(
          KEY,
          `Extract ALL key concepts, definitions, theories, formulas, and exam-relevant facts from this section of "${courseCode} — ${courseTitle}".

SECTION: ${label}
CONTENT:
"""
${chunk}
"""

Format:
TOPIC: [Topic Name]
- [Definition or key point]
- [Definition or key point]

TOPIC: [Next Topic]
- ...

Be exhaustive. Every concept that could appear in an exam must be listed. Output the extraction only. No preamble.`,
          'You are a precise academic content extractor for a Nigerian university. Extract every concept, definition, and fact. Miss nothing. No preamble or commentary.',
          600
        );
      } catch (e) {
        console.error(`[extract-concepts] Gemma failed for chunk ${chunkIndex + 1}, using raw fallback:`, e);
        extracted = `[RAW FALLBACK — chunk ${chunkIndex + 1}]\n${chunk}`;
      }

      extractedParts.push(extracted.trim());
    }

    const batchExtractions = extractedParts.join('\n\n');

    // Save to DB — append on subsequent batches, set on first batch
    if (isFirstBatch) {
      const { error } = await sb
        .from('contributions')
        .update({
          raw_extractions: batchExtractions,
          extraction_status: isLastBatch ? 'complete' : 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contributionId);
      if (error) throw new Error(`DB write failed: ${error.message}`);
    } else {
      // Read existing extractions and append
      const { data: current, error: readErr } = await sb
        .from('contributions')
        .select('raw_extractions')
        .eq('id', contributionId)
        .single();
      if (readErr) throw new Error(`DB read failed: ${readErr.message}`);

      const appended = (current?.raw_extractions ?? '') + '\n\n' + batchExtractions;
      const { error: writeErr } = await sb
        .from('contributions')
        .update({
          raw_extractions: appended,
          extraction_status: isLastBatch ? 'complete' : 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contributionId);
      if (writeErr) throw new Error(`DB append failed: ${writeErr.message}`);
    }

    console.log(
      `[extract-concepts] batch saved — ${batchExtractions.length} chars, ` +
      `status: ${isLastBatch ? 'complete' : 'in_progress'}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        done: isLastBatch,
        nextBatchOffset: batchOffset + batchSize,
        chunksProcessed: batch.length,
        totalChunks,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[extract-concepts] fatal error:', e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
