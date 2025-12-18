/**
 * INTEGRATION EXAMPLE
 * 
 * How to modify your existing quiz page to use the Chrome extension
 * 
 * File: app/dashboard/quiz/[id]/page.tsx
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { armExtension, disarmExtension } from '@/lib/extensionHelper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface QuizPageProps {
  params: { id: string };
}

export default function QuizPage({ params }: QuizPageProps) {
  const router = useRouter();
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [extensionArmed, setExtensionArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [quizTitle, setQuizTitle] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  // ============================================================================
  // INITIALIZATION: Start quiz and auto-arm extension
  // ============================================================================
  useEffect(() => {
    const initializeQuiz = async () => {
      try {
        // 1. Get user
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        // 2. Get quiz info
        const { data: quiz } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', params.id)
          .single();

        if (!quiz) {
          alert('Quiz not found');
          router.push('/dashboard');
          return;
        }

        setQuizTitle(quiz.title || 'Untitled Quiz');

        // 3. Create submission record
        const { data: submission, error: submissionError } = await supabase
          .from('submissions')
          .insert([
            {
              quiz_id: params.id,
              user_id: user.id,
              status: 'in_progress',
              start_time: new Date().toISOString()
            }
          ])
          .select()
          .single();

        if (submissionError || !submission) {
          console.error('Failed to create submission:', submissionError);
          alert('Failed to start quiz');
          return;
        }

        setSubmissionId(submission.id);

        // 4. AUTO-ARM EXTENSION (NEW!)
        console.log('🔴 Auto-arming extension for submission:', submission.id);
        const armed = await armExtension(submission.id);

        if (armed) {
          setExtensionArmed(true);
          console.log('✅ Extension armed automatically');
        } else {
          console.log('ℹ️ Extension not available (student may not have installed it)');
          setExtensionArmed(false);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Quiz initialization error:', error);
        alert('Error starting quiz');
      }
    };

    initializeQuiz();
  }, [params.id, router]);

  // ============================================================================
  // TAB SWITCH DETECTION (existing code)
  // ============================================================================
  useEffect(() => {
    if (!submissionId) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // User switched away from tab
        console.log('⚠️ User switched tabs');

        // Log to in-page violation system (existing)
        const { error } = await supabase.from('integrity_logs').insert([
          {
            submission_id: submissionId,
            violation_type: 'tab_switch',
            referrer: 'User switched tabs (destination unknown)',
            is_allowed: false
          }
        ]);

        if (!error) {
          console.log('✅ In-page tab switch logged');
        }
      } else {
        console.log('✅ User returned to quiz tab');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [submissionId]);

  // ============================================================================
  // SUBMIT QUIZ (auto-disarm extension)
  // ============================================================================
  const handleSubmitQuiz = async () => {
    if (!submissionId) return;

    const confirmed = confirm(
      'Are you sure you want to submit? You cannot change your answers after submission.'
    );
    if (!confirmed) return;

    try {
      // 1. Update submission status
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (updateError) {
        alert('Failed to submit quiz');
        return;
      }

      // 2. AUTO-DISARM EXTENSION (NEW!)
      console.log('🔴 Auto-disarming extension');
      await disarmExtension();
      console.log('✅ Extension disarmed');

      // 3. Redirect to results
      alert('Quiz submitted successfully!');
      router.push(`/dashboard/results/${params.id}?submissionId=${submissionId}`);
    } catch (error) {
      console.error('Submit error:', error);
      alert('Error submitting quiz');
    }
  };

  // ============================================================================
  // RENDER UI
  // ============================================================================
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">{quizTitle}</h1>

          {/* Extension Status Alert */}
          {extensionArmed && (
            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔴</span>
                <div>
                  <p className="font-semibold text-red-900">Monitoring Active</p>
                  <p className="text-sm text-red-700">
                    The ProctorLess Focus extension is logging your active tab URL. Only
                    your current tab is monitored.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!extensionArmed && (
            <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-900">Extension Not Active</p>
                  <p className="text-sm text-amber-700">
                    ProctorLess Focus extension is not installed or not armed. In-page tab
                    switching is still being monitored.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quiz Content */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="space-y-6">
            {/* PLACEHOLDER: Your quiz questions go here */}
            <div className="p-4 bg-slate-50 rounded border border-slate-200">
              <h2 className="font-semibold text-slate-800 mb-2">Question 1</h2>
              <p className="text-gray-600 mb-4">This is where your quiz questions will appear.</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="radio" name="q1" value="a" /> Option A
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="q1" value="b" /> Option B
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="q1" value="c" /> Option C
                </label>
              </div>
            </div>

            {/* Add more questions as needed */}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitQuiz}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            Submit Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
