"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Generate a random 6-character alphanumeric join code
 */
function generateJoinCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Server Action: Create a new course
 */
export async function createCourse(formData: FormData) {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Auth error:", userError);
    return { error: "Not authenticated" };
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;

  if (!title || title.trim() === "") {
    return { error: "Course title is required" };
  }

  // Generate a unique join code
  const join_code = generateJoinCode();

  console.log("Creating course with:", { professor_id: user.id, title, description, join_code });

  // Insert the course
  const { data, error } = await supabase
    .from("courses")
    .insert({
      professor_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      join_code,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating course:", error);
    return { error: `Failed to create course: ${error.message}` };
  }

  console.log("Course created successfully:", data);
  return { success: true, course: data };
}

/**
 * Server Action: Join a course by join code
 */
export async function joinCourse(formData: FormData) {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  const join_code = (formData.get("join_code") as string)?.toUpperCase();

  if (!join_code || join_code.trim() === "") {
    return { error: "Join code is required" };
  }

  // Find the course with this join code
  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select("id")
    .eq("join_code", join_code)
    .single();

  if (courseError || !courseData) {
    return { error: "Invalid join code" };
  }

  // Add the student to the course
  const { error: enrollError } = await supabase
    .from("enrollments")
    .insert({
      course_id: courseData.id,
      student_id: user.id,
    });

  if (enrollError) {
    if (enrollError.code === "23505") {
      // Unique constraint violation - already enrolled
      return { error: "You are already enrolled in this course" };
    }
    console.error("Error joining course:", enrollError);
    return { error: "Failed to join course" };
  }

  return { success: true };
}

/**
 * Server Action: Delete a course
 */
export async function deleteCourse(courseId: string) {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  // First, verify the user owns this course
  const { data: courseData, error: fetchError } = await supabase
    .from("courses")
    .select("professor_id")
    .eq("id", courseId)
    .single();

  if (fetchError || !courseData) {
    return { error: "Course not found" };
  }

  if (courseData.professor_id !== user.id) {
    return { error: "You don't have permission to delete this course" };
  }

  // Delete all enrollments first (foreign key constraint)
  const { error: deleteEnrollmentsError } = await supabase
    .from("enrollments")
    .delete()
    .eq("course_id", courseId);

  if (deleteEnrollmentsError) {
    console.error("Error deleting enrollments:", deleteEnrollmentsError);
    return { error: "Failed to delete course enrollments" };
  }

  // Then delete the course
  const { error: deleteCourseError } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId);

  if (deleteCourseError) {
    console.error("Error deleting course:", deleteCourseError);
    return { error: "Failed to delete course" };
  }

  return { success: true };
}

/**
 * Server Action: Leave (delete) an enrollment for the current student
 */
export async function leaveCourse(enrollmentId: string) {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  // Verify enrollment exists and belongs to the user
  const { data: enrollment, error: fetchError } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("id", enrollmentId)
    .single();

  if (fetchError || !enrollment) {
    return { error: "Enrollment not found" };
  }

  if (enrollment.student_id !== user.id) {
    return { error: "You don't have permission to leave this course" };
  }

  const { error: deleteError } = await supabase
    .from("enrollments")
    .delete()
    .eq("id", enrollmentId);

  if (deleteError) {
    console.error("Error leaving course:", deleteError);
    return { error: "Failed to leave course" };
  }

  return { success: true };
}

/**
 * Server Action: Create a quiz for a course (stores max_participants if provided)
 * Note: requires a `quizzes` table in your database. If the table doesn't exist
 * this will return a helpful error message so you can create the table via Supabase.
 */
export async function createQuiz(formData: FormData) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: 'Not authenticated' };

  const course_id = formData.get('course_id') as string;
  const title = (formData.get('title') as string) || '';
  const max_participants_raw = formData.get('max_participants') as string | null;
  const max_participants = max_participants_raw ? parseInt(max_participants_raw, 10) : null;
  const integrity_monitor_enabled = formData.get('integrity_monitor_enabled') === 'on';
  const ai_grading_enabled = formData.get('ai_grading_enabled') === 'on';
  const allowed_websites = (formData.get('allowed_websites') as string) || null;

  if (!course_id) return { error: 'course_id is required' };
  if (!title || title.trim() === '') return { error: 'Quiz title is required' };

  try {
    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        course_id,
        title: title.trim(),
        max_participants,
        integrity_monitor_enabled,
        ai_grading_enabled,
        allowed_websites,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating quiz:', error);
      return { error: `Failed to create quiz: ${error.message}` };
    }

    return { success: true, quiz: data };
  } catch (err: any) {
    // Likely the quizzes table doesn't exist — give a helpful message
    console.error('createQuiz caught error:', err?.message || err);
    return { error: 'Failed to create quiz. Ensure your `quizzes` table exists in Supabase.' };
  }
}

