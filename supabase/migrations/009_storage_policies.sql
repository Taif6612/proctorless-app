-- ============================================================================
-- 009_storage_policies.sql
-- ============================================================================
-- Row-level security policies for the question_banks and question_assets
-- buckets.
--
-- WHY THIS EXISTS
-- storage.objects has RLS enabled by default in Supabase. Migration 002
-- created policies for the `avatars` bucket only, so uploads to the two
-- question buckets are rejected with:
--
--   "new row violates row-level security policy"
--
-- Seeding via the service-role key masks this, because service_role bypasses
-- RLS entirely. The application uploads with the end user's session, which
-- does not.
--
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- question_assets  -- the uploaded source paper (image / PDF)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "question_assets_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "question_assets_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "question_assets_auth_update"   ON storage.objects;
DROP POLICY IF EXISTS "question_assets_auth_delete"   ON storage.objects;

-- Read must stay open: /api/gemini/extract fetches the public URL server-side
-- with no user session, and the third-party OCR service fetches it too.
CREATE POLICY "question_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question_assets');

CREATE POLICY "question_assets_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question_assets');

CREATE POLICY "question_assets_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'question_assets')
  WITH CHECK (bucket_id = 'question_assets');

CREATE POLICY "question_assets_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'question_assets');

-- ----------------------------------------------------------------------------
-- question_banks  -- extracted questions, stored as JSON
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "question_banks_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "question_banks_auth_insert"    ON storage.objects;
DROP POLICY IF EXISTS "question_banks_auth_update"    ON storage.objects;
DROP POLICY IF EXISTS "question_banks_auth_delete"    ON storage.objects;

CREATE POLICY "question_banks_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question_banks');

CREATE POLICY "question_banks_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question_banks');

-- saveQuestionBank() uploads with { upsert: true }, which needs UPDATE as well
-- as INSERT. Without this, re-saving a question bank fails while the first
-- save succeeds -- a confusing, intermittent-looking failure.
CREATE POLICY "question_banks_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'question_banks')
  WITH CHECK (bucket_id = 'question_banks');

CREATE POLICY "question_banks_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'question_banks');

-- ============================================================================
-- SECURITY NOTE -- these are demo-grade, deliberately
-- ============================================================================
-- "TO authenticated" means ANY logged-in user can write to these buckets,
-- including students. Combined with saveQuestionBank() having no ownership
-- check (review finding #3), a student can overwrite any quiz's question bank.
--
-- The correct policy checks ownership through the path. Question banks are
-- stored at `question_banks/<quizId>/<timestamp>.json`, so the quiz id is the
-- second path segment and can be joined back to the owning professor:
--
--   CREATE POLICY "question_banks_professor_write"
--     ON storage.objects FOR INSERT TO authenticated
--     WITH CHECK (
--       bucket_id = 'question_banks'
--       AND EXISTS (
--         SELECT 1
--         FROM public.quizzes q
--         JOIN public.courses c ON c.id = q.course_id
--         WHERE q.id::text = (storage.foldername(name))[2]
--           AND c.professor_id = auth.uid()
--       )
--     );
--
-- That belongs with the application-side ownership fix, not ahead of it --
-- tightening storage alone would still leave the server actions open.
-- ============================================================================

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
