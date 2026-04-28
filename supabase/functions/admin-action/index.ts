// supabase/functions/admin-action/index.ts
// All admin write operations go through here using the service role key.
// This completely eliminates the need for is_admin() in RLS policies,
// which was causing infinite recursion on the profiles table.
//
// Actions supported:
//   update_user_tier    — promote/demote a user's tier
//   update_user_status  — verify or reject a user
//   archive_course      — soft-delete a course (active=false)
//   restore_course      — restore an archived course
//   upsert_course       — create or update a course
//   toggle_course_visibility
//   approve_contribution
//   reject_contribution
//   upsert_exam_date
//   delete_exam_date
//   publish_kb          — mark a knowledge base as ready
//   unpublish_kb

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ok = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data }), { headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // ── Auth: verify caller is admin ──────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return err('Unauthorised', 401);

    // Use service role to bypass RLS for the admin check itself
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authErr } = await sb.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return err('Unauthorised', 401);

    // Check tier using service role — no RLS recursion
    const { data: profile } = await sb
      .from('profiles').select('tier, display_name')
      .eq('id', user.id).maybeSingle();

    if (profile?.tier !== 'admin') return err('Forbidden — admin only', 403);
    const adminName = profile.display_name ?? 'Admin';

    const { action, payload } = await req.json();
    if (!action) return err('action required');

    const now = new Date().toISOString();

    // ── Log the action ────────────────────────────────────────
    const logAction = async (targetType: string, targetId: string, details?: unknown) => {
      await sb.from('admin_audit_log').insert({
        admin_id: user.id,
        admin_name: adminName,
        action,
        target_type: targetType,
        target_id: String(targetId),
        details: details ?? null,
        created_at: now,
      }).then(({ error }) => { if (error) console.warn('[admin-action] audit log failed:', error.message); });
    };

    switch (action) {

      // ── User management ───────────────────────────────────────
      case 'update_user_tier': {
        const { userId, tier } = payload;
        if (!userId || !tier) return err('userId and tier required');
        const validTiers = ['pending', 'verified_student', 'trusted_contributor', 'admin'];
        if (!validTiers.includes(tier)) return err('Invalid tier');
        const { error } = await sb.from('profiles').update({ tier, updated_at: now }).eq('id', userId);
        if (error) return err(error.message, 500);
        await logAction('user', userId, { tier });
        return ok({ userId, tier });
      }

      case 'update_user_status': {
        const { userId, status, rejection_reason } = payload;
        if (!userId || !status) return err('userId and status required');
        const update: Record<string, unknown> = { status, updated_at: now };
        if (status === 'verified') update.tier = 'verified_student';
        const { error } = await sb.from('profiles').update(update).eq('id', userId);
        if (error) return err(error.message, 500);
        await logAction('user', userId, { status, rejection_reason });
        return ok({ userId, status });
      }

      // ── Course management ─────────────────────────────────────
      case 'upsert_course': {
        const { course } = payload;
        if (!course?.id) return err('course.id required');
        const row = {
          id: course.id,
          code: course.code,
          title: course.title,
          description: course.description ?? '',
          year_level: course.yearLevel,
          semester: course.semester,
          department: course.department ?? 'cybersecurity',
          prerequisites: course.prerequisites ?? [],
          leads_to: course.leadsTo ?? [],
          visible: course.visible ?? true,
          active: course.active ?? true,
          updated_at: now,
        };
        const { error } = await sb.from('courses').upsert(row, { onConflict: 'id' });
        if (error) return err(error.message, 500);
        await logAction('course', course.id, { action: 'upsert' });
        return ok(row);
      }

      case 'archive_course': {
        const { courseId } = payload;
        if (!courseId) return err('courseId required');
        const { error } = await sb.from('courses').update({ active: false, updated_at: now }).eq('id', courseId);
        if (error) return err(error.message, 500);
        await logAction('course', courseId, { action: 'archive' });
        return ok({ courseId, active: false });
      }

      case 'restore_course': {
        const { courseId } = payload;
        if (!courseId) return err('courseId required');
        const { error } = await sb.from('courses').update({ active: true, visible: true, updated_at: now }).eq('id', courseId);
        if (error) return err(error.message, 500);
        await logAction('course', courseId, { action: 'restore' });
        return ok({ courseId, active: true });
      }

      case 'toggle_course_visibility': {
        const { courseId, visible } = payload;
        if (!courseId || visible === undefined) return err('courseId and visible required');
        const { error } = await sb.from('courses').update({ visible, updated_at: now }).eq('id', courseId);
        if (error) return err(error.message, 500);
        await logAction('course', courseId, { visible });
        return ok({ courseId, visible });
      }

      // ── Contribution management ───────────────────────────────
      case 'approve_contribution': {
        const { contributionId, outcome, reviewerName } = payload;
        if (!contributionId || !outcome) return err('contributionId and outcome required');
        const { error } = await sb.from('contributions').update({
          status: 'admin_approved',
          reviewed_at: now,
          reviewed_by: reviewerName ?? adminName,
          review_outcome: outcome,
          updated_at: now,
        }).eq('id', contributionId);
        if (error) return err(error.message, 500);
        await logAction('contribution', contributionId, { outcome });
        return ok({ contributionId, status: 'admin_approved' });
      }

      case 'reject_contribution': {
        const { contributionId, reason } = payload;
        if (!contributionId) return err('contributionId required');
        const { error } = await sb.from('contributions').update({
          status: 'admin_rejected',
          reviewed_at: now,
          reviewed_by: adminName,
          review_outcome: 'rejected',
          ai_rejection_reason: reason ?? 'Rejected by admin',
          updated_at: now,
        }).eq('id', contributionId);
        if (error) return err(error.message, 500);
        await logAction('contribution', contributionId, { reason });
        return ok({ contributionId, status: 'admin_rejected' });
      }

      // ── Exam dates ────────────────────────────────────────────
      case 'upsert_exam_date': {
        const { examDate } = payload;
        if (!examDate?.course_id || !examDate?.exam_date) return err('course_id and exam_date required');
        const { data, error } = await sb.from('exam_dates').upsert(
          { ...examDate, created_by: user.id },
          { onConflict: 'course_id,exam_type' }
        ).select().maybeSingle();
        if (error) return err(error.message, 500);
        await logAction('exam_date', examDate.course_id, examDate);
        return ok(data);
      }

      case 'delete_exam_date': {
        const { examDateId } = payload;
        if (!examDateId) return err('examDateId required');
        const { error } = await sb.from('exam_dates').delete().eq('id', examDateId);
        if (error) return err(error.message, 500);
        await logAction('exam_date', examDateId, { action: 'delete' });
        return ok({ deleted: examDateId });
      }

      // ── Knowledge base ────────────────────────────────────────
      case 'publish_kb': {
        const { kbId } = payload;
        if (!kbId) return err('kbId required');
        const { error } = await sb.from('knowledge_bases')
          .update({ is_ready: true, updated_at: now }).eq('id', kbId);
        if (error) return err(error.message, 500);
        await logAction('knowledge_base', kbId, { action: 'publish' });
        return ok({ kbId, is_ready: true });
      }

      case 'unpublish_kb': {
        const { kbId } = payload;
        if (!kbId) return err('kbId required');
        const { error } = await sb.from('knowledge_bases')
          .update({ is_ready: false, updated_at: now }).eq('id', kbId);
        if (error) return err(error.message, 500);
        await logAction('knowledge_base', kbId, { action: 'unpublish' });
        return ok({ kbId, is_ready: false });
      }

      default:
        return err(`Unknown action: ${action}`);
    }

  } catch (e) {
    console.error('[admin-action] error:', e);
    return err((e as Error).message, 500);
  }
});
