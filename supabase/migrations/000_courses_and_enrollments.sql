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
