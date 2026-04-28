// supabase/functions/keep-alive/index.ts
// Prevents the Supabase free tier database from pausing.
// Schedule this to run every 4 days in Supabase Dashboard →
// Edge Functions → keep-alive → Schedule → every 4 days (cron: 0 9 */4 * *)
//
// Free tier pauses after 7 days inactivity. Running every 4 days
// keeps it warm with a comfortable margin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    // Lightweight ping — just selects 1 row from profiles
    const { error } = await sb.from('profiles').select('id').limit(1);
    if (error) throw error;
    console.log('[keep-alive] DB pinged successfully at', new Date().toISOString());
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[keep-alive] Failed:', e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
