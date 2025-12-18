'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { armExtension, disarmExtension, resetExtensionState } from '@/lib/extensionHelper';

/**
 * Quiz Taker Page: app/dashboard/quiz/[id]/page.tsx
 * 
 * This is a PLACEHOLDER quiz engine. In production, it would:
 * - Load questions from the question_bank_path (JSON file)
 * - Display questions one-by-one or all at once
 * - Track student answers
 * - Submit answers to Supabase
 * 
 * For the MVP, we display:
 * - Quiz metadata (title, features enabled, allowed websites)
 * - Integrity monitoring (tab-switch detection)
 * - A placeholder "question" area
 * - Submit button
 */

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const quizId = params?.id as string;
  const viewGradesOnly = (searchParams?.get('view') || '').toLowerCase() === 'grades';

  // Quiz and submission state
  const [quiz, setQuiz] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Integrity monitoring state
  const [integrityViolations, setIntegrityViolations] = useState<any[]>([]);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [windowFocused, setWindowFocused] = useState(true);
  const [extensionLogs, setExtensionLogs] = useState<any[]>([]);

  // Quiz interaction state
  const [answers, setAnswers] = useState<{ [questionIndex: number]: string }>({});
  const [questions, setQuestions] = useState<any[]>([]);
  const [variantLoading, setVariantLoading] = useState(false);
  const [gradePer, setGradePer] = useState<Record<string, { score: number; feedback: string }>>({});
  const lastVisibilityTs = useRef<number>(0);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [settings, setSettings] = useState<{ timer_enabled: boolean; duration_minutes: number; buffer_minutes: number; original_probability: number }>({ timer_enabled: false, duration_minutes: 60, buffer_minutes: 5, original_probability: 0.2 });
  const [startTs, setStartTs] = useState<number>(0);
  const [bufferRemaining, setBufferRemaining] = useState<number>(0);
  const [quizRemaining, setQuizRemaining] = useState<number>(0);

  // Fetch quiz details on mount
  useEffect(() => {
    const fetchQuizData = async () => {
      if (!quizId) {
        setError('Quiz ID not found');
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        // Fetch quiz details
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', quizId)
          .single();

        if (quizError || !quizData) {
          setError('Quiz not found');
          setLoading(false);
          return;
        }

        setQuiz(quizData);

        // Fetch submission (should already exist from joinQuiz)
        const { data: submissionData, error: submissionError } = await supabase
          .from('submissions')
          .select('*')
          .eq('quiz_id', quizId)
          .eq('student_id', user.id)
          .single();

        if (submissionError || !submissionData) {
          setError('Submission not found. Please go back and try again.');
          setLoading(false);
          return;
        }

        setSubmission(submissionData);
        // Ensure started_at is set once per submission
        let effectiveStartedAt = submissionData.started_at ? new Date(submissionData.started_at).toISOString() : undefined;
        if (!effectiveStartedAt) {
          const nowIso = new Date().toISOString();
          const { data: updated } = await supabase
            .from('submissions')
            .update({ started_at: nowIso })
            .eq('id', submissionData.id)
            .select()
            .single();
          effectiveStartedAt = updated?.started_at || nowIso;
        }
        setStartTs(new Date(effectiveStartedAt).getTime());
        if (quizData.question_bank_path) {
          try {
            const { data: fileData, error: fileError } = await supabase.storage
              .from('question_banks')
              .download(quizData.question_bank_path);
            if (!fileError && fileData) {
              const text = await fileData.text();
              const parsed = JSON.parse(text);
              const qs = Array.isArray(parsed?.questions) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
              setQuestions(qs);
              try {
                // Load variations file
                let variationGroups: Array<{ base_prompt: string; variations: any[] }> = [];
                try {
                  const { data: vfile } = await supabase.storage
                    .from('question_banks')
                    .download(`variations/${quizId}.json`);
                  if (vfile) {
                    const vtext = await vfile.text();
                    const vobj = JSON.parse(vtext || '{}');
                    variationGroups = Array.isArray(vobj?.groups) ? vobj.groups : [];
                  }
                } catch {}

                // Check already assigned variants for this submission
                const { data: existing } = await supabase
                  .from('generated_questions')
                  .select('*')
                  .eq('submission_id', submissionData.id)
                  .order('question_index', { ascending: true });

                if (!existing || existing.length === 0) {
                  // Assign variants per question, honoring original_probability
                  const selected: any[] = [];
                  for (let i = 0; i < qs.length; i++) {
                    const q = qs[i];
                    const group = variationGroups.find(g => String(g.base_prompt || '').trim() === String(q.prompt || '').trim());
                    if (group && Array.isArray(group.variations) && group.variations.length > 0) {
                      const r = Math.random();
                      if (r < (settings.original_probability ?? 0.2)) {
                        selected.push(q);
                      } else {
                        const idx = Math.floor(Math.random() * group.variations.length);
                        const v = group.variations[idx] || {};
                        const t = String(v?.type || q.type || 'text').toLowerCase();
                        const variant = {
                          prompt: String(v?.prompt || q.prompt || ''),
                          type: t,
                          choices: Array.isArray(v?.choices) ? v.choices : q.choices,
                          max_marks: typeof v?.max_marks === 'number' ? v.max_marks : q.max_marks,
                          expected_answer: typeof v?.answer !== 'undefined' ? v.answer : q.expected_answer,
                        };
                        selected.push(variant);
                      }
                    } else {
                      selected.push(q);
                    }
                  }
                  // Persist selections
                  if (selected.length === qs.length) {
                    const rows = selected.map((v, idx) => ({ submission_id: submissionData.id, quiz_id: quizId, question_index: idx, variant: v, model: 'gemini-variants' }));
                    await supabase.from('generated_questions').insert(rows);
                    setQuestions(selected);
                  }
                } else {
                  // Load assigned variants
                  const mapped = (existing || []).sort((a: any, b: any) => a.question_index - b.question_index).map((r: any) => r.variant).filter(Boolean);
                  if (Array.isArray(mapped) && mapped.length === qs.length) setQuestions(mapped);
                }
              } catch {}
            }
          } catch {}
        }
        // Load settings
        try {
          const { data: sfile } = await supabase.storage
            .from('question_banks')
            .download(`settings/${quizId}.json`);
          if (sfile) {
            const stext = await sfile.text();
            const sobj = JSON.parse(stext);
            const st = {
              timer_enabled: !!sobj.timer_enabled,
              duration_minutes: Number(sobj.duration_minutes || 60),
              buffer_minutes: Number(sobj.buffer_minutes || 5),
              original_probability: typeof sobj.original_probability === 'number' ? sobj.original_probability : 0.2,
            };
            setSettings(st);
          }
        } catch {}
        try {
          const { data: gfile } = await supabase.storage
            .from('question_banks')
            .download(`grades/${submissionData.id}.json`);
          if (gfile) {
            const gtext = await gfile.text();
            const gobj = JSON.parse(gtext);
            const per = gobj?.per_question || {};
            const normalized: Record<string, { score: number; feedback: string }> = {};
            Object.keys(per).forEach((k) => {
              const item = per[k] || {};
              normalized[k] = { score: Number(item.score || 0), feedback: String(item.feedback || '') };
            });
            setGradePer(normalized);
          }
        } catch {}
        try {
          window.postMessage({ type: 'PROCTORLESS_SUBMISSION_ID', submissionId: submissionData.id }, '*');
        } catch {}
        try {
          await armExtension(submissionData.id);
        } catch {}
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching quiz:', err);
        setError('Failed to load quiz');
        setLoading(false);
      }
    };

    fetchQuizData();
  }, [quizId, supabase, router]);

  useEffect(() => {
    if (!submission) return;
    const key = `proctorless_answers_${submission.id}`;
    let loaded = false;
    try {
      const ls = localStorage.getItem(key);
      if (ls) {
        const obj = JSON.parse(ls || '{}');
        if (obj && typeof obj === 'object') { setAnswers(obj); loaded = true; }
      }
    } catch {}
    if (!loaded) {
      (async () => {
        try {
          const { data: dfile } = await supabase.storage
            .from('question_banks')
            .download(`drafts/${submission.id}.json`);
          if (dfile) {
            const text = await dfile.text();
            const pobj = JSON.parse(text || '{}');
            const a = pobj?.answers || {};
            if (a && typeof a === 'object') setAnswers(a);
          }
        } catch {}
      })();
    }
  }, [submission, supabase]);

  const saveTimerRef = useRef<any>(null);
  useEffect(() => {
    if (!submission) return;
    const key = `proctorless_answers_${submission.id}`;
    try { localStorage.setItem(key, JSON.stringify(answers)); } catch {}
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const payload = { answers, ts_iso: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        await supabase.storage
          .from('question_banks')
          .upload(`drafts/${submission.id}.json`, blob, { upsert: true });
      } catch {}
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [answers, submission, supabase]);

  // Timers derived from persisted startTs
  useEffect(() => {
    if (!startTs) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSec = Math.floor((now - startTs) / 1000);
      const bufferSec = (settings.buffer_minutes || 5) * 60;
      const durationSec = (settings.duration_minutes || 60) * 60;
      const bufRem = Math.max(bufferSec - elapsedSec, 0);
      const quizElapsed = Math.max(elapsedSec - bufferSec, 0);
      const quizRem = settings.timer_enabled ? Math.max(durationSec - quizElapsed, 0) : 0;
      setBufferRemaining(bufRem);
      setQuizRemaining(quizRem);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTs, settings.buffer_minutes, settings.duration_minutes, settings.timer_enabled]);

  // Fetch existing integrity violations for this submission
  useEffect(() => {
    if (!submission) return;

    const fetchViolations = async () => {
      try {
        const { data: violations, error } = await supabase
          .from('integrity_logs')
          .select('*')
          .eq('submission_id', submission.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching violations:', error);
          return;
        }

        // Convert DB records to state format
        const formattedViolations = violations?.map((v: any) => ({
          submission_id: v.submission_id,
          violation_type: v.violation_type,
          violation_timestamp: v.created_at,
          referrer: v.referrer,
          is_allowed: v.is_allowed,
        })) || [];

        setIntegrityViolations(formattedViolations);
        setTabSwitchCount(violations?.filter((v: any) => v.violation_type === 'tab_switch').length || 0);

        const { data: extData } = await supabase
          .from('integrity_tab_logs')
          .select('*')
          .eq('submission_id', submission.id)
          .order('ts_ms', { ascending: true });
        setExtensionLogs(extData || []);

        // Subscribe to real-time updates for this submission
        const channel = supabase
          .channel(`integrity_logs_${submission.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'integrity_logs',
              filter: `submission_id=eq.${submission.id}`,
            },
            (payload) => {
              console.log('New violation:', payload.new);
              const newViolation = {
                submission_id: payload.new.submission_id,
                violation_type: payload.new.violation_type,
                violation_timestamp: payload.new.created_at,
                referrer: payload.new.referrer,
                is_allowed: payload.new.is_allowed,
              };
              setIntegrityViolations((prev) => [newViolation, ...prev]);
              if (payload.new.violation_type === 'tab_switch') {
                setTabSwitchCount((prev) => prev + 1);
              }
            }
          )
          .subscribe();

        const extChannel = supabase
          .channel(`integrity_tab_logs_${submission.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'integrity_tab_logs',
              filter: `submission_id=eq.${submission.id}`,
            },
            (payload) => {
              setExtensionLogs((prev) => [...prev, payload.new]);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
          supabase.removeChannel(extChannel);
        };
      } catch (err) {
        console.error('Error fetching violations:', err);
      }
    };

    fetchViolations();
  }, [submission, supabase]);

  // Integrity monitoring: detect tab switches
  useEffect(() => {
    if (!submission || !quiz?.integrity_monitor_enabled) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        const now = Date.now();
        if (now - lastVisibilityTs.current < 800) return;
        lastVisibilityTs.current = now;
        // User switched away from tab
        console.log('🚨 Tab switch detected!');
        console.log('Current referrer:', document.referrer);
        
        const newViolationCount = tabSwitchCount + 1;
        setTabSwitchCount(newViolationCount);

        // Parse allowed websites
        const allowedWebsites = quiz?.allowed_websites
          ? quiz.allowed_websites.split(',').map((w: string) => w.trim().toLowerCase())
          : [];

        console.log('Allowed websites:', allowedWebsites);

        /**
         * IMPORTANT: document.referrer shows where the user came FROM before landing on your site.
         * When document.hidden = true, we're detecting a tab switch, but referrer doesn't tell us
         * where they switched TO (browser security prevents this).
         * 
         * Therefore, ANY tab switch is treated as potentially unauthorized unless we're checking
         * on return (when document.hidden = false). For now, we flag all switches as violations.
         */
        const isAllowed = false; // Tab switches are flagged as suspicious by default

        // Log the tab switch
        const violation = {
          submission_id: submission.id,
          violation_type: 'tab_switch',
          violation_timestamp: new Date().toISOString(),
          referrer: 'User switched tabs (destination unknown)',
          is_allowed: isAllowed,
        };

        setIntegrityViolations((prev) => [...prev, violation]);
        console.log('Tab switch violation added to state:', violation);

        // Insert into integrity_logs table
        try {
          const { error } = await supabase.from('integrity_logs').insert({
            submission_id: submission.id,
            violation_type: 'tab_switch',
            referrer: 'User switched tabs (destination unknown)',
            is_allowed: isAllowed,
          });

          if (error) {
            console.error('❌ Error logging integrity violation:', error);
          } else {
            console.log('✅ Tab switch violation logged to database');
          }
        } catch (err) {
          console.error('❌ Caught error logging integrity violation:', err);
        }
      } else {
        // User returned to tab
        console.log('✅ User returned to quiz tab');
        
        /**
         * Optional: When user returns, we could check if they were on an allowed site.
         * However, document.referrer at this point will be the quiz tab itself.
         * This is a limitation of browser APIs.
         */
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [submission, quiz, tabSwitchCount, supabase]);

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    if (bufferRemaining > 0) return; // cannot type during buffer
    if (settings.timer_enabled && quizRemaining === 0) return; // timer ended
    setAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
  };

  // Submit quiz
  const handleSubmitQuiz = async () => {
    if (!submission) return;

    if (!window.confirm('Are you sure you want to submit the quiz? You cannot change your answers after submission.')) {
      return;
    }

    setSubmittingQuiz(true);
    try {
      const payload = {
        quiz_id: quizId,
        submission_id: submission.id,
        ts_iso: new Date().toISOString(),
        answers,
        version: 1,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const path = `answers/${submission.id}.json`;
      const { error: upErr } = await supabase.storage
        .from('question_banks')
        .upload(path, blob, { upsert: true });
      if (upErr) throw upErr;
      // Update submission with submitted_at timestamp
      const { error } = await supabase
        .from('submissions')
        .update({ submitted_at: new Date().toISOString() })
        .eq('id', submission.id);

      if (error) throw error;
      try {
        await disarmExtension();
      } catch {}
      try {
        await resetExtensionState();
      } catch {}

      alert('Quiz submitted successfully!');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error submitting quiz:', err);
      alert('Failed to submit quiz');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-red-200 max-w-md w-full">
          <h2 className="text-lg font-bold text-red-600 mb-4">Error</h2>
          <p className="text-slate-700 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Go Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto p-8">
        {/* Floating Timer */}
        <div className="fixed right-6 top-24 z-50">
          <div className="bg-white rounded-lg shadow border p-4 min-w-[180px] text-center">
            <p className="text-xs font-semibold text-slate-600">Buffer</p>
            <p className="text-lg font-bold text-amber-600">{Math.floor(bufferRemaining/60)}:{String(bufferRemaining%60).padStart(2,'0')}</p>
            {settings.timer_enabled && (
              <>
                <p className="text-xs font-semibold text-slate-600 mt-2">Timer</p>
                <p className={`text-lg font-bold ${quizRemaining>0? 'text-blue-600':'text-red-600'}`}>{Math.floor(quizRemaining/60)}:{String(quizRemaining%60).padStart(2,'0')}</p>
              </>
            )}
          </div>
        </div>

        {/* Quiz Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{quiz?.title}</h1>
          <p className="text-slate-600 mb-4">Quiz ID: <span className="font-mono text-sm">{quizId}</span></p>

          {/* Quiz Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-xs font-medium text-blue-700">Integrity Monitor</p>
              <p className="text-sm text-blue-900">{quiz?.integrity_monitor_enabled ? '✓ Enabled' : '✗ Disabled'}</p>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded">
              <p className="text-xs font-medium text-purple-700">AI Grading</p>
              <p className="text-sm text-purple-900">{quiz?.ai_grading_enabled ? '✓ Enabled' : '✗ Disabled'}</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-xs font-medium text-green-700">Max Participants</p>
              <p className="text-sm text-green-900">{quiz?.max_participants || 'Unlimited'}</p>
            </div>
          </div>

          {/* Allowed Websites */}
          {quiz?.allowed_websites && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded mb-6">
              <p className="text-xs font-medium text-amber-700 mb-1">Allowed Websites (for Tab Switch):</p>
              <p className="text-sm text-amber-900 font-mono">{quiz.allowed_websites}</p>
            </div>
          )}
        </div>

        {/* Integrity Monitoring Status */}
        {quiz?.integrity_monitor_enabled && (
          <div className={`rounded-lg shadow-sm border p-4 mb-8 ${tabSwitchCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <h3 className={`font-semibold mb-2 ${tabSwitchCount > 0 ? 'text-red-900' : 'text-green-900'}`}>
              Integrity Status
            </h3>
            <p className={`text-sm ${tabSwitchCount > 0 ? 'text-red-700' : 'text-green-700'}`}>
              Tab switches detected: <span className="font-bold">{tabSwitchCount}</span>
            </p>
            {tabSwitchCount > 0 && (
              <div className="mt-3 text-xs text-red-700">
                <p className="font-medium mb-1">Violations logged:</p>
                <ul className="list-disc list-inside space-y-1">
                  {integrityViolations.map((v, i) => {
                    const vTs = new Date(v.violation_timestamp).getTime();
                    let best: any = null;
                    let bestDiff = Infinity;
                    for (const log of extensionLogs) {
                      const d = Math.abs(new Date(log.ts_ms).getTime() - vTs);
                      if (d < bestDiff) { bestDiff = d; best = log; }
                    }
                    const destHost = best?.url ? (() => { try { return new URL(best.url).hostname; } catch { return null; } })() : null;
                    const allowedDomains = (quiz?.allowed_websites || '')
                      .split(',')
                      .map((w: string) => w.trim().toLowerCase())
                      .filter((w: string) => w.length > 0);
                    const isDestAllowed = destHost ? allowedDomains.some((d: string) => destHost.toLowerCase().includes(d)) : false;
                    return (
                      <li key={i}>
                        {v.violation_type} at {new Date(v.violation_timestamp).toLocaleTimeString()}
                        {v.referrer && ` (referrer: ${v.referrer})`}
                        {destHost && ` • Destination: ${destHost} ${isDestAllowed ? '(Allowed)' : '(Flagged)'}`}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Extension URL Logs */}
        {Array.isArray(extensionLogs) && extensionLogs.length > 0 && (
          <div className="rounded-lg shadow-sm border p-4 mb-8 bg-white">
            <h3 className="font-semibold mb-3 text-black">Extension URL Logs ({extensionLogs.length})</h3>
            <div className="space-y-4">
              {extensionLogs.map((log: any, i: number) => (
                <div key={i} className="text-sm">
                  <p className="text-black font-semibold">EXTENSION_URL_LOG</p>
                  <p className="text-black">{new Date(log.ts_ms).toLocaleString()}</p>
                  <code className="block mt-1 p-2 bg-slate-100 border border-slate-200 rounded text-black break-words">
                    {log.url}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {!viewGradesOnly && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Quiz Questions</h2>
            {questions.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-slate-800 text-sm">No questions found in the question bank. Please contact your instructor.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((q: any, idx: number) => {
                  const type = (q?.type || 'text').toLowerCase();
                  const prompt = q?.prompt || `Question ${idx + 1}`;
                  const choices = Array.isArray(q?.choices) ? q.choices : [];
                  const key = idx;
                  return (
                    <div key={key} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <h3 className="font-semibold text-slate-900 mb-2">{prompt}</h3>
                      {typeof q?.max_marks === 'number' && (
                        <p className="text-xs text-slate-600 mb-2">Max Marks: <span className="font-mono">{q.max_marks}</span></p>
                      )}
                      {type === 'mcq' && choices.length > 0 ? (
                        <div className="space-y-2">
                      {choices.map((c: string, ci: number) => (
                        <label key={ci} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`q_${key}`}
                            value={c}
                            checked={(answers[key] || '') === c}
                            onChange={(e) => handleAnswerChange(key, e.target.value)}
                            disabled={bufferRemaining>0 || (settings.timer_enabled && quizRemaining===0)}
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                        </div>
                      ) : type === 'boolean' ? (
                        <div className="space-y-2">
                          {['True', 'False'].map((c) => (
                            <label key={c} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                name={`q_${key}`}
                                value={c}
                                checked={(answers[key] || '') === c}
                                onChange={(e) => handleAnswerChange(key, e.target.value)}
                              />
                              <span>{c}</span>
                            </label>
                          ))}
                        </div>
                      ) : type === 'numeric' ? (
                        <input
                          type="number"
                          value={answers[key] || ''}
                          onChange={(e) => handleAnswerChange(key, e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={bufferRemaining>0 || (settings.timer_enabled && quizRemaining===0)}
                        />
                      ) : (
                        <textarea
                          value={answers[key] || ''}
                          onChange={(e) => handleAnswerChange(key, e.target.value)}
                          placeholder="Type your answer here..."
                          className="w-full h-24 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={bufferRemaining>0 || (settings.timer_enabled && quizRemaining===0)}
                        />
                      )}
                      {submission?.submitted_at && (() => {
                        const hasCorrect = (
                          (type === 'mcq' && Array.isArray(q?.choices) && typeof q?.correct_index === 'number' && q.choices[q.correct_index] !== undefined) ||
                          (type === 'boolean' && (typeof q?.correct_index === 'number' || (q?.expected_answer !== undefined && q?.expected_answer !== ''))) ||
                          (type === 'numeric' && q?.expected_answer !== undefined && q?.expected_answer !== '') ||
                          (type === 'text' && q?.expected_answer !== undefined && q?.expected_answer !== '')
                        );
                        if (!hasCorrect) return null;
                        return (
                          <div className="mt-3 p-2 bg-white rounded border text-xs">
                            <p className="text-black font-semibold">Correct Answer</p>
                            <p className="text-black break-words">
                              {(() => {
                                if (type === 'mcq' && Array.isArray(q?.choices) && typeof q?.correct_index === 'number') {
                                  const ci = q.correct_index;
                                  return q.choices?.[ci];
                                }
                                if (type === 'boolean') {
                                  if (typeof q?.correct_index === 'number') return ['True','False'][q.correct_index];
                                  return q?.expected_answer as any;
                                }
                                if (type === 'numeric') return q?.expected_answer as any;
                                return q?.expected_answer as any;
                              })()}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!viewGradesOnly && (
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium"
            >
              Cancel & Return to Dashboard
            </button>
            <button
              onClick={handleSubmitQuiz}
              disabled={submittingQuiz}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:bg-green-400"
            >
              {submittingQuiz ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        )}

        {viewGradesOnly && (
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 px-4 py-3 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Submission Info */}
        <div className="mt-8 p-4 bg-slate-100 rounded-lg text-xs text-slate-600">
          <p><strong>Submission ID:</strong> <span className="font-mono">{submission?.id}</span></p>
          <p><strong>Started at:</strong> {startTs ? new Date(startTs).toLocaleString() : 'N/A'}</p>
          <p><strong>Status:</strong> {submission?.submitted_at ? 'Submitted' : 'In Progress'}</p>
        </div>

        {Object.keys(gradePer).length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-xl font-semibold text-black mb-3">Grade</h3>
            <div className="space-y-3">
              {questions.map((q: any, idx: number) => {
                const g = gradePer[String(idx)] || { score: 0, feedback: '' };
                const mm = typeof q?.max_marks === 'number' ? q.max_marks : undefined;
                return (
                  <div key={idx} className="p-3 rounded border bg-white">
                    <p className="text-sm font-semibold text-black">{q?.prompt || `Question ${idx + 1}`}</p>
                    <p className="text-sm text-black">Score: <span className="font-mono">{g.score}</span>{mm !== undefined ? ` / ${mm}` : ''}</p>
                    {g.feedback && <p className="text-sm text-black">Feedback: <span className="break-words">{g.feedback}</span></p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <p className="text-sm text-black font-semibold">
                Total: <span className="font-mono">{Object.values(gradePer).reduce((s, v) => s + (Number(v.score) || 0), 0)}</span>
                {(() => {
                  const totalMax = questions.reduce((s: number, q: any) => s + (typeof q?.max_marks === 'number' ? q.max_marks : 0), 0);
                  return totalMax > 0 ? ` / ${totalMax}` : '';
                })()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
