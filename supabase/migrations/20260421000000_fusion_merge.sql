-- ============================================================
-- CYBERWIKI × CYBERMENTOR FUSION — Database Migration
-- Run in: Supabase SQL editor for project edksbqtouccmbvlrtnsw
-- Safe to re-run: IF NOT EXISTS + DROP POLICY IF EXISTS
-- ============================================================


-- ── 1. EXTEND PROFILES WITH TUTOR FIELDS ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS career_path   TEXT,
  ADD COLUMN IF NOT EXISTS tutor_level   INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS weak_areas    TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT now();


-- ── 2. CONTRIBUTIONS TABLE (replaces localStorage) ───────────
CREATE TABLE IF NOT EXISTS public.contributions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id     TEXT NOT NULL,
  content_type  TEXT NOT NULL DEFAULT 'written',
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  pdf_url       TEXT,
  video_url     TEXT,
  what_it_adds  TEXT,
  author_id     UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  author_mat    TEXT NOT NULL,
  author_name   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'under_review',
  is_fast_track BOOLEAN DEFAULT false,
  ai_rejection  TEXT,
  accuracy_score NUMERIC(5,2),
  is_edited     BOOLEAN DEFAULT false,
  review_outcome TEXT,
  reviewed_by   TEXT,
  submitted_at  TIMESTAMPTZ DEFAULT now(),
  reviewed_at   TIMESTAMPTZ
);

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read approved contributions" ON public.contributions;
DROP POLICY IF EXISTS "Users insert own contributions"        ON public.contributions;
DROP POLICY IF EXISTS "Users update own pending"             ON public.contributions;
DROP POLICY IF EXISTS "Admins manage all contributions"      ON public.contributions;

CREATE POLICY "Anyone can read approved contributions"
  ON public.contributions FOR SELECT USING (
    status IN ('admin_approved', 'ai_accepted') OR auth.uid() = author_id OR public.is_admin(auth.uid())
  );
CREATE POLICY "Users insert own contributions"
  ON public.contributions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users update own pending"
  ON public.contributions FOR UPDATE USING (
    auth.uid() = author_id AND status IN ('under_review', 'ai_rejected')
  );
CREATE POLICY "Admins manage all contributions"
  ON public.contributions FOR ALL USING (public.is_admin(auth.uid()));


-- ── 3. STUDY NOTES TABLE (replaces localStorage) ─────────────
CREATE TABLE IF NOT EXISTS public.study_notes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id    TEXT NOT NULL UNIQUE,
  content      TEXT NOT NULL,
  source_count INTEGER DEFAULT 0,
  sync_meta    JSONB DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read study notes"    ON public.study_notes;
DROP POLICY IF EXISTS "Admins manage study notes"      ON public.study_notes;

CREATE POLICY "Anyone can read study notes"
  ON public.study_notes FOR SELECT USING (true);
CREATE POLICY "Admins manage study notes"
  ON public.study_notes FOR ALL USING (public.is_admin(auth.uid()));


-- ── 4. TUTOR CONVERSATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  topic_id   TEXT NOT NULL,
  mode       TEXT NOT NULL DEFAULT 'learn',
  messages   JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT conversations_unique UNIQUE (user_id, topic_id, mode)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own conversations" ON public.conversations;
CREATE POLICY "Users manage own conversations"
  ON public.conversations FOR ALL USING (auth.uid() = user_id);


-- ── 5. TOPIC PROGRESS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.topic_progress (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  topic_id     TEXT NOT NULL,
  status       TEXT DEFAULT 'in_progress',
  completed_at TIMESTAMPTZ,
  CONSTRAINT topic_progress_unique UNIQUE (user_id, topic_id)
);

ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own topic progress" ON public.topic_progress;
CREATE POLICY "Users manage own topic progress"
  ON public.topic_progress FOR ALL USING (auth.uid() = user_id);


-- ── 6. QUIZ RESULTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  topic_id     TEXT NOT NULL,
  score        INTEGER NOT NULL,
  total        INTEGER NOT NULL DEFAULT 10,
  weak_areas   TEXT[] DEFAULT '{}',
  answers_json JSONB DEFAULT '[]'::jsonb,
  taken_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quiz results" ON public.quiz_results;
CREATE POLICY "Users manage own quiz results"
  ON public.quiz_results FOR ALL USING (auth.uid() = user_id);


-- ── 7. EXAM RESULTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_results (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  topic_id      TEXT NOT NULL,
  score         INTEGER NOT NULL,
  total         INTEGER NOT NULL DEFAULT 45,
  grade         TEXT NOT NULL,
  feedback_json JSONB DEFAULT '[]'::jsonb,
  taken_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own exam results" ON public.exam_results;
CREATE POLICY "Users manage own exam results"
  ON public.exam_results FOR ALL USING (auth.uid() = user_id);


-- ── 8. SCENARIO RESULTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scenario_results (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  topic_id   TEXT NOT NULL,
  score      INTEGER NOT NULL,
  radar_json JSONB DEFAULT '{}'::jsonb,
  strengths  TEXT[] DEFAULT '{}',
  gaps       TEXT[] DEFAULT '{}',
  taken_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.scenario_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own scenario results" ON public.scenario_results;
CREATE POLICY "Users manage own scenario results"
  ON public.scenario_results FOR ALL USING (auth.uid() = user_id);


-- ── 9. AUTO-UPDATE updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();


-- ── DONE ─────────────────────────────────────────────────────
-- Tables: profiles (extended), contributions, study_notes,
--         conversations, topic_progress, quiz_results,
--         exam_results, scenario_results
