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
