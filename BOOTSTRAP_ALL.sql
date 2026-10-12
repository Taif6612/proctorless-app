-- ============================================================
-- BOOTSTRAP_ALL.sql  (generated 2026-09-21)
-- Full schema for a FRESH Supabase project, in dependency order.
-- Paste this whole file into the Supabase SQL editor and Run.
-- Excluded deliberately: MACHINE_REGISTRY_SETUP.sql, QUIZ_TABLES_SETUP.sql
-- (duplicates), DUMMY_DATA.sql (dead UUIDs), and all 4 RLS files.
-- ============================================================



-- ############################################################
-- ## SECTION: supabase/migrations/000_courses_and_enrollments.sql
-- ############################################################

-- ============================================================================
-- 000_courses_and_enrollments.sql
-- ============================================================================
-- RECONSTRUCTED 2026-09-21.
--
-- These two tables were created by hand in the Supabase dashboard and were
-- never captured in a migration. When the original project
-- (opklqnpeviogsdmgqgbw) was deleted, their definitions were lost with it.
--
-- Reconstructed from actual application usage:
--   courses     : app/dashboard/actions.ts:45-54  (createCourse insert)
--                 app/dashboard/actions.ts:85-89  (join_code lookup)
--                 app/dashboard/page.tsx:1286     (select id, title, description)
--                 app/dashboard/page.tsx:1287     (order by created_at)
--                 app/dashboard/actions.ts:396    (professor_id ownership check)
--   enrollments : app/dashboard/actions.ts:96-100 (joinCourse insert)
--                 app/dashboard/page.tsx:101-103  (count by course_id)
--                 app/dashboard/page.tsx:180      (embed courses(...))
--
-- MUST RUN FIRST. 001_create_quizzes_and_submissions_and_rpc.sql line 10 has
-- `course_id uuid NOT NULL REFERENCES public.courses(id)` and will fail
-- without this file.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- courses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  join_code     text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.courses            IS 'A course owned by a professor. Students enrol via join_code.';
COMMENT ON COLUMN public.courses.join_code  IS 'Uppercase code students type to enrol. Uppercased on lookup in joinCourse().';

CREATE INDEX IF NOT EXISTS idx_courses_professor_id ON public.courses(professor_id);
CREATE INDEX IF NOT EXISTS idx_courses_created_at   ON public.courses(created_at DESC);

-- ----------------------------------------------------------------------------
-- enrollments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_course_student_unique UNIQUE (course_id, student_id)
);

COMMENT ON TABLE public.enrollments IS 'Join table: which students are enrolled in which course.';

CREATE INDEX IF NOT EXISTS idx_enrollments_course_id  ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.enrollments(student_id);

-- ============================================================================
-- ROW LEVEL SECURITY -- DELIBERATELY NOT ENABLED
-- ============================================================================
-- RLS is OFF on these tables. That is a decision, not an oversight.
--
-- The four legacy RLS files (enable_rls_policies / fix_rls_recursion /
-- clean_rls_setup / disable_all_rls) all target these two tables, contradict
-- each other, and one of them exists specifically because a previous policy
-- set caused infinite recursion. Enabling them unreviewed the night before a
-- demo is how you lose the demo.
--
-- This is safe ONLY on localhost. Do not deploy publicly in this state --
-- it is blocking issue #8 from the code review.
--
-- To enable later, after the policies have actually been reviewed:
--
--   ALTER TABLE public.courses     ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
--
--   CREATE POLICY courses_professor_all ON public.courses
--     FOR ALL USING (auth.uid() = professor_id) WITH CHECK (auth.uid() = professor_id);
--
--   -- Students need to look a course up by join_code before they are enrolled,
--   -- so SELECT stays open. The join_code is the gatekeeper.
--   CREATE POLICY courses_public_select ON public.courses
--     FOR SELECT USING (true);
--
--   CREATE POLICY enrollments_student_own ON public.enrollments
--     FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
--
--   CREATE POLICY enrollments_professor_read ON public.enrollments
--     FOR SELECT USING (
--       EXISTS (SELECT 1 FROM public.courses c
--               WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
--     );
--
-- NOTE: do NOT write a user_roles policy that itself queries user_roles.
-- That is what caused the recursion that fix_rls_recursion.sql was written for.
-- ============================================================================


-- ############################################################
-- ## SECTION: supabase/migrations/001_create_quizzes_and_submissions_and_rpc.sql
-- ############################################################

-- Migration: create quizzes and submissions tables and RPC for atomic submission creation
-- Run this in Supabase SQL editor or via supabase migrations.

-- Ensure pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  max_participants integer NULL,
  integrity_monitor_enabled boolean DEFAULT false,
  ai_grading_enabled boolean DEFAULT false,
  allowed_websites text NULL,
  question_bank_path text NULL,
  created_at timestamptz DEFAULT now()
);

