-- Check what policies actually exist
SELECT * FROM pg_policies WHERE tablename IN ('courses', 'enrollments', 'user_roles');

-- If that doesn't work, try this simpler approach:
-- Delete ALL policies and start completely fresh

DROP POLICY IF EXISTS "Professors can select their own courses" ON courses;
DROP POLICY IF EXISTS "Students can select courses they are enrolled in" ON courses;
DROP POLICY IF EXISTS "Professors can create courses" ON courses;
DROP POLICY IF EXISTS "Professors can update their own courses" ON courses;
DROP POLICY IF EXISTS "Anyone can select courses for joining" ON courses;
DROP POLICY IF EXISTS "professors_select_own_courses" ON courses;
DROP POLICY IF EXISTS "professors_create_courses" ON courses;
DROP POLICY IF EXISTS "professors_update_own_courses" ON courses;
DROP POLICY IF EXISTS "public_select_courses" ON courses;

DROP POLICY IF EXISTS "Students can select their own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Professors can select enrollments for their courses" ON enrollments;
DROP POLICY IF EXISTS "Students can create enrollments for themselves" ON enrollments;
DROP POLICY IF EXISTS "students_select_own_enrollments" ON enrollments;
DROP POLICY IF EXISTS "professors_select_course_enrollments" ON enrollments;
DROP POLICY IF EXISTS "students_create_enrollments" ON enrollments;

DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "users_select_own_role" ON user_roles;
DROP POLICY IF EXISTS "public_select_user_roles" ON user_roles;

-- Disable RLS completely for now
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
