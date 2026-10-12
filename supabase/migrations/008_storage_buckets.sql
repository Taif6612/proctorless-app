-- ============================================================================
-- 008_storage_buckets.sql
-- ============================================================================
-- Creates the storage buckets the app requires.
--
-- WHY THIS EXISTS
-- Migration 002 creates only the `avatars` bucket, but the application code
-- references three:
--
--   question_banks   (13 call sites)  extracted questions, stored as JSON
--   question_assets  ( 6 call sites)  the uploaded source paper (image/PDF)
--   avatars          ( 3 call sites)  created by 002
--
-- The two question buckets were made by hand in the old project's dashboard
-- and never written into a migration. On a fresh project their absence shows
-- up as "Bucket not found" at upload time.
--
-- This is the fourth piece of dashboard-configured state missing from the
-- migrations, alongside the `courses`/`enrollments` tables, the realtime
-- publication (007), and the `question_banks` bucket.
--
-- Safe to re-run.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('question_banks',  'question_banks',  true),
  ('question_assets', 'question_assets', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- WHY public = true
-- ----------------------------------------------------------------------------
-- Both buckets are public because the code depends on it:
--
--   1. uploadQuestionAsset() in app/dashboard/actions.ts calls getPublicUrl()
--      and stores the result.
--   2. /api/gemini/extract fetches that URL server-side, and forwards it to a
--      third-party OCR service. Neither carries the user's session, so a
--      signed or private URL would fail.
--
-- SECURITY NOTE -- this is review finding #3, not an accident:
-- a public bucket means exam papers and extracted question banks are readable
-- by anyone holding (or guessing) the URL, including before the exam starts.
--
-- The correct fix is not to flip these to private, which would break the
-- upload and extract flows outright. It is to:
--   a. make both buckets private,
--   b. use createSignedUrl() with a short TTL in uploadQuestionAsset(),
--   c. have /api/gemini/extract read the object server-side with the service
--      role instead of fetching a public URL (this also closes the SSRF hole,
--      since the route would no longer fetch caller-supplied URLs).
--
-- That is application work, deliberately out of scope for this migration.
-- ============================================================================

SELECT id, name, public FROM storage.buckets ORDER BY name;