-- Submissions table (a single row per student per quiz)
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz NULL,
  UNIQUE (quiz_id, student_id)
);

-- Atomic RPC: create_submission_if_space
-- Attempts to create a submission for student on quiz only if max_participants not exceeded.
-- Returns the inserted submission row.
CREATE OR REPLACE FUNCTION public.create_submission_if_space(p_quiz_id uuid, p_student_id uuid)
RETURNS TABLE(id uuid, quiz_id uuid, student_id uuid, started_at timestamptz, submitted_at timestamptz) AS $$
DECLARE
  v_max integer;
  v_count integer;
BEGIN
  -- lock the quiz row to avoid race conditions
  SELECT max_participants INTO v_max FROM public.quizzes WHERE id = p_quiz_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_not_found';
  END IF;

  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.submissions WHERE quiz_id = p_quiz_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'quiz_full';
    END IF;
  END IF;

  -- prevent duplicate
  IF EXISTS (SELECT 1 FROM public.submissions WHERE quiz_id = p_quiz_id AND student_id = p_student_id) THEN
    RAISE EXCEPTION 'already_started';
  END IF;

  INSERT INTO public.submissions (quiz_id, student_id, started_at)
  VALUES (p_quiz_id, p_student_id, now())
  RETURNING id, quiz_id, student_id, started_at, submitted_at INTO id, quiz_id, student_id, started_at, submitted_at;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon/public if necessary (adjust to your RLS/security model)
GRANT EXECUTE ON FUNCTION public.create_submission_if_space(uuid, uuid) TO public;

-- Integrity Logs table (tracks tab switches and other integrity violations)
CREATE TABLE IF NOT EXISTS public.integrity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  violation_type text NOT NULL,
  referrer text NULL,
  is_allowed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index on submission_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_integrity_logs_submission_id ON public.integrity_logs(submission_id);
CREATE INDEX IF NOT EXISTS idx_integrity_logs_created_at ON public.integrity_logs(created_at);


-- ############################################################
-- ## SECTION: supabase/migrations/002_create_users_table_and_storage.sql
-- ############################################################

-- Create users table to store additional profile information
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  department text,
  bio text,
  avatar_url text,
  role text DEFAULT 'student',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Grant permissions
GRANT SELECT ON public.users TO anon, authenticated;
GRANT INSERT ON public.users TO authenticated;
GRANT UPDATE ON public.users TO authenticated;

-- Create function to handle user creation from auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'student'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

GRANT SELECT ON storage.objects TO anon, authenticated;
GRANT INSERT ON storage.objects TO authenticated;
GRANT UPDATE ON storage.objects TO authenticated;
GRANT DELETE ON storage.objects TO authenticated;

-- ############################################################
-- ## SECTION: supabase/migrations/003_create_generated_questions.sql
-- ############################################################

-- generated_questions table stores per-student question variants
create table if not exists public.generated_questions (
  id uuid default gen_random_uuid() primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_index integer not null,
  variant jsonb not null,
  model text,
  created_at timestamptz default now()
);

