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
