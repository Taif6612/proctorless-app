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