create unique index if not exists idx_generated_questions_unique
  on public.generated_questions(submission_id, question_index);

-- ############################################################
-- ## SECTION: supabase/migrations/004_admin_role_and_audit.sql
-- ############################################################

-- Create user_roles table if missing
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student',
  updated_at timestamptz DEFAULT now()
);

-- Ensure RLS is enabled and basic policy
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'users_select_own_role'
  ) THEN
    CREATE POLICY users_select_own_role ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Admin audit logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL,
  actor_email text NULL,
  action text NOT NULL,
  target_user_id uuid NULL,
  details jsonb NULL,
  created_at timestamptz DEFAULT now()
);

-- Function: assign default role on signup; ensure specific email is admin
CREATE OR REPLACE FUNCTION public.handle_user_roles_on_signup()
RETURNS trigger AS $$
DECLARE
  v_email text;
BEGIN
  v_email := new.email;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (new.id, CASE WHEN lower(v_email) = 'storage12002@gmail.com' THEN 'admin' ELSE 'student' END)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_assign_user_roles ON auth.users;
CREATE TRIGGER on_assign_user_roles
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_roles_on_signup();



-- ############################################################
-- ## SECTION: supabase/migrations/005_create_machine_registry.sql
-- ############################################################

-- ============================================
-- Machine Registry for Fingerprint-Based Identification
-- ============================================
-- Stores composite fingerprints (GPU + Canvas + Screen) mapped to physical lab positions.
-- Fingerprints are deterministic hashes regenerated on each session.
-- This table is queried when a student joins a quiz to auto-assign their seat/variant.

-- Drop existing table if needed (uncomment for fresh start)
-- DROP TABLE IF EXISTS machine_registry;

CREATE TABLE IF NOT EXISTS machine_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The SHA-256 hash of the composite fingerprint (GPU + Canvas + Screen)
  -- This is deterministic: same hardware = same hash every time
  fingerprint_hash TEXT UNIQUE NOT NULL,
  
  -- Physical location mapping
  lab_name TEXT NOT NULL,           -- e.g., "Physics Lab A", "Library Computer Room"
  row_index INTEGER NOT NULL,       -- 0-indexed row in the seating grid
  column_index INTEGER NOT NULL,    -- 0-indexed column in the seating grid
  
  -- Optional human-readable label
  machine_label TEXT,               -- e.g., "PC-01", "Workstation-A1"
  
  -- Fingerprint components (for debugging/verification)
  -- Stored as JSON so we can see what changed if fingerprint drifts
  fingerprint_components JSONB,     -- { gpu: "...", canvas: "...", screen: "..." }
  
  -- Metadata
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  registered_by UUID REFERENCES auth.users(id),
  last_seen_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,     -- Last time fingerprint matched
  registration_notes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,   -- Can be disabled without deleting
  
  -- Ensure unique position per lab
  UNIQUE(lab_name, row_index, column_index)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_machine_fingerprint ON machine_registry(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_machine_lab ON machine_registry(lab_name);
CREATE INDEX IF NOT EXISTS idx_machine_active ON machine_registry(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE machine_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read (needed for fingerprint lookup during quiz)
CREATE POLICY "Anyone can read machine registry"
  ON machine_registry FOR SELECT
  USING (true);

-- Only professors and admins can insert/update/delete
CREATE POLICY "Professors can manage machine registry"
  ON machine_registry FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('professor', 'admin')
    )
  );

