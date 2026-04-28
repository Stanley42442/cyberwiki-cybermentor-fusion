// supabase/functions/gemini-proxy/index.ts
// AI proxy: JWT validation + rate limiting + dual-model routing
//   CHAT        → gemini-3.0-flash-live  (Unlimited RPD, Text-out, no reasoning leakage)
//   SUMMARIZE   → gemini-3.1-flash-lite  (500 RPD, Text-out, accurate compression)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_PER_MINUTE = 20;
const RATE_PER_DAY    = 200;

interface GeminiRequest {
  model: string;
  task?: 'chat' | 'summarize';   // ← routing hint from frontend
  system_instruction?: { parts: { text: string }[] };
  contents: { role: string; parts: { text: string }[] }[];
  generationConfig?: { maxOutputTokens?: number; temperature?: number; topP?: number };
}

const wrap = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const errRes = (msg: string, status: number) =>
  new Response(JSON.stringify({ error: { message: msg } }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// ── Rate limiter ───────────────────────────────────────────────
async function checkRateLimit(userId: string, sb: ReturnType<typeof createClient>): Promise<{ ok: boolean; reason?: string }> {
  const now = new Date();
  const bucket = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { error } = await sb.from('ai_rate_limits').upsert(
    { user_id: userId, minute_bucket: bucket, call_count: 1 },
    { onConflict: 'user_id,minute_bucket', ignoreDuplicates: false }
  );
  if (!error) {
    await sb.rpc('increment_ai_call_count', { p_user_id: userId, p_bucket: bucket });
  }

  const { data: minRow } = await sb
    .from('ai_rate_limits').select('call_count')
    .eq('user_id', userId).eq('minute_bucket', bucket).maybeSingle();
  if ((minRow?.call_count ?? 0) > RATE_PER_MINUTE)
    return { ok: false, reason: `Too many requests — max ${RATE_PER_MINUTE} AI calls per minute.` };

  const { data: dayRows } = await sb
    .from('ai_rate_limits').select('call_count')
    .eq('user_id', userId).gte('minute_bucket', dayStart);
  const dayTotal = (dayRows ?? []).reduce((s, r) => s + (r.call_count ?? 0), 0);
  if (dayTotal > RATE_PER_DAY)
    return { ok: false, reason: `Daily AI limit reached (${RATE_PER_DAY} calls). Resets at midnight.` };

  return { ok: true };
}

// ── Google REST helper ─────────────────────────────────────────
async function callGoogle(modelId: string, req: GeminiRequest, label: string): Promise<string> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const body: Record<string, unknown> = { contents: req.contents };
  if (req.system_instruction) body.system_instruction = req.system_instruction;
  if (req.generationConfig)   body.generationConfig   = req.generationConfig;
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!r.ok) throw new Error(`${label} ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const parts = d.candidates?.[0]?.content?.parts;
  if (!parts?.length) throw new Error(`${label} empty response`);
  // Filter out Gemma 4 chain-of-thought parts (flagged with thought: true)
  // so internal reasoning is never returned to the student.
  const answerPart = parts.find((p: Record<string, unknown>) => p.text && !p.thought) ?? parts[parts.length - 1];
  const t = answerPart?.text as string | undefined;
  if (!t) throw new Error(`${label} empty response`);
  return t;
}

// ── Groq fallback ─────────────────────────────────────────────
async function groq(req: GeminiRequest): Promise<string> {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) throw new Error('GROQ_API_KEY not set');
  const sys = req.system_instruction?.parts?.map(p => p.text).join('\n') ?? '';
  const msgs = [
    ...(sys ? [{ role: 'system', content: sys }] : []),
    ...req.contents.map(c => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map(p => p.text).join('') })),
  ];
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: msgs, max_tokens: req.generationConfig?.maxOutputTokens ?? 8192, temperature: req.generationConfig?.temperature ?? 0.9 }),
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const t = d.choices?.[0]?.message?.content;
  if (!t) throw new Error('Groq empty');
  return t;
}

// ── OpenRouter fallback ────────────────────────────────────────
async function openRouter(req: GeminiRequest): Promise<string> {
  const key = Deno.env.get('OPENROUTER_API_KEY');
  if (!key) throw new Error('OPENROUTER_API_KEY not set');
  const sys = req.system_instruction?.parts?.map(p => p.text).join('\n') ?? '';
  const msgs = [
    ...(sys ? [{ role: 'system', content: sys }] : []),
    ...req.contents.map(c => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map(p => p.text).join('') })),
  ];
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'HTTP-Referer': 'https://cyberwiki-uniport.app' },
    body: JSON.stringify({ model: 'meta-llama/llama-3.1-8b-instruct:free', messages: msgs, max_tokens: req.generationConfig?.maxOutputTokens ?? 8192 }),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const t = d.choices?.[0]?.message?.content;
  if (!t) throw new Error('OpenRouter empty');
  return t;
}

// ── Handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. JWT validation
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return errRes('Unauthorised', 401);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await sb.auth.getUser(auth.replace('Bearer ', ''));
    if (authErr || !user) return errRes('Unauthorised — invalid session', 401);

    // 2. Rate limit
    const rl = await checkRateLimit(user.id, sb);
    if (!rl.ok) return errRes(rl.reason ?? 'Rate limit exceeded', 429);

    // 3. Parse body
    const body: GeminiRequest = await req.json();
    if (!body.contents?.length) return errRes('contents array required', 400);
    if (JSON.stringify(body).length > 200_000) return errRes('Payload too large', 413);

    // 4. Dual-model routing
    //    SUMMARIZE path  → gemini-3.1-flash-lite (Text-out, 500 RPD, accurate compression)
    //    CHAT path       → gemini-3.0-flash-live (Unlimited RPD, no reasoning leakage) with fallbacks
    let text: string | null = null;
    const errs: string[] = [];

    if (body.task === 'summarize') {
      // Summarization: Flash Lite first, Groq as fallback
      try { text = await callGoogle('gemini-3.1-flash-lite', body, 'FlashLite'); console.log('[proxy] summarize: flash-lite ok'); } catch (e) { errs.push(`flash-lite: ${(e as Error).message}`); }
      if (!text) { try { text = await groq(body); console.log('[proxy] summarize: groq ok'); } catch (e) { errs.push(`groq: ${(e as Error).message}`); } }
    } else {
      // Chat: use the model requested by the frontend (e.g. 'gemma-4-31b-it').
      // Falls back through Gemini Flash Lite → Groq → OpenRouter if primary fails.
      const requestedModel = body.model ?? 'gemma-4-31b-it';
      try { text = await callGoogle(requestedModel, body, requestedModel); console.log(`[proxy] chat: ${requestedModel} ok`); } catch (e) { errs.push(`${requestedModel}: ${(e as Error).message}`); }
      if (!text && requestedModel !== 'gemini-3.1-flash-lite') { try { text = await callGoogle('gemini-3.1-flash-lite', body, 'FlashLite'); console.log('[proxy] chat: flash-lite fallback ok'); } catch (e) { errs.push(`flash-lite: ${(e as Error).message}`); } }
      if (!text) { try { text = await groq(body); console.log('[proxy] chat: groq ok'); } catch (e) { errs.push(`groq: ${(e as Error).message}`); } }
      if (!text) { try { text = await openRouter(body); console.log('[proxy] chat: openrouter ok'); } catch (e) { errs.push(`openrouter: ${(e as Error).message}`); console.error('[proxy] all failed:', errs); } }
    }

    if (!text) return errRes(`All backends failed: ${errs.join(' | ')}`, 503);

    return new Response(JSON.stringify(wrap(text)), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('[proxy] error:', e);
    return errRes((e as Error).message, 500);
  }
});
