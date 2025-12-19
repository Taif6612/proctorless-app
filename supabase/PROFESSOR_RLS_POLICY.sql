-- Add RLS policy to allow reading professor info for enrolled courses
-- Run this in Supabase SQL Editor

-- Allow students to read basic user info for professors of courses they're enrolled in
CREATE POLICY "Allow students to read professor info"
ON users
FOR SELECT
USING (
  -- User can read their own data
  auth.uid() = id
  OR
  -- User can read professor data for courses they're enrolled in
  id IN (
    SELECT c.professor_id 
    FROM courses c
    JOIN enrollments e ON e.course_id = c.id
    WHERE e.student_id = auth.uid()
  )
);

-- Alternative: Create a simple view for public professor info (simpler approach)
CREATE OR REPLACE VIEW public_professors AS
SELECT 
  u.id,
  u.full_name,
  u.avatar_url
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'professor';

-- Grant select on the view
GRANT SELECT ON public_professors TO authenticated;