-- ============================================
-- Helper function to get variant index
-- ============================================
CREATE OR REPLACE FUNCTION get_variant_for_machine(
  p_fingerprint_hash TEXT,
  p_total_variants INTEGER DEFAULT 3
)
RETURNS TABLE (
  machine_id UUID,
  lab_name TEXT,
  row_index INTEGER,
  column_index INTEGER,
  variant_index INTEGER,
  machine_label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS machine_id,
    m.lab_name,
    m.row_index,
    m.column_index,
    -- Latin Square formula: ((row * 3) + column) % totalVariants
    ((m.row_index * 3) + m.column_index) % p_total_variants AS variant_index,
    m.machine_label
  FROM machine_registry m
  WHERE m.fingerprint_hash = p_fingerprint_hash
    AND m.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to update last_seen timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_machine_last_seen(p_fingerprint_hash TEXT)
RETURNS void AS $$
BEGIN
  UPDATE machine_registry 
  SET last_seen_at = NOW(),
      last_verified_at = NOW()
  WHERE fingerprint_hash = p_fingerprint_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_variant_for_machine TO authenticated;
GRANT EXECUTE ON FUNCTION update_machine_last_seen TO authenticated;

COMMENT ON TABLE machine_registry IS 'Maps machine fingerprints to physical lab positions for automated quiz variant assignment';
COMMENT ON COLUMN machine_registry.fingerprint_hash IS 'SHA-256 hash of composite fingerprint (GPU + Canvas + Screen). Deterministic - same hardware produces same hash.';


-- ############################################################
-- ## SECTION: SEATING_MIGRATION.sql
-- ############################################################

-- =====================================================
-- SEATING-AWARE QUIZ DISTRIBUTION - DATABASE SCHEMA
-- =====================================================
-- Run this migration in Supabase SQL Editor
-- =====================================================

-- 1. Quiz Sessions Table
-- Tracks active quiz sessions with seating configuration
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  rows INTEGER NOT NULL DEFAULT 5,
  columns INTEGER NOT NULL DEFAULT 6,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'seated', 'live', 'ended')),
  start_time TIMESTAMPTZ,                 -- When professor clicks "Start Quiz"
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  late_joiner_extra_minutes INTEGER DEFAULT 0,  -- Extra time for late joiners
  total_variants INTEGER NOT NULL DEFAULT 4,     -- Number of question variants
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Session Participants Table
-- Tracks students in waiting queue and their seat assignments
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  student_email TEXT,                     -- Cached for display
  seat_row INTEGER,                       -- NULL if not yet seated
  seat_column INTEGER,                    -- NULL if not yet seated
  variant_index INTEGER,                  -- Calculated: ((row * 3) + column) % totalVariants
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'seated', 'ready', 'taking', 'submitted')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  seated_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,                 -- When this student started (for late joiners)
  submitted_at TIMESTAMPTZ,
  UNIQUE(session_id, student_id),
  UNIQUE(session_id, seat_row, seat_column)
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON quiz_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON quiz_sessions(status);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_student_id ON session_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_status ON session_participants(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for quiz_sessions

-- Professors can manage sessions for their quizzes
CREATE POLICY "Professors can manage their quiz sessions"
ON quiz_sessions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM quizzes q
    JOIN courses c ON q.course_id = c.id
    WHERE q.id = quiz_sessions.quiz_id
    AND c.professor_id = auth.uid()
  )
);

-- Students can view sessions they're enrolled in
CREATE POLICY "Students can view sessions for enrolled courses"
ON quiz_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM quizzes q
    JOIN enrollments e ON q.course_id = e.course_id
    WHERE q.id = quiz_sessions.quiz_id
    AND e.student_id = auth.uid()
  )
);

-- Admins can view all sessions
CREATE POLICY "Admins can view all sessions"
ON quiz_sessions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- 6. RLS Policies for session_participants

-- Professors can manage participants in their sessions
CREATE POLICY "Professors can manage session participants"
ON session_participants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM quiz_sessions qs
    JOIN quizzes q ON qs.quiz_id = q.id
    JOIN courses c ON q.course_id = c.id
    WHERE qs.id = session_participants.session_id
    AND c.professor_id = auth.uid()
  )
);

-- Students can view their own participation
CREATE POLICY "Students can view own participation"
ON session_participants FOR SELECT
USING (student_id = auth.uid());

-- Students can insert themselves into waiting queue
CREATE POLICY "Students can join waiting queue"
ON session_participants FOR INSERT
WITH CHECK (student_id = auth.uid());

