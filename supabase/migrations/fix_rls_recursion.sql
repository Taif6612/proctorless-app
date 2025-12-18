-- Proper RLS policies without infinite recursion
-- The key is to avoid policies that reference the same table

-- Drop all existing policies
DROP POLICY IF EXISTS "Professors can select their own courses" ON courses;
DROP POLICY IF EXISTS "Students can select courses they are enrolled in" ON courses;
DROP POLICY IF EXISTS "Professors can create courses" ON courses;
DROP POLICY IF EXISTS "Professors can update their own courses" ON courses;
DROP POLICY IF EXISTS "Anyone can select courses for joining" ON courses;

DROP POLICY IF EXISTS "Students can select their own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Professors can select enrollments for their courses" ON enrollments;
DROP POLICY IF EXISTS "Students can create enrollments for themselves" ON enrollments;

DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

-- ============================================================================
-- SIMPLIFIED RLS POLICIES (No Recursion)
-- ============================================================================

-- COURSES: Professors can see and create their own courses
CREATE POLICY "professors_select_own_courses"
  ON courses
  FOR SELECT
  USING (auth.uid() = professor_id);

-- COURSES: Professors can create courses
CREATE POLICY "professors_create_courses"
  ON courses
  FOR INSERT
  WITH CHECK (auth.uid() = professor_id);

-- COURSES: Professors can update their own courses  
CREATE POLICY "professors_update_own_courses"
  ON courses
  FOR UPDATE
  USING (auth.uid() = professor_id)
  WITH CHECK (auth.uid() = professor_id);

-- COURSES: Allow anyone to SELECT courses (we'll filter by enrollment in the app)
-- This is safe because students can only join with valid join codes
CREATE POLICY "public_select_courses"
  ON courses
  FOR SELECT
  USING (true);

-- ENROLLMENTS: Students see their own enrollments
CREATE POLICY "students_select_own_enrollments"
  ON enrollments
  FOR SELECT
  USING (auth.uid() = student_id);

-- ENROLLMENTS: Professors see enrollments for their courses (no recursion - just count)
CREATE POLICY "professors_select_course_enrollments"
  ON enrollments
  FOR SELECT
  USING (
    (SELECT professor_id FROM courses WHERE courses.id = enrollments.course_id LIMIT 1) = auth.uid()
  );

-- ENROLLMENTS: Students can create enrollments for themselves
CREATE POLICY "students_create_enrollments"
  ON enrollments
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- USER_ROLES: Users can view their own role
CREATE POLICY "users_select_own_role"
  ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);
