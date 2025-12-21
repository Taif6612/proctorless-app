'use client';

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createCourse, joinCourse, deleteCourse, leaveCourse, createQuiz, joinQuiz, deleteQuiz, saveQuestionBank } from "./actions";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [profileName, setProfileName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarSrc, setAvatarSrc] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    setUser(user);

    try {
      const { data: profileRow } = await supabase
        .from('users')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      const name = (profileRow?.full_name as string) || (user.email?.split('@')[0] || '');
      const rawAvatar = (profileRow?.avatar_url as string) || '';
      setProfileName(name);
      setAvatarUrl(rawAvatar);
      if (rawAvatar) {
        if (rawAvatar.includes('/object/public/')) {
          setAvatarSrc(rawAvatar);
        } else {
          const idx = rawAvatar.indexOf('/avatars/');
          const key = idx >= 0 ? rawAvatar.substring(idx + '/avatars/'.length) : rawAvatar;
          try {
            const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(key, 600);
            setAvatarSrc(signed?.signedUrl || rawAvatar);
          } catch {
            setAvatarSrc(rawAvatar);
          }
        }
      } else {
        // Fallback: find latest avatar in storage
        try {
          const { data: files } = await supabase.storage.from('avatars').list(user.id, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });
          const f = files && files.length > 0 ? files[0] : null;
          if (f?.name) {
            const key = `${user.id}/${f.name}`;
            const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(key, 600);
            setAvatarSrc(signed?.signedUrl || '');
            setAvatarUrl(`https://placeholder/avatars/${key}`);
          } else {
            setAvatarSrc('');
          }
        } catch {
          setAvatarSrc('');
        }
      }
    } catch {
      setProfileName(user.email?.split('@')[0] || '');
      setAvatarUrl('');
      setAvatarSrc('');
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    let role = roleData?.role as string | undefined;
    if (!role && (user.email || '').toLowerCase() === 'storage12002@gmail.com') {
      role = 'admin';
    }
    setUserRole(role || null);

    if (role === "professor") {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("professor_id", user.id);
      const coursesData = data || [];
      // Attach enrollment counts for each course (small extra queries but fine for prototyping)
      const coursesWithCounts = await Promise.all(
        coursesData.map(async (course: any) => {
          const { count } = await supabase
            .from('enrollments')
            .select('id', { count: 'exact' })
            .eq('course_id', course.id);
          // Also compute submission_count across quizzes for this course
          let submissionCount = 0;
          try {
            const { data: quizzes } = await supabase
              .from('quizzes')
              .select('id')
              .eq('course_id', course.id);
            const quizIds = (quizzes || []).map((q: any) => q.id);
            if (quizIds.length > 0) {
              const { count: subCount } = await supabase
                .from('submissions')
                .select('id', { count: 'exact' })
                .in('quiz_id', quizIds);
              submissionCount = subCount || 0;
            }
          } catch (e) {
            // If quizzes/submissions tables don't exist yet, ignore — this is optional functionality
            submissionCount = 0;
          }
          return { ...course, enrollment_count: count || 0, submission_count: submissionCount };
        })
      );
      setCourses(coursesWithCounts);
    } else {
      const { data } = await supabase
        .from("enrollments")
        .select("*, courses(id, title, description, join_code)")
        .eq("student_id", user.id);
      setEnrollments(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [router, supabase, refreshTrigger]);

  // Real-time updates: subscribe to course/enrollment inserts so lists update instantly.
  useEffect(() => {
    if (!user) return;

    let channel: any = null;
    let pollInterval: any = null;

    const setupRealtime = async () => {
      try {
        // Try using Realtime/Realtime v2 channel if available
        if ((supabase as any).channel) {
          channel = (supabase as any).channel(`public:realtime-${user.id}`);

          // COURSES: INSERT, UPDATE, DELETE
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'courses' }, (payload: any) => {
            if (userRole === 'professor' && payload.new.professor_id === user.id) {
              setCourses((c) => [payload.new, ...c]);
            }
          });

          channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'courses' }, (payload: any) => {
            if (userRole === 'professor' && payload.new.professor_id === user.id) {
              setCourses((c) => c.map((course) => (course.id === payload.new.id ? payload.new : course)));
            }
          });

          channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'courses' }, (payload: any) => {
            if (userRole === 'professor' && payload.old.professor_id === user.id) {
              setCourses((c) => c.filter((course) => course.id !== payload.old.id));
            }
          });

          // ENROLLMENTS: INSERT, UPDATE, DELETE
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'enrollments' }, async (payload: any) => {
            // Student: append new enrollment if it's theirs
            if (userRole !== 'professor' && payload.new.student_id === user.id) {
              const { data } = await supabase
                .from('enrollments')
                .select('*, courses(id, title, description, join_code)')
                .eq('id', payload.new.id)
                .single();
              if (data) setEnrollments((e) => [data, ...e]);
            }

            // Professor: if an enrollment was created for one of their courses, increment the count
            if (userRole === 'professor' && payload.new) {
              setCourses((c) =>
                c.map((course) =>
                  course.id === payload.new.course_id
                    ? { ...course, enrollment_count: (course.enrollment_count || 0) + 1 }
                    : course
                )
              );
            }
          });

          channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'enrollments' }, async (payload: any) => {
            if (userRole !== 'professor' && payload.new.student_id === user.id) {
              const { data } = await supabase
                .from('enrollments')
                .select('*, courses(id, title, description, join_code)')
                .eq('id', payload.new.id)
                .single();
              if (data) setEnrollments((e) => e.map((en) => (en.id === data.id ? data : en)));
            }
          });

          channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'enrollments' }, (payload: any) => {
            // Student: remove enrollment if it belonged to them
            if (userRole !== 'professor' && payload.old.student_id === user.id) {
              setEnrollments((e) => e.filter((en) => en.id !== payload.old.id));
            }

            // Professor: if an enrollment was removed from one of their courses, decrement the count
            if (userRole === 'professor' && payload.old) {
              setCourses((c) =>
                c.map((course) =>
                  course.id === payload.old.course_id
                    ? { ...course, enrollment_count: Math.max(0, (course.enrollment_count || 1) - 1) }
                    : course
                )
              );
            }
          });

          // SUBMISSIONS: keep per-course submission_count updated in real-time for professors
          channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' }, async (payload: any) => {
            if (userRole === 'professor' && payload.new && payload.new.quiz_id) {
              try {
                const { data: quiz } = await supabase.from('quizzes').select('course_id').eq('id', payload.new.quiz_id).single();
                if (quiz && quiz.course_id) {
                  setCourses((c) => c.map((course) => course.id === quiz.course_id ? { ...course, submission_count: (course.submission_count || 0) + 1 } : course));
                }
              } catch (e) {
                // ignore if quizzes table missing
              }
            }
          });

          channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'submissions' }, async (payload: any) => {
            if (userRole === 'professor' && payload.old && payload.old.quiz_id) {
              try {
                const { data: quiz } = await supabase.from('quizzes').select('course_id').eq('id', payload.old.quiz_id).single();
                if (quiz && quiz.course_id) {
                  setCourses((c) => c.map((course) => course.id === quiz.course_id ? { ...course, submission_count: Math.max(0, (course.submission_count || 1) - 1) } : course));
                }
              } catch (e) {
                // ignore if quizzes table missing
              }
            }
          });

          channel.subscribe();
        } else {
          throw new Error('Realtime channel API not available');
        }
      } catch (err) {
        // Fallback: poll every 3 seconds
        pollInterval = setInterval(() => {
          setRefreshTrigger((t) => t + 1);
        }, 3000);
      }
    };

    setupRealtime();

    return () => {
      if (channel && channel.unsubscribe) {
        channel.unsubscribe();
      }
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [supabase, user, userRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header with logout */}
        <div className="flex justify-between items-start mb-12 fade-in">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-3">
              Dashboard
            </h1>
            <div className="flex items-center gap-4">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="Profile" className="h-12 w-12 rounded-full object-cover border" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-slate-200 border" />
              )}
              <div className="space-y-1">
                <p className="text-slate-800 font-semibold text-lg">{profileName}</p>
                <p className="text-slate-600 text-sm">{user?.email}</p>
                <p className="text-slate-500 capitalize text-xs">
                  Role: <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-full text-xs">{userRole}</span>
                </p>
              </div>
            </div>
          </div>
          <LogoutButton />
        </div>

        <div className="mb-8">
          <SummaryCards role={userRole || ''} courses={courses} enrollments={enrollments} />
        </div>

        <div className="mb-8">
          {userRole === "professor" ? (
            <ProfessorDashboard userId={user.id} courses={courses} onRefresh={() => setRefreshTrigger(t => t + 1)} />
          ) : userRole === "admin" ? (
            <AdminDashboard />
          ) : (
            <StudentDashboard userId={user.id} enrollments={enrollments} onRefresh={() => setRefreshTrigger(t => t + 1)} />
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCards({ role, courses, enrollments }: { role: string; courses: { enrollment_count?: number; submission_count?: number }[]; enrollments: unknown[] }) {
  const isProf = role === 'professor';
  const totalCourses = isProf ? (courses?.length || 0) : (enrollments?.length || 0);
  const totalEnrollments = isProf ? (courses || []).reduce((acc: number, c: any) => acc + (c.enrollment_count || 0), 0) : (enrollments?.length || 0);
  const totalParticipants = isProf ? (courses || []).reduce((acc: number, c: any) => acc + (c.submission_count || 0), 0) : 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
        <p className="text-sm text-slate-600">{isProf ? 'Courses' : 'Enrollments'}</p>
        <p className="text-3xl font-bold text-slate-900">{totalCourses}</p>
      </div>
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
        <p className="text-sm text-slate-600">{isProf ? 'Total Students' : 'Active Courses'}</p>
        <p className="text-3xl font-bold text-slate-900">{totalEnrollments}</p>
      </div>
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
        <p className="text-sm text-slate-600">{isProf ? 'Participants (all quizzes)' : 'Role'}</p>
        <p className="text-3xl font-bold text-slate-900">{isProf ? totalParticipants : (role || '-')}</p>
      </div>
    </div>
  );
}

function ProfessorDashboard({ userId, courses, onRefresh }: { userId: string; courses: any[]; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quizFormOpenFor, setQuizFormOpenFor] = useState<string | null>(null);
  const [quizSubmittingFor, setQuizSubmittingFor] = useState<string | null>(null);
  const [courseQuizzes, setCourseQuizzes] = useState<{ [courseId: string]: any[] }>({});
  const [quizzesLoadingFor, setQuizzesLoadingFor] = useState<string | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [addingQuestionsFor, setAddingQuestionsFor] = useState<string | null>(null);
  const [assetUploadingFor, setAssetUploadingFor] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<any[] | null>(null);
  const [savingQuestionsFor, setSavingQuestionsFor] = useState<string | null>(null);
  const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string | null>(null);
  // Multi-file upload state
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [masterText, setMasterText] = useState<string>("");
  const [variantCount, setVariantCount] = useState<number>(3);
  const [variantsLoadingFor, setVariantsLoadingFor] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleCreateCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createCourse(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      if (formRef.current) {
        formRef.current.reset();
      }
      // Wait for database to commit and for next query to see the data
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoading(false);
      setError(null);
      onRefresh();
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Are you sure you want to delete this course? All enrollments will be removed.")) {
      return;
    }

    setDeletingId(courseId);
    const result = await deleteCourse(courseId);

    if (result.error) {
      alert("Error: " + result.error);
    } else {
      await new Promise(resolve => setTimeout(resolve, 300));
      onRefresh();
    }
    setDeletingId(null);
  };

  const fetchQuizzesForCourse = async (courseId: string) => {
    setQuizzesLoadingFor(courseId);
    try {
      const { data, error: err } = await supabase
        .from('quizzes')
        .select('id, title, max_participants, integrity_monitor_enabled, created_at')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (err) {
        console.error('Error fetching quizzes:', err);
        setCourseQuizzes((prev) => ({ ...prev, [courseId]: [] }));
      } else {
        setCourseQuizzes((prev) => ({ ...prev, [courseId]: data || [] }));
      }
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      setCourseQuizzes((prev) => ({ ...prev, [courseId]: [] }));
    } finally {
      setQuizzesLoadingFor(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-8 hover:shadow-2xl transition-all duration-300">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Create a New Course
        </h2>
        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}
        <form ref={formRef} onSubmit={handleCreateCourse} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Course Title
            </label>
            <input
              type="text"
              name="title"
              placeholder="e.g., Introduction to Computer Science"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Course Description
            </label>
            <textarea
              name="description"
              placeholder="Describe your course..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-blue-400"
          >
            {loading ? "Creating..." : "Create Course"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Courses</h2>
        {courses && courses.length > 0 ? (
          <div className="space-y-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg border border-white/30 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
              >
                <h3 className="font-semibold text-lg text-slate-900">
                  {course.title}
                </h3>
                <p className="text-slate-600 text-sm">{course.description}</p>
                <p className="text-slate-500 text-sm mt-2">
                  Join Code: <span className="font-mono font-bold text-blue-600">{course.join_code}</span>
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  Students enrolled: <span className="font-semibold">{course.enrollment_count ?? 0}</span>
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  Quiz participants (all quizzes): <span className="font-semibold">{course.submission_count ?? 0}</span>
                </p>
                <button
                  onClick={() => handleDeleteCourse(course.id)}
                  disabled={deletingId === course.id}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId === course.id ? "Deleting..." : "Delete Course"}
                </button>
                <button
                  onClick={() => setQuizFormOpenFor(quizFormOpenFor === course.id ? null : course.id)}
                  className="mt-4 ml-3 px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition"
                >
                  {quizFormOpenFor === course.id ? 'Cancel' : 'Create Quiz'}
                </button>
                <button
                  onClick={() => fetchQuizzesForCourse(course.id)}
                  className="mt-4 ml-3 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition disabled:bg-purple-400"
                  disabled={quizzesLoadingFor === course.id}
                >
                  {quizzesLoadingFor === course.id ? 'Loading...' : 'View Quizzes'}
                </button>
                <button
                  onClick={() => router.push(`/dashboard/course/${course.id}/stats`)}
                  className="mt-4 ml-3 px-3 py-1 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 transition"
                >
                  View Stats
                </button>

                {quizFormOpenFor === course.id && (
                  <form
                    className="mt-4 space-y-3 border-t pt-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setQuizSubmittingFor(course.id);
                      const fd = new FormData(e.currentTarget as HTMLFormElement);
                      fd.set('course_id', course.id);
                      const res = await createQuiz(fd);
                      setQuizSubmittingFor(null);
                      if (res?.error) {
                        alert('Quiz creation error: ' + res.error);
                      } else {
                        alert('Quiz created');
                        setQuizFormOpenFor(null);
                        // Refresh the quizzes list
                        await fetchQuizzesForCourse(course.id);
                      }
                    }}
                  >
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Quiz Title</label>
                      <input name="title" required className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Max Participants (optional)</label>
                      <input name="max_participants" type="number" min={1} className="w-40 px-3 py-2 border rounded" />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input name="integrity_monitor_enabled" type="checkbox" className="accent-indigo-600" /> Enable Integrity Monitor</label>
                      <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input name="ai_grading_enabled" type="checkbox" className="accent-indigo-600" /> Enable AI Grading</label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Allowed websites (comma separated)</label>
                      <input name="allowed_websites" className="w-full px-3 py-2 border rounded" />
                    </div>
                    <div>
                      <button type="submit" disabled={quizSubmittingFor === course.id} className="px-3 py-1 bg-green-600 text-white rounded">
                        {quizSubmittingFor === course.id ? 'Creating...' : 'Create Quiz'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Quiz list */}
                {courseQuizzes[course.id] && courseQuizzes[course.id].length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm font-semibold text-slate-900 mb-2">Quizzes ({courseQuizzes[course.id].length})</p>
                    <div className="space-y-2">
                      {courseQuizzes[course.id].map((quiz) => (
                        <div key={quiz.id}>
                          <div className="p-3 bg-slate-100 rounded flex justify-between items-center">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">{quiz.title}</p>
                              <p className="text-xs text-slate-600">
                                {quiz.integrity_monitor_enabled && '🔒 Monitored'}
                                {quiz.max_participants && ` • Max: ${quiz.max_participants}`}
                              </p>
                            </div>
                            <button
                              onClick={() => router.push(`/dashboard/quiz/${quiz.id}/session`)}
                              className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition ml-2"
                            >
                              Session Control
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/results/${quiz.id}`)}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition ml-2"
                            >
                              View Results
                            </button>
                            <button
                              onClick={async () => {
                                setDeletingQuizId(quiz.id);
                                const res = await deleteQuiz(quiz.id);
                                if (!res?.error) {
                                  await fetchQuizzesForCourse(course.id);
                                } else {
                                  alert('Error: ' + res.error);
                                }
                                setDeletingQuizId(null);
                              }}
                              disabled={deletingQuizId === quiz.id}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition ml-2 disabled:bg-red-400"
                            >
                              {deletingQuizId === quiz.id ? 'Deleting...' : 'Delete Quiz'}
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/quiz/${quiz.id}/edit`)}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition ml-2"
                            >
                              Add Questions
                            </button>
                          </div>
                          {addingQuestionsFor === quiz.id && (
                            <div className="mt-2 p-4 bg-white border rounded-lg shadow-sm">
                              <p className="text-sm font-semibold mb-3 text-slate-800">Upload Question Sources (Multiple Files Supported)</p>

                              {/* File Input */}
                              <div className="flex items-center gap-3 mb-3">
                                <input
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx"
                                  multiple
                                  onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    setStagedFiles(prev => [...prev, ...files]);
                                    e.target.value = ''; // Reset input to allow re-selecting same files
                                  }}
                                  className="text-sm text-slate-700"
                                />
                                {stagedFiles.length > 0 && (
                                  <button
                                    onClick={() => setStagedFiles([])}
                                    className="text-xs text-red-600 hover:text-red-800"
                                  >
                                    Clear All
                                  </button>
                                )}
                              </div>

                              {/* Staged Files List */}
                              {stagedFiles.length > 0 && (
                                <div className="mb-3 bg-slate-50 rounded-lg p-3 border">
                                  <p className="text-xs text-slate-600 mb-2">{stagedFiles.length} file(s) staged</p>
                                  <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {stagedFiles.map((file, idx) => (
                                      <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                                        <div className="flex items-center gap-2">
                                          <span className="text-indigo-600">{file.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                                          <span className="text-slate-700 truncate max-w-[200px]">{file.name}</span>
                                          <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                                        </div>
                                        <button
                                          onClick={() => setStagedFiles(prev => prev.filter((_, i) => i !== idx))}
                                          className="text-red-500 hover:text-red-700 text-xs"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Progress Bar */}
                              {uploadProgress && (
                                <div className="mb-3">
                                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                                    <span>Processing: {uploadProgress.fileName}</span>
                                    <span>{uploadProgress.current}/{uploadProgress.total}</span>
                                  </div>
                                  <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div
                                      className="bg-indigo-600 h-2 rounded-full transition-all"
                                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Upload & Parse Button */}
                              <button
                                onClick={async () => {
                                  if (stagedFiles.length === 0) { alert('Select at least one file'); return; }
                                  setAssetUploadingFor(quiz.id);
                                  setParsedQuestions([]);
                                  setUploadedUrls([]);
                                  const allQuestions: any[] = [];
                                  const urls: string[] = [];

                                  try {
                                    const supabase = createBrowserSupabase();
                                    for (let i = 0; i < stagedFiles.length; i++) {
                                      const file = stagedFiles[i];
                                      setUploadProgress({ current: i + 1, total: stagedFiles.length, fileName: file.name });

                                      // Upload to Supabase
                                      const path = `quiz_assets/${quiz.id}/${Date.now()}_${file.name}`;
                                      const { error: upErr } = await supabase.storage.from('question_assets').upload(path, file, { upsert: true });
                                      if (upErr) {
                                        console.error('Upload error:', upErr.message);
                                        continue;
                                      }
                                      const { data: pub } = await supabase.storage.from('question_assets').getPublicUrl(path);
                                      urls.push(pub.publicUrl);

                                      // Parse with Gemini
                                      const resp = await fetch('/api/gemini/extract', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ fileUrl: pub.publicUrl, contentType: file.type })
                                      });
                                      const data = await resp.json().catch(() => ({ ok: false }));
                                      if (resp.ok && data.ok) {
                                        const qs = (data.questions || []).map((q: any, idx: number) => ({
                                          ...q,
                                          order_index: allQuestions.length + idx + 1
                                        }));
                                        allQuestions.push(...qs);
                                      } else {
                                        // Try OCR fallback
                                        const ocrResp = await fetch('/api/ocr/parse', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ fileUrl: pub.publicUrl })
                                        });
                                        const ocrData = await ocrResp.json().catch(() => ({ ok: false }));
                                        if (ocrResp.ok && ocrData.ok) {
                                          const qs = (ocrData.questions || []).map((q: any, idx: number) => ({
                                            ...q,
                                            order_index: allQuestions.length + idx + 1
                                          }));
                                          allQuestions.push(...qs);
                                        }
                                      }
                                    }

                                    setParsedQuestions(allQuestions);
                                    setUploadedUrls(urls);
                                    setUploadedAssetUrl(urls[0] || null);
                                    setStagedFiles([]);
                                  } catch (err) {
                                    console.error('Upload error:', err);
                                    alert('Error processing files');
                                  } finally {
                                    setAssetUploadingFor(null);
                                    setUploadProgress(null);
                                  }
                                }}
                                disabled={assetUploadingFor === quiz.id || stagedFiles.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition"
                              >
                                {assetUploadingFor === quiz.id ? 'Processing...' : `Upload & Parse ${stagedFiles.length > 0 ? `(${stagedFiles.length} files)` : ''}`}
                              </button>

                              {/* Uploaded Files Preview */}
                              {uploadedUrls.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-sm font-semibold text-slate-700">Uploaded Files ({uploadedUrls.length})</p>
                                  <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                                    {uploadedUrls.map((url, idx) => (
                                      <a key={idx} href={url} target="_blank" className="flex-shrink-0">
                                        {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                          <img src={url} alt={`File ${idx + 1}`} className="h-16 w-16 object-cover rounded border" />
                                        ) : (
                                          <div className="h-16 w-16 bg-slate-100 rounded border flex items-center justify-center text-xs text-slate-500">📄</div>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {parsedQuestions && parsedQuestions.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-sm font-semibold text-black">Parsed Questions ({parsedQuestions.length})</p>
                                  <div className="space-y-2 mt-2">
                                    {parsedQuestions.map((q: any, idx: number) => (
                                      <div key={idx} className="p-2 bg-white border rounded">
                                        <p className="text-sm font-medium text-black">{q.prompt}</p>
                                        <p className="text-xs text-black">Type: {q.type} {q.max_marks ? `• ${q.max_marks}` : ''}</p>
                                        {q.choices && q.choices.length > 0 && (
                                          <div className="text-xs mt-1 text-black">{q.choices.join(' | ')}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <textarea value={masterText} onChange={(e) => setMasterText(e.target.value)} placeholder="Enter master question text" className="col-span-2 w-full px-3 py-2 border rounded text-black" />
                                    <div className="flex items-center gap-2">
                                      <input type="number" min={1} max={10} value={variantCount} onChange={(e) => setVariantCount(parseInt(e.target.value || '3', 10))} className="w-20 px-3 py-2 border rounded text-black" />
                                      <button
                                        onClick={async () => {
                                          const base = masterText.trim() || String(parsedQuestions?.[0]?.prompt || "");
                                          if (!base) { alert('Provide master question'); return; }
                                          setVariantsLoadingFor(quiz.id);
                                          try {
                                            const resp = await fetch('/api/gemini/variations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ master: base, count: variantCount }) });
                                            const data = await resp.json().catch(() => ({ ok: false }));
                                            if (resp.ok && data.ok) {
                                              const arr = Array.isArray(data.variations) ? data.variations : [];
                                              const mapped = arr.map((v: any, i: number) => ({ order_index: (parsedQuestions?.length || 0) + i + 1, prompt: String(v?.prompt || ''), type: String(v?.type || 'text'), choices: Array.isArray(v?.choices) ? v.choices : undefined, max_marks: typeof v?.max_marks === 'number' ? v.max_marks : undefined }));
                                              setParsedQuestions([...(parsedQuestions || []), ...mapped]);
                                            } else {
                                              alert('Generation failed');
                                            }
                                          } finally {
                                            setVariantsLoadingFor(null);
                                          }
                                        }}
                                        disabled={variantsLoadingFor === quiz.id}
                                        className="px-3 py-2 bg-purple-600 text-white rounded disabled:bg-purple-400"
                                      >
                                        {variantsLoadingFor === quiz.id ? 'Generating...' : 'Generate Variations'}
                                      </button>
                                    </div>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      setSavingQuestionsFor(quiz.id);
                                      const res = await saveQuestionBank(quiz.id, parsedQuestions, uploadedAssetUrl || undefined);
                                      setSavingQuestionsFor(null);
                                      if (res?.error) { alert('Save error: ' + res.error); }
                                      else { alert('Saved'); setAddingQuestionsFor(null); await fetchQuizzesForCourse(course.id); }
                                    }}
                                    disabled={savingQuestionsFor === quiz.id}
                                    className="mt-3 px-3 py-1 bg-green-600 text-white text-sm rounded disabled:bg-green-400"
                                  >
                                    {savingQuestionsFor === quiz.id ? 'Saving...' : 'Save To Quiz'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">No courses yet. Create one above!</p>
        )}
      </div>
    </div>
  );
}

function StudentDashboard({ userId, enrollments, onRefresh }: { userId: string; enrollments: any[]; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [enrollmentQuizzes, setEnrollmentQuizzes] = useState<{ [enrollmentId: string]: any[] }>({});
  const [quizLoadingId, setQuizLoadingId] = useState<string | null>(null);
  const [takingQuizId, setTakingQuizId] = useState<string | null>(null);
  const [quizErrors, setQuizErrors] = useState<{ [quizId: string]: string }>({});
  const router = useRouter();
  const supabase = createClient();
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [myScores, setMyScores] = useState<number[]>([]);
  const [trend, setTrend] = useState<{ d: string; s: number }[]>([]);
  const [avgScore, setAvgScore] = useState<number>(0);

  // Fetch quizzes for each enrolled course
  const fetchQuizzesForEnrollment = async (enrollmentId: string, courseId: string) => {
    setQuizLoadingId(enrollmentId);
    try {
      const { data, error: err } = await supabase
        .from('quizzes')
        .select('id, title, max_participants')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setEnrollmentQuizzes((prev) => ({ ...prev, [enrollmentId]: data || [] }));
    } catch (e: any) {
      console.error('Error fetching quizzes:', e);
      setEnrollmentQuizzes((prev) => ({ ...prev, [enrollmentId]: [] }));
    } finally {
      setQuizLoadingId(null);
    }
  };

  const handleJoinCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await joinCourse(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      if (formRef.current) {
        formRef.current.reset();
      }
      // Wait for database to commit and for next query to see the data
      await new Promise(resolve => setTimeout(resolve, 500));
      setLoading(false);
      setError(null);
      onRefresh();
    }
  };

  const handleLeaveCourse = async (enrollmentId: string) => {
    if (!confirm("Are you sure you want to leave this course?")) return;

    setLeavingId(enrollmentId);
    const result = await leaveCourse(enrollmentId);

    if (result.error) {
      alert("Error: " + result.error);
    } else {
      // small wait to ensure DB state is consistent before refetch
      await new Promise((resolve) => setTimeout(resolve, 300));
      onRefresh();
    }

    setLeavingId(null);
  };

  const handleTakeQuiz = async (quizId: string) => {
    setTakingQuizId(quizId);
    setQuizErrors((prev) => ({ ...prev, [quizId]: '' }));

    const result = await joinQuiz(quizId);

    if (result.error) {
      setQuizErrors((prev) => ({ ...prev, [quizId]: result.error }));
      setTakingQuizId(null);
    } else {
      // Success: navigate to quiz taker page
      router.push(`/dashboard/quiz/${quizId}`);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase
          .from('submissions')
          .select('*')
          .eq('student_id', userId)
          .order('started_at', { ascending: true });
        const subs = data || [];
        setMySubs(subs);
        const scores: number[] = [];
        for (const s of subs) {
          try {
            const { data: g } = await supabase.storage
              .from('question_banks')
              .download(`grades/${s.id}.json`);
            if (g) {
              const txt = await g.text();
              const obj = JSON.parse(txt);
              const tot = Object.values(obj || {}).reduce((acc: number, v: any) => acc + (Number((v as any)?.score) || 0), 0);
              scores.push(tot);
            } else {
              scores.push(0);
            }
          } catch {
            scores.push(0);
          }
        }
        setMyScores(scores);
        const t = subs.map((s: any, i: number) => ({ d: new Date(s.started_at).toISOString().slice(0, 10), s: scores[i] || 0 }));
        setTrend(t);
        const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
        setAvgScore(avg);
      } catch { }
    };
    run();
  }, [supabase, userId]);

  return (
    <div className="grid grid-cols-1 gap-8">

      {/* Download Extension Button */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-900">ProctorLess Focus Extension</p>
              <p className="text-xs text-indigo-700">Required for taking quizzes with integrity monitoring</p>
            </div>
          </div>
          <a
            href="/extension/proctorless-focus-extension.zip"
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Extension
          </a>
        </div>
        <p className="text-xs text-indigo-600 mt-3">
          After downloading: Unzip → Chrome Extensions → Enable Developer Mode → Load Unpacked
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Your Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-50 p-4 rounded border">
            <p className="text-sm text-slate-600">Total Quizzes Attempted</p>
            <p className="text-3xl font-bold text-slate-900">{mySubs.length}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded border">
            <p className="text-sm text-slate-600">Average Score</p>
            <p className="text-3xl font-bold text-slate-900">{avgScore}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded border">
            <p className="text-sm text-slate-600">Latest Score</p>
            <p className="text-3xl font-bold text-slate-900">{myScores[myScores.length - 1] || 0}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-slate-600 mb-2">Performance Over Time</p>
            <svg viewBox="0 0 400 160" className="w-full h-40">
              <rect x="0" y="0" width="400" height="160" fill="white" />
              {trend.length > 1 && (() => {
                const max = Math.max(...trend.map((t) => t.s), 1);
                const pts = trend.map((t, i) => {
                  const x = (i / (trend.length - 1)) * 380 + 10;
                  const y = 150 - (t.s / max) * 140;
                  return `${x},${y}`;
                }).join(' ');
                return <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="2" />;
              })()}
            </svg>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-slate-600 mb-2">Score Distribution</p>
            <svg viewBox="0 0 400 160" className="w-full h-40">
              <rect x="0" y="0" width="400" height="160" fill="white" />
              {(() => {
                const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                const counts = bins.slice(0, -1).map((b, i) => myScores.filter((s) => s >= b && s < bins[i + 1]).length);
                const max = Math.max(...counts, 1);
                return counts.map((c, i) => {
                  const x = 10 + i * (360 / counts.length);
                  const h = (c / max) * 120;
                  const y = 150 - h;
                  return <rect key={i} x={x} y={y} width={12} height={h} fill="#10b981" />;
                });
              })()}
            </svg>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Join a Course
        </h2>
        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}
        <form ref={formRef} onSubmit={handleJoinCourse} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Course Join Code
            </label>
            <input
              type="text"
              name="join_code"
              placeholder="Enter the join code provided by your professor"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium disabled:bg-green-400"
          >
            {loading ? "Joining..." : "Join Course"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Your Courses
        </h2>
        {enrollments && enrollments.length > 0 ? (
          <div className="space-y-6">
            {enrollments.map((enrollment, idx) => (
              <div
                key={enrollment.id}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-lg text-slate-900">
                    {(enrollment.courses as any)?.title}
                  </h3>
                  <span className="text-sm text-slate-500">Enrollment #{idx + 1}</span>
                </div>
                <p className="text-slate-600 text-sm mb-2">
                  {(enrollment.courses as any)?.description}
                </p>
                <p className="text-xs text-slate-400 mb-3">Enrollment ID: <span className="font-mono">{enrollment.id}</span></p>

                {/* Quiz section */}
                <div className="bg-slate-50 p-3 rounded mt-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-slate-800 text-sm">Available Quizzes</h4>
                    <button
                      onClick={() => fetchQuizzesForEnrollment(enrollment.id, (enrollment.courses as any)?.id)}
                      disabled={quizLoadingId === enrollment.id}
                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-400"
                    >
                      {quizLoadingId === enrollment.id ? 'Loading...' : 'Load Quizzes'}
                    </button>
                  </div>

                  {enrollmentQuizzes[enrollment.id]?.length > 0 ? (
                    <div className="space-y-2">
                      {enrollmentQuizzes[enrollment.id].map((quiz: any) => (
                        <div key={quiz.id} className="bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{quiz.title}</p>
                            {quiz.max_participants && (
                              <p className="text-xs text-slate-500">Max participants: {quiz.max_participants}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleTakeQuiz(quiz.id)}
                            disabled={takingQuizId === quiz.id}
                            className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition disabled:bg-purple-400"
                          >
                            {takingQuizId === quiz.id ? 'Starting...' : 'Take Quiz'}
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/quiz/${quiz.id}/waiting`)}
                            className="ml-2 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition"
                          >
                            Join Session
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/quiz/${quiz.id}?view=grades`)}
                            className="ml-2 px-2 py-1 bg-teal-600 text-white text-xs rounded hover:bg-teal-700 transition"
                          >
                            View Grades
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : enrollmentQuizzes[enrollment.id] !== undefined ? (
                    <p className="text-xs text-slate-500 italic">No quizzes available yet.</p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Click "Load Quizzes" to see available quizzes.</p>
                  )}

                  {quizErrors[enrollment.id] && enrollmentQuizzes[enrollment.id]?.some((q: any) => q.id === Object.keys(quizErrors).find(qid => quizErrors[qid] === quizErrors[enrollment.id])) && (
                    <p className="text-xs text-red-600 mt-2 italic">Error: {Object.values(quizErrors).find(e => e)}</p>
                  )}
                </div>

                {/* Error message for quiz join failures */}
                {Object.entries(quizErrors).map(([qid, msg]) => {
                  const quiz = Object.values(enrollmentQuizzes).flat().find((q: any) => q.id === qid);
                  if (msg && quiz) {
                    return <p key={qid} className="text-xs text-red-600 mt-2 italic">{msg}</p>;
                  }
                  return null;
                })}

                <button
                  onClick={() => handleLeaveCourse(enrollment.id)}
                  disabled={leavingId === enrollment.id}
                  className="mt-3 px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition disabled:bg-yellow-300"
                >
                  {leavingId === enrollment.id ? "Leaving..." : "Leave Course"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">
            You haven't joined any courses yet. Ask your professor for a join code!
          </p>
        )}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<{ users: number; quizzes: number; submissions: number } | null>(null);
  const [instPerf, setInstPerf] = useState<{ name: string; avg: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'roles' | 'users' | 'courses' | 'quizzes'>('overview');
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [quizzesList, setQuizzesList] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const saveRole = async () => {
    setMsg('');
    try {
      if (!validEmail(email)) { setMsg('Enter a valid email'); return; }
      setSaving(true);
      const me = (await supabase.auth.getUser()).data.user?.email || '';
      const resp = await fetch('/api/admin/set-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role, actorEmail: me }) });
      const data = await resp.json().catch(() => ({ ok: false }));
      if (!resp.ok || !data.ok) { setMsg('Failed: ' + (data?.error || resp.status)); return; }
      setMsg('Saved');
    } catch (e: any) { setMsg('Error'); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const { count: users } = await supabase.from('users').select('id', { count: 'exact' });
        const { count: quizzes } = await supabase.from('quizzes').select('id', { count: 'exact' });
        const { count: submissions } = await supabase.from('submissions').select('id', { count: 'exact' });
        setCounts({ users: users || 0, quizzes: quizzes || 0, submissions: submissions || 0 });
      } catch { }
      try {
        const { data } = await supabase.from('courses').select('id, title');
        const courses = data || [];
        const perf: { name: string; avg: number }[] = [];
        for (const c of courses) {
          const { data: qs } = await supabase.from('quizzes').select('id').eq('course_id', (c as any).id);
          const qids = (qs || []).map((x: any) => x.id);
          if (qids.length === 0) { perf.push({ name: (c as any).title || 'Course', avg: 0 }); continue; }
          const { data: subs } = await supabase.from('submissions').select('id').in('quiz_id', qids);
          const sids = (subs || []).map((x: any) => x.id);
          let sum = 0;
          let cnt = 0;
          for (const sid of sids) {
            try {
              const { data: g } = await supabase.storage.from('question_banks').download(`grades/${sid}.json`);
              if (g) {
                const txt = await g.text();
                const obj = JSON.parse(txt);
                sum += Number(obj?.total_score ?? 0);
                cnt += 1;
              }
            } catch { }
          }
          const avg = cnt > 0 ? Math.round((sum / cnt) * 100) / 100 : 0;
          perf.push({ name: (c as any).title || 'Course', avg });
        }
        setInstPerf(perf);
      } catch { }
    };
    run();
  }, [supabase]);

  useEffect(() => {
    const fetchTabData = async () => {
      if (activeTab === 'courses') {
        setTabLoading(true);
        try {
          const { data, error } = await supabase
            .from('courses')
            .select('id, title, description')
            .order('created_at', { ascending: false });
          if (error) throw error;
          setCoursesList(data || []);
        } catch (e: any) {
          setCoursesList([]);
        } finally {
          setTabLoading(false);
        }
      } else if (activeTab === 'quizzes') {
        setTabLoading(true);
        try {
          const { data, error } = await supabase
            .from('quizzes')
            .select('id, title, course_id, max_participants, integrity_monitor_enabled')
            .order('created_at', { ascending: false });
          if (error) throw error;
          setQuizzesList(data || []);
        } catch (e: any) {
          setQuizzesList([]);
        } finally {
          setTabLoading(false);
        }
      }
    };
    fetchTabData();
  }, [activeTab, supabase]);

  return (
    <div className="min-h-svh w-full flex items-center justify-center p-2">
      <div className="w-full max-w-6xl relative z-10">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Admin</h1>
            <p className="text-slate-500 mt-2">Manage roles, users, courses and quizzes</p>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {(['overview', 'roles', 'users', 'courses', 'quizzes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-xl border ${activeTab === tab ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">User Email</label>
                <input
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-slate-50/50 text-slate-900"
                  placeholder="Enter user email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {!validEmail(email) && email && <p className="text-xs text-red-600">Invalid email format</p>}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Role</label>
                <select
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-slate-50/50 text-slate-900"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {msg && (
                <div className={`rounded-lg p-3 border ${msg === 'Saved' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-sm font-medium ${msg === 'Saved' ? 'text-green-600' : 'text-slate-600'}`}>{msg}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={saveRole}
                  disabled={!validEmail(email) || saving}
                  className="h-12 px-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget as HTMLFormElement;
                    const f = new FormData(form);
                    const userEmail = String(f.get('new_email') || '');
                    const userPass = String(f.get('new_password') || '');
                    const me = (await supabase.auth.getUser()).data.user?.email || '';
                    const resp = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail, password: userPass, actorEmail: me }) });
                    const out = await resp.json().catch(() => ({ ok: false }));
                    setMsg(out.ok ? 'User created' : ('Failed: ' + (out.error || resp.status)));
                  }}
                  className="bg-white p-4 rounded-lg border border-slate-300"
                >
                  <p className="text-base font-semibold text-slate-900 mb-3">Create User</p>
                  <input name="new_email" placeholder="Email" className="w-full mb-2 px-3 py-2 border border-slate-300 rounded text-slate-900 placeholder-slate-500" />
                  <input name="new_password" placeholder="Password" type="password" className="w-full mb-2 px-3 py-2 border border-slate-300 rounded text-slate-900 placeholder-slate-500" />
                  <button className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Create</button>
                </form>
                <div className="bg-white p-4 rounded-lg border border-slate-300">
                  <p className="text-base font-semibold text-slate-900 mb-3">Users (first 25)</p>
                  <button
                    onClick={async () => {
                      const me = (await supabase.auth.getUser()).data.user?.email || '';
                      const resp = await fetch('/api/admin/users');
                      const data = await resp.json().catch(() => ({ ok: false }));
                      if (!resp.ok || !data.ok) { setMsg('Failed to fetch users'); return; }
                      const list = data.users as { id: string; email: string }[];
                      const container = document.getElementById('user-list');
                      if (container) {
                        container.innerHTML = '';
                        list.forEach((u) => {
                          const row = document.createElement('div');
                          row.className = 'flex items-start justify-between bg-white border border-slate-300 rounded-lg p-3 mb-2 shadow-sm';
                          const left = document.createElement('span');
                          left.className = 'text-slate-900 text-sm break-words overflow-hidden max-w-[70%]';
                          left.textContent = u.email;
                          const btn = document.createElement('button');
                          btn.textContent = 'Delete';
                          btn.className = 'px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded focus:outline-none focus:ring-2 focus:ring-red-400';
                          btn.onclick = async () => {
                            const r = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, actorEmail: me }) });
                            const o = await r.json().catch(() => ({ ok: false }));
                            setMsg(o.ok ? 'Deleted' : ('Failed: ' + (o.error || r.status)));
                          };
                          row.appendChild(left);
                          row.appendChild(btn);
                          container.appendChild(row);
                        });
                      }
                    }}
                    className="mb-2 px-3 py-2 bg-slate-900 hover:bg-black text-white rounded"
                  >
                    Refresh List
                  </button>
                  <div id="user-list" className="max-h-64 overflow-y-auto bg-white/70 border border-slate-200 rounded p-2"></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div>
              {counts && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border p-6">
                    <p className="text-sm text-slate-600">Active Users</p>
                    <p className="text-3xl font-bold text-slate-900">{counts.users}</p>
                  </div>
                  <div className="bg-white rounded-xl border p-6">
                    <p className="text-sm text-slate-600">Total Quizzes</p>
                    <p className="text-3xl font-bold text-slate-900">{counts.quizzes}</p>
                  </div>
                  <div className="bg-white rounded-xl border p-6">
                    <p className="text-sm text-slate-600">Total Submissions</p>
                    <p className="text-3xl font-bold text-slate-900">{counts.submissions}</p>
                  </div>
                </div>
              )}
              {instPerf.length > 0 && (
                <div className="mt-6 bg-white rounded-xl border p-6">
                  <p className="text-sm text-slate-600 mb-2">Cross-Course Averages</p>
                  <svg viewBox="0 0 400 160" className="w-full h-40">
                    <rect x="0" y="0" width="400" height="160" fill="white" />
                    {(() => {
                      const max = Math.max(...instPerf.map((x) => x.avg), 1);
                      return instPerf.map((x, i) => {
                        const xPos = 10 + i * (360 / Math.max(instPerf.length, 1));
                        const h = ((x.avg || 0) / max) * 120;
                        const y = 150 - h;
                        return <rect key={i} x={xPos} y={y} width={12} height={h} fill="#f59e0b" />;
                      });
                    })()}
                  </svg>
                </div>
              )}
            </div>
          )}

          {activeTab === 'courses' && (
            <div>
              {tabLoading ? (
                <p className="text-slate-600">Loading courses...</p>
              ) : (
                <div className="space-y-3">
                  {coursesList.length === 0 && <p className="text-slate-600">No courses found.</p>}
                  {coursesList.map((c) => (
                    <div key={c.id} className="border rounded p-3">
                      <p className="font-medium text-slate-800">{c.title}</p>
                      <p className="text-xs text-slate-400">ID: <span className="font-mono">{c.id}</span></p>
                      <p className="text-slate-600 text-sm">{(c as any).description}</p>
                      <div className="mt-2">
                        <a href={`/dashboard/course/${c.id}`} className="px-3 py-1 bg-slate-800 text-white rounded">Open Course</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'quizzes' && (
            <div>
              {tabLoading ? (
                <p className="text-slate-600">Loading quizzes...</p>
              ) : (
                <div className="space-y-3">
                  {quizzesList.length === 0 && <p className="text-slate-600">No quizzes found.</p>}
                  {quizzesList.map((q) => (
                    <div key={q.id} className="border rounded p-3">
                      <p className="font-medium text-slate-800">{q.title}</p>
                      <p className="text-xs text-slate-400">ID: <span className="font-mono">{q.id}</span> · Course: <span className="font-mono">{q.course_id}</span></p>
                      <p className="text-slate-600 text-sm">Max participants: {q.max_participants ?? '—'} · Integrity: {q.integrity_monitor_enabled ? 'Enabled' : 'Disabled'}</p>
                      <div className="mt-2 flex gap-2">
                        <a href={`/dashboard/results/${q.id}`} className="px-3 py-1 bg-slate-800 text-white rounded">View Results</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:bg-red-400"
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}