-- Students can update their own status
CREATE POLICY "Students can update own status"
ON session_participants FOR UPDATE
USING (student_id = auth.uid());

-- Admins can view all participants
CREATE POLICY "Admins can view all participants"
ON session_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- 7. Enable Realtime for live updates
-- Run these commands to enable realtime subscriptions:
-- ALTER PUBLICATION supabase_realtime ADD TABLE quiz_sessions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;

-- =====================================================
-- AFTER RUNNING THIS MIGRATION:
-- 1. Go to Supabase Dashboard > Database > Replication
-- 2. Enable Realtime for: quiz_sessions, session_participants
-- =====================================================


-- ############################################################
-- ## SECTION: supabase/migrations/006_add_participant_fingerprint.sql
-- ############################################################

-- ============================================
-- Add machine_fingerprint to session_participants
-- ============================================
-- This allows tracking which machine a student used,
-- even if they were manually assigned a seat.

ALTER TABLE session_participants 
ADD COLUMN IF NOT EXISTS machine_fingerprint TEXT;

COMMENT ON COLUMN session_participants.machine_fingerprint IS 'SHA-256 hash of machine fingerprint used by student';

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_participant_fingerprint 
ON session_participants(machine_fingerprint) 
WHERE machine_fingerprint IS NOT NULL;


-- ############################################################
-- ## SECTION: INTEGRITY_TAB_LOGS_MIGRATION.sql
-- ############################################################

-- SQL Migration: Create integrity_tab_logs table for Chrome Extension URL logging
-- 
-- This table stores URL logs sent by the ProctorLess Focus Chrome extension
-- Run this in your Supabase SQL Editor

-- Create the integrity_tab_logs table
CREATE TABLE IF NOT EXISTS integrity_tab_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  ts_ms BIGINT NOT NULL,
  kind VARCHAR(32) NOT NULL DEFAULT 'ACTIVE_TAB_URL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_integrity_tab_logs_submission_id 
  ON integrity_tab_logs(submission_id);

CREATE INDEX IF NOT EXISTS idx_integrity_tab_logs_user_id 
  ON integrity_tab_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_integrity_tab_logs_created_at 
  ON integrity_tab_logs(created_at DESC);

-- Create index on (submission_id, ts_ms) for efficient ordering
CREATE INDEX IF NOT EXISTS idx_integrity_tab_logs_submission_ts 
  ON integrity_tab_logs(submission_id, ts_ms);

-- Enable RLS (Row Level Security)
ALTER TABLE integrity_tab_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view their own logs
CREATE POLICY "Students can view their own tab logs"
  ON integrity_tab_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Professors can view logs of submissions in their courses
-- (This assumes a courses/enrollments structure)
CREATE POLICY "Professors can view tab logs for their course submissions"
  ON integrity_tab_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      JOIN quizzes q ON s.quiz_id = q.id
      JOIN courses c ON q.course_id = c.id
      WHERE s.id = integrity_tab_logs.submission_id
        AND c.professor_id = auth.uid()
    )
  );

-- Policy: Only the API can insert logs (via service role)
-- Note: Service role bypasses RLS, so this is just documentation
CREATE POLICY "API can insert tab logs"
  ON integrity_tab_logs FOR INSERT
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE integrity_tab_logs IS 
'Stores URL logs from ProctorLess Focus Chrome extension. 
Each row represents a URL the student visited while their extension was armed during an exam.';

COMMENT ON COLUMN integrity_tab_logs.user_id IS 'The student who visited the URL';
COMMENT ON COLUMN integrity_tab_logs.submission_id IS 'The quiz attempt this URL log is associated with';
COMMENT ON COLUMN integrity_tab_logs.url IS 'The URL of the active tab when logged';
COMMENT ON COLUMN integrity_tab_logs.ts_ms IS 'Timestamp in milliseconds (Date.now())';
COMMENT ON COLUMN integrity_tab_logs.kind IS 'Type of event (always ACTIVE_TAB_URL for now)';
