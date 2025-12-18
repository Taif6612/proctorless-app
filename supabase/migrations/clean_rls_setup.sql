-- Nuclear option: Drop RLS entirely and recreate cleanly

-- Disable RLS on all tables
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Now re-enable with only the working policies
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop everything just to be sure
DROP POLICY IF EXISTS "professors_select_own_courses" ON courses;
DROP POLICY IF EXISTS "professors_create_courses" ON courses;
DROP POLICY IF EXISTS "professors_update_own_courses" ON courses;
DROP POLICY IF EXISTS "public_select_courses" ON courses;

DROP POLICY IF EXISTS "students_select_own_enrollments" ON enrollments;
DROP POLICY IF EXISTS "professors_select_course_enrollments" ON enrollments;
DROP POLICY IF EXISTS "students_create_enrollments" ON enrollments;

DROP POLICY IF EXISTS "users_select_own_role" ON user_roles;

-- ============================================================================
-- Create ONLY the essential policies
-- ============================================================================

-- COURSES: Professors can SELECT their own courses
CREATE POLICY "professors_select_own_courses"
  ON courses
  FOR SELECT
  USING (auth.uid() = professor_id);

-- COURSES: Professors can INSERT (create) courses
CREATE POLICY "professors_create_courses"
  ON courses
  FOR INSERT
  WITH CHECK (auth.uid() = professor_id);

-- COURSES: Everyone can SELECT all courses (safe - join code is the gatekeeper)
CREATE POLICY "public_select_courses"
  ON courses
  FOR SELECT
  USING (true);

-- ENROLLMENTS: Students can SELECT their own enrollments
CREATE POLICY "students_select_own_enrollments"
  ON enrollments
  FOR SELECT
  USING (auth.uid() = student_id);

-- ENROLLMENTS: Students can INSERT (enroll in) courses
CREATE POLICY "students_create_enrollments"
  ON enrollments
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- USER_ROLES: Everyone can SELECT all roles (no sensitive data)
CREATE POLICY "public_select_user_roles"
  ON user_roles
  FOR SELECT
  USING (true);
