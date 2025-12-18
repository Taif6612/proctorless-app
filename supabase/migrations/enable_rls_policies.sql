-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Professors can select their own courses" ON courses;
DROP POLICY IF EXISTS "Students can select courses they are enrolled in" ON courses;
DROP POLICY IF EXISTS "Professors can create courses" ON courses;
DROP POLICY IF EXISTS "Professors can update their own courses" ON courses;

DROP POLICY IF EXISTS "Students can select their own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Professors can select enrollments for their courses" ON enrollments;
DROP POLICY IF EXISTS "Students can create enrollments for themselves" ON enrollments;

DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

-- ============================================================================
-- COURSES TABLE RLS POLICIES
-- ============================================================================

-- Enable RLS on courses table (if not already enabled)
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Policy 1: Professors can SELECT their own courses
CREATE POLICY "Professors can select their own courses"
  ON courses
  FOR SELECT
  USING (
    auth.uid() = professor_id
  );

-- Policy 2: Students can SELECT courses they are enrolled in
CREATE POLICY "Students can select courses they are enrolled in"
  ON courses
  FOR SELECT
  USING (
    id IN (
      SELECT course_id FROM enrollments WHERE student_id = auth.uid()
    )
  );

-- Policy 3: Professors can CREATE courses
CREATE POLICY "Professors can create courses"
  ON courses
  FOR INSERT
  WITH CHECK (
    auth.uid() = professor_id
  );

-- Policy 4: Professors can UPDATE their own courses
CREATE POLICY "Professors can update their own courses"
  ON courses
  FOR UPDATE
  USING (
    auth.uid() = professor_id
  )
  WITH CHECK (
    auth.uid() = professor_id
  );

-- ============================================================================
-- ENROLLMENTS TABLE RLS POLICIES
-- ============================================================================

-- Enable RLS on enrollments table (if not already enabled)
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Policy 1: Students can SELECT their own enrollments
CREATE POLICY "Students can select their own enrollments"
  ON enrollments
  FOR SELECT
  USING (
    auth.uid() = student_id
  );

-- Policy 2: Professors can SELECT enrollments for their courses
CREATE POLICY "Professors can select enrollments for their courses"
  ON enrollments
  FOR SELECT
  USING (
    course_id IN (
      SELECT id FROM courses WHERE professor_id = auth.uid()
    )
  );

-- Policy 3: Students can CREATE enrollments for themselves
CREATE POLICY "Students can create enrollments for themselves"
  ON enrollments
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
  );

-- ============================================================================
-- USER_ROLES TABLE RLS POLICIES
-- ============================================================================

-- Enable RLS on user_roles table (if not already enabled)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT their own role
CREATE POLICY "Users can view their own role"
  ON user_roles
  FOR SELECT
  USING (
    auth.uid() = user_id
  );
