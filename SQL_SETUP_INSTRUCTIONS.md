# SQL Setup Instructions for ProctorLess Quiz & Submissions

## Overview
This guide explains how to set up the `quizzes` and `submissions` tables in Supabase to support the quiz functionality with max participant limits and atomic enforcement.

## Steps

### Step 1: Go to Supabase SQL Editor
1. Open your Supabase project at [https://app.supabase.com](https://app.supabase.com)
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query** (or **+** button)

### Step 2: Copy & Paste the SQL Below

Copy the entire SQL block below and paste it into the Supabase SQL editor:

```sql
-- Create pgcrypto extension (needed for UUID generation)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  max_participants integer NULL,
  integrity_monitor_enabled boolean DEFAULT false,
  ai_grading_enabled boolean DEFAULT false,
  allowed_websites text NULL,
  question_bank_path text NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Submissions table
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz NULL,
  UNIQUE (quiz_id, student_id)
);

-- 3. Atomic RPC function for quiz join (enforces max_participants)
CREATE OR REPLACE FUNCTION public.create_submission_if_space(p_quiz_id uuid, p_student_id uuid)
RETURNS TABLE(id uuid, quiz_id uuid, student_id uuid, started_at timestamptz, submitted_at timestamptz) AS $$
DECLARE
  v_max integer;
  v_count integer;
BEGIN
  -- Lock the quiz row to prevent race conditions
  SELECT max_participants INTO v_max FROM public.quizzes WHERE id = p_quiz_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'quiz_not_found';
  END IF;

  -- Check if quiz is full
  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM public.submissions WHERE quiz_id = p_quiz_id;
    IF v_count >= v_max THEN
      RAISE EXCEPTION 'quiz_full';
    END IF;
  END IF;

  -- Prevent duplicate submissions from same student
  IF EXISTS (SELECT 1 FROM public.submissions WHERE quiz_id = p_quiz_id AND student_id = p_student_id) THEN
    RAISE EXCEPTION 'already_started';
  END IF;

  -- Create the submission
  INSERT INTO public.submissions (quiz_id, student_id, started_at)
  VALUES (p_quiz_id, p_student_id, now())
  RETURNING id, quiz_id, student_id, started_at, submitted_at INTO id, quiz_id, student_id, started_at, submitted_at;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions (allows the Next.js app to call this function)
GRANT EXECUTE ON FUNCTION public.create_submission_if_space(uuid, uuid) TO public;

-- Optional: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON public.quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON public.submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
```

### Step 3: Run the Query
1. Click the **Run** button (or press `Ctrl+Enter`)
2. Wait for the success message: "Success. No rows returned."

### Step 4: Verify the Tables
1. Go to **Table Editor** (left sidebar)
2. Check that you see:
   - `quizzes` table (with columns: id, course_id, title, max_participants, etc.)
   - `submissions` table (with columns: id, quiz_id, student_id, started_at, submitted_at)
3. Check **Functions** to verify `create_submission_if_space` exists

## What Each Part Does

- **quizzes table**: Stores quiz metadata (title, max_participants, features enabled)
- **submissions table**: Tracks which students have started which quizzes (one row per student per quiz)
- **create_submission_if_space RPC**: A database function that atomically enforces the max_participants limit. It:
  - Locks the quiz row (prevents race conditions under concurrent load)
  - Checks if the quiz is full
  - Ensures the student hasn't already started the quiz
  - Creates a new submission row
  - Returns helpful errors if any check fails

## Troubleshooting

**"Error: relation "courses" does not exist"**
- You need to create the `courses` table first (this should exist from Phase 1)

**"Error: function create_submission_if_space already exists"**
- This is fine; the query uses `CREATE OR REPLACE`, so it will just update the function

**"Quiz table created but still getting errors in the app"**
- Wait 2–3 seconds for Supabase to sync
- Clear your browser cache (hard refresh: `Ctrl+Shift+R`)
- Verify in Supabase UI that tables exist and have rows

## Testing

Once the tables are created:

1. **Create a quiz** (from your app dashboard):
   - Create a course
   - Click "Create Quiz"
   - Set Max Participants to 2 (for easy testing)

2. **Test joining the quiz**:
   - As Student 1, join the quiz (should succeed)
   - As Student 2, join the quiz (should succeed)
   - As Student 3, try to join (should fail: "This quiz is full")

3. **Check data** in Supabase Table Editor:
   - Go to `quizzes` table → verify max_participants is set
   - Go to `submissions` table → should have 2 rows (for students 1 & 2)

Done! Your quiz system is now live with atomic capacity enforcement.
