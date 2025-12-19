-- Performance Optimization Indexes
-- Run this migration in Supabase SQL Editor to improve query performance

-- =====================================================
-- INDEXES FOR FREQUENTLY QUERIED COLUMNS
-- =====================================================

-- Courses: professor queries
CREATE INDEX IF NOT EXISTS idx_courses_professor_id ON courses(professor_id);

-- Enrollments: student and course lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course ON enrollments(student_id, course_id);

-- Quizzes: course lookups
CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON quizzes(course_id);

-- Submissions: quiz and student lookups
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_student ON submissions(quiz_id, student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at) WHERE submitted_at IS NOT NULL;

-- Quiz Sessions: quiz and status lookups
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON quiz_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status ON quiz_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_status ON quiz_sessions(quiz_id, status);

-- Session Participants: session and student lookups
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_student_id ON session_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_student ON session_participants(session_id, student_id);

-- User Roles: user lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- =====================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- =====================================================

-- For live dashboard: get participants by session with seats
CREATE INDEX IF NOT EXISTS idx_participants_seated ON session_participants(session_id, seat_row, seat_column) 
WHERE seat_row IS NOT NULL;

-- For results page: submissions with scores
CREATE INDEX IF NOT EXISTS idx_submissions_completed ON submissions(quiz_id, submitted_at) 
WHERE submitted_at IS NOT NULL;

-- =====================================================
-- PERFORMANCE RECOMMENDATIONS
-- =====================================================

-- 1. The dashboard has N+1 query issues:
--    - For each course, it queries enrollments count
--    - For each course, it queries quizzes, then submissions
--    Consider using PostgreSQL functions or views to aggregate counts
--
-- 2. Use Supabase Edge Functions for heavy aggregations
--
-- 3. Enable connection pooling in Supabase project settings
--
-- 4. Consider adding EXPLAIN ANALYZE before complex queries to identify bottlenecks

-- =====================================================
-- OPTIONAL: MATERIALIZED VIEW FOR COURSE STATS
-- =====================================================

-- Uncomment if you need faster course stats (requires periodic refresh)
/*
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_course_stats AS
SELECT 
    c.id as course_id,
    c.professor_id,
    COUNT(DISTINCT e.id) as enrollment_count,
    COUNT(DISTINCT s.id) as submission_count
FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.id
LEFT JOIN quizzes q ON q.course_id = c.id
LEFT JOIN submissions s ON s.quiz_id = q.id
GROUP BY c.id, c.professor_id;

CREATE UNIQUE INDEX ON mv_course_stats(course_id);

-- Refresh periodically with: REFRESH MATERIALIZED VIEW mv_course_stats;
*/
