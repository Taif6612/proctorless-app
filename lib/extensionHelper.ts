/**
 * EXTENSION INTEGRATION HELPER
 * 
 * Copy-paste these functions into your quiz page component
 * to auto-arm/disarm the extension when the quiz starts/ends
 */

// Declare chrome as a global for TypeScript
declare const chrome: any;

/**
 * Sends a message to the ProctorLess Focus extension
 * Call this when a quiz starts
 * 
 * @param {string} submissionId - The submission ID for this quiz attempt
 * @returns {Promise<boolean>} - true if extension message sent, false if extension not installed
 */
export async function armExtension(submissionId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Check if chrome is available (extension context)
  if (!('chrome' in window) || !((window as any).chrome?.runtime)) {
    console.warn('[Quiz] Chrome extension not available (not installed?)');
    return false;
  }

  return new Promise((resolve) => {
    try {
      (chrome as any).runtime.sendMessage(
        {
          action: 'setArmedState',
          armed: true,
          submissionId
        },
        (response: any) => {
          if (response?.success) {
            console.log('✅ [Quiz] Extension armed for submission:', submissionId);
            resolve(true);
          } else {
            console.log('⚠️ [Quiz] Extension arm response:', response);
            resolve(false);
          }
        }
      );
    } catch (error) {
      console.warn('[Quiz] Failed to send arm message:', error);
      resolve(false);
    }
  });
}

/**
 * Disarms the extension when quiz is submitted/ended
 * 
 * @returns {Promise<boolean>} - true if message sent successfully
 */
export async function disarmExtension(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (!('chrome' in window) || !((window as any).chrome?.runtime)) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      (chrome as any).runtime.sendMessage(
        {
          action: 'setArmedState',
          armed: false
        },
        () => {
          console.log('✅ [Quiz] Extension disarmed');
          resolve(true);
        }
      );
    } catch (error) {
      console.warn('[Quiz] Failed to disarm extension:', error);
      resolve(false);
    }
  });
}

export async function resetExtensionState(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('chrome' in window) || !((window as any).chrome?.runtime)) return false;
  return new Promise((resolve) => {
    try {
      (chrome as any).runtime.sendMessage(
        { action: 'resetState' },
        () => {
          resolve(true);
        }
      );
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Get the current armed state of the extension
 * 
 * @returns {Promise<{armed: boolean, examToken: string | null}>}
 */
export async function getExtensionState(): Promise<{ armed: boolean; examToken: string | null }> {
  if (typeof window === 'undefined') return { armed: false, examToken: null };

  if (!('chrome' in window) || !((window as any).chrome?.runtime)) {
    return { armed: false, examToken: null };
  }

  return new Promise((resolve) => {
    try {
      (chrome as any).runtime.sendMessage(
        { action: 'getArmedState' },
        (response: any) => {
          resolve({
            armed: response?.armed || false,
            examToken: response?.examToken || null
          });
        }
      );
    } catch (error) {
      resolve({ armed: false, examToken: null });
    }
  });
}

// ============================================================================
// EXAMPLE USAGE IN YOUR QUIZ COMPONENT
// ============================================================================
//
// Copy this example into your quiz page component:
// app/dashboard/quiz/[id]/page.tsx
//
// 'use client';
// import { useEffect, useState } from 'react';
// import { armExtension, disarmExtension } from '@/lib/extensionHelper';
//
// export default function QuizPage({ params }) {
//   const [submissionId, setSubmissionId] = useState(null);
//   const [extensionArmed, setExtensionArmed] = useState(false);
//
//   useEffect(() => {
//     const startQuiz = async () => {
//       // 1. Create submission in database
//       const submission = await createSubmission(params.id);
//       setSubmissionId(submission.id);
//
//       // 2. Auto-arm the extension
//       const armed = await armExtension(submission.id);
//       setExtensionArmed(armed);
//
//       if (armed) {
//         console.log('Extension armed automatically');
//       } else {
//         console.log('Extension not available (student may not have installed it)');
//       }
//     };
//     startQuiz();
//   }, [params.id]);
//
//   const handleSubmitQuiz = async () => {
//     // 1. Submit quiz answers
//     await submitQuizAnswers(submissionId);
//
//     // 2. Disarm extension
//     if (extensionArmed) {
//       await disarmExtension();
//     }
//
//     // 3. Redirect to results
//     router.push(`/dashboard/results/${params.id}`);
//   };
//
//   return (
//     <div>
//       <h1>Quiz</h1>
//       {extensionArmed && (
//         <div className="alert">
//           URL Monitoring Active: Extension is logging your browsing
//         </div>
//       )}
//       <button onClick={handleSubmitQuiz}>Submit Quiz</button>
//     </div>
//   );
// }
//

// ============================================================================
// EXAMPLE: FETCH LOGS IN RESULTS DASHBOARD
// ============================================================================
//
// Add this to app/dashboard/results/[quizId]/page.tsx:
//
// const { data: inPageLogs } = await supabase
//   .from('integrity_logs')
//   .select('*')
//   .eq('submission_id', submissionId)
//   .order('created_at', { ascending: true });
//
// const { data: extensionLogs } = await supabase
//   .from('integrity_tab_logs')
//   .select('*')
//   .eq('submission_id', submissionId)
//   .order('ts_ms', { ascending: true });
//
// Combine them:
// const allViolations = [
//   ...inPageLogs.map(log => ({
//     type: 'IN_PAGE_TAB_SWITCH',
//     data: log,
//     timestamp: new Date(log.created_at)
//   })),
//   ...extensionLogs.map(log => ({
//     type: 'EXTENSION_URL_LOG',
//     data: log,
//     timestamp: new Date(log.ts_ms)
//   }))
// ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
//