/**
 * Server Action: Student joins/starts a quiz (creates a submission)
 * Enforces quizzes.max_participants by counting rows in `submissions`.
 * Returns { success: true, submission } on success or { error: string } on failure.
 */
export async function joinQuiz(quizId: string) {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: 'Not authenticated' };

  if (!quizId) return { error: 'quizId is required' };

  // Fetch quiz and its max_participants
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id, max_participants')
    .eq('id', quizId)
    .single();

  if (quizError || !quiz) {
    console.error('Error fetching quiz:', quizError);
    return { error: 'Quiz not found. Ensure the `quizzes` table exists and the id is correct.' };
  }

  const max = quiz.max_participants ?? null;

  try {
    // Try using the atomic RPC if it's available.
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_submission_if_space', {
        p_quiz_id: quizId,
        p_student_id: user.id,
      });

      if (rpcError) {
        // If RPC exists but raised one of our known exceptions (quiz_full/already_started), map messages
        const msg = (rpcError as any).message || '';
        if (msg.includes('quiz_full')) return { error: 'This quiz is full. Maximum participants reached.' };
        if (msg.includes('already_started')) return { error: 'You have already started this quiz.' };
        if (msg.includes('quiz_not_found')) return { error: 'Quiz not found.' };
        // otherwise fallthrough to non-RPC logic
      } else if (rpcData) {
        // Supabase RPC may return the inserted row as an array/object depending on config
        return { success: true, submission: rpcData };
      }
    } catch (rpcCallErr) {
      // If RPC call fails (function missing or permission), we'll fallback to JS implementation below
      console.debug('RPC create_submission_if_space not available or failed, falling back', rpcCallErr);
    }
    if (max !== null) {
      // Count current submissions for this quiz
      const { count, error: countErr } = await supabase
        .from('submissions')
        .select('id', { count: 'exact' })
        .eq('quiz_id', quizId);

      if (countErr) {
        console.error('Error counting submissions:', countErr);
        return { error: 'Unable to verify current participants. Ensure the `submissions` table exists.' };
      }

      if ((count || 0) >= max) {
        return { error: 'This quiz is full. Maximum participants reached.' };
      }
    }

    // Prevent duplicate submission by same student
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('student_id', user.id)
      .single();

    if (existing && existing.id) {
      return { error: 'You have already started this quiz.' };
    }

    // Create a new submission row (student starts the quiz)
    const { data: submission, error: insertErr } = await supabase
      .from('submissions')
      .insert({ quiz_id: quizId, student_id: user.id, started_at: new Date().toISOString() })
      .select()
      .single();

    if (insertErr) {
      console.error('Error creating submission:', insertErr);
      return { error: 'Failed to start quiz. Ensure the `submissions` table exists and is writable.' };
    }

    return { success: true, submission };
  } catch (err: any) {
    console.error('joinQuiz caught error:', err?.message || err);
    return { error: 'Unexpected error starting quiz.' };
  }
}

export async function uploadQuestionAsset(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const quiz_id = formData.get('quiz_id') as string;
  const file = formData.get('question_asset') as File | null;
  if (!quiz_id || !file) return { error: 'quiz_id and file required' };
  const path = `quiz_assets/${quiz_id}/${Date.now()}_${file.name}`;
  const { error: uploadErr } = await supabase.storage.from('question_assets').upload(path, file, { upsert: true });
  if (uploadErr) return { error: uploadErr.message };
  const { data: pub } = await supabase.storage.from('question_assets').getPublicUrl(path);
  return { success: true, path, publicUrl: pub.publicUrl };
}

export async function saveQuestionBank(quizId: string, questions: any, assetUrl?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  if (!quizId || !questions) return { error: 'quizId and questions required' };
  const payload = Array.isArray(questions) ? { asset_url: assetUrl || null, questions } : { asset_url: assetUrl || null, questions: questions };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const jsonPath = `question_banks/${quizId}/${Date.now()}.json`;
  const { error: upErr } = await supabase.storage.from('question_banks').upload(jsonPath, blob, { upsert: true });
  if (upErr) return { error: upErr.message };
  const { error: updErr } = await supabase.from('quizzes').update({ question_bank_path: jsonPath }).eq('id', quizId);
  if (updErr) return { error: updErr.message };
  return { success: true, path: jsonPath };
}

export async function deleteQuiz(quizId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('course_id')
    .eq('id', quizId)
    .single();
  if (quizError || !quiz) return { error: 'Quiz not found' };
  const { data: course } = await supabase
    .from('courses')
    .select('professor_id')
    .eq('id', quiz.course_id)
    .single();
  if (!course || course.professor_id !== user.id) return { error: 'You do not have permission to delete this quiz' };
  const { error: delErr } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', quizId);
  if (delErr) return { error: 'Failed to delete quiz' };
  return { success: true };
}
