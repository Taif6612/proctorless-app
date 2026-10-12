-- ============================================================================
-- 007_enable_realtime.sql
-- ============================================================================
-- Adds every table the app subscribes to via postgres_changes to the
-- `supabase_realtime` publication.
--
-- WHY THIS EXISTS
-- The app already opens realtime channels for these 7 tables (see the
-- .channel(...).on('postgres_changes', ...) calls in app/dashboard/**).
-- But a table only emits change events if it belongs to the
-- `supabase_realtime` publication, and a fresh Supabase project publishes
-- nothing by default.
--
-- Symptom without this: subscriptions connect without error, no events ever
-- arrive, and the UI only updates when the page is reloaded.
--
-- On the original project this was switched on by hand in the dashboard
-- (Database -> Replication) and never written into a migration -- the same
-- class of gap as the missing `courses`/`enrollments` tables and the missing
-- `question_banks` storage bucket.
--
-- Safe to re-run: each ADD TABLE is guarded against already being published.
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'courses',
    'enrollments',
    'submissions',
    'integrity_logs',
    'integrity_tab_logs',
    'quiz_sessions',
    'session_participants'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'added % to supabase_realtime', t;
    ELSE
      RAISE NOTICE 'already published: %', t;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- REPLICA IDENTITY
-- ----------------------------------------------------------------------------
-- Realtime DELETE and UPDATE events only carry the full old row when replica
-- identity is FULL. The dashboard reads payload.old on delete
-- (app/dashboard/page.tsx) so without this, those handlers receive only the
-- primary key and silently do nothing.
ALTER TABLE public.courses              REPLICA IDENTITY FULL;
ALTER TABLE public.enrollments          REPLICA IDENTITY FULL;
ALTER TABLE public.submissions          REPLICA IDENTITY FULL;
ALTER TABLE public.integrity_logs       REPLICA IDENTITY FULL;
ALTER TABLE public.integrity_tab_logs   REPLICA IDENTITY FULL;
ALTER TABLE public.quiz_sessions        REPLICA IDENTITY FULL;
ALTER TABLE public.session_participants REPLICA IDENTITY FULL;

-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
SELECT tablename AS published_for_realtime
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;
