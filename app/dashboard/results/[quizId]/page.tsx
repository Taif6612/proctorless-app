'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Results & Integrity Dashboard: app/dashboard/results/[quizId]/page.tsx
 * 
 * Professors can view:
 * - All submissions for a quiz
 * - Each student's integrity violations (tab switches)
 * - When violations occurred
 * - What referrer/website was visited
 * - Duration of tab absence
 * 
 * This is the "command center" for monitoring quiz integrity.
 */

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const quizId = params?.quizId as string;

  // State
  const [quiz, setQuiz] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [violations, setViolations] = useState<Map<string, any[]>>(new Map());
  const [extensionLogs, setExtensionLogs] = useState<Map<string, any[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [userEmails, setUserEmails] = useState<Map<string, string>>(new Map());
  const [answersBySubmission, setAnswersBySubmission] = useState<Map<string, any>>(new Map());
  const [grading, setGrading] = useState<Map<string, { score: string; feedback: string }>>(new Map());
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [gradingPer, setGradingPer] = useState<Map<string, Record<string, { score: string; feedback: string }>>>(new Map());
  const [gradingAll, setGradingAll] = useState<Map<string, boolean>>(new Map());
  const [classScores, setClassScores] = useState<number[]>([]);
  const [questionCorrect, setQuestionCorrect] = useState<number[]>([]);

  // Fetch quiz details and submissions
  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch quiz
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

        // Verify this user is the professor
        const { data: courseData } = await supabase
          .from('courses')
          .select('professor_id')
          .eq('id', quizData.course_id)
          .single();

        if (courseData?.professor_id !== user.id) {
          setError('You do not have permission to view this quiz');
          setLoading(false);
          return;
        }

        setQuiz(quizData);
        try {
          if (quizData.question_bank_path) {
            const { data: fileData } = await supabase.storage
              .from('question_banks')
              .download(quizData.question_bank_path);
            if (fileData) {
              const txt = await fileData.text();
              const obj = JSON.parse(txt);
              if (obj?.asset_url) setAssetUrl(obj.asset_url);
              const qs = Array.isArray(obj?.questions) ? obj.questions : (Array.isArray(obj) ? obj : []);
              setQuestions(qs || []);
            }
          }
        } catch { }

        // Fetch all submissions for this quiz
        const { data: submissionsData, error: submissionsError } = await supabase
          .from('submissions')
          .select('*')
          .eq('quiz_id', quizId)
          .order('started_at', { ascending: false });

        if (submissionsError) {
          console.error('Error fetching submissions:', submissionsError);
          setSubmissions([]);
        } else {
          setSubmissions(submissionsData || []);
          try {
            const sc: number[] = [];
            const perQCounts: number[] = [];
            const perQTotals: number[] = [];
            const n = (questions || []).length;
            for (let i = 0; i < n; i++) { perQCounts.push(0); perQTotals.push(0); }
            const nextGradingPer = new Map<string, any>();
            for (const submission of submissionsData || []) {
              try {
                const { data: g } = await supabase.storage.from('question_banks').download(`grades/${submission.id}.json`);
                if (g) {
                  const txt = await g.text();
                  const obj = JSON.parse(txt);
                  const tot = Number(obj?.total_score ?? 0);
                  sc.push(tot);

                  // Populate gradingPer state
                  if (obj?.per_question) {
                    nextGradingPer.set(submission.id, obj.per_question);
                  }
                } else {
                  sc.push(0);
                }
              } catch {
                sc.push(0);
              }
              try {
                const { data: a } = await supabase.storage.from('question_banks').download(`answers/${submission.id}.json`);
                if (a) {
                  const txt = await a.text();
                  const obj = JSON.parse(txt);
                  const entries = Object.entries(obj?.answers || {});
                  for (const [qi, val] of entries) {
                    const idx = Number(qi);
                    if (questions[idx] && typeof questions[idx]?.correct !== 'undefined') {
                      perQTotals[idx] += 1;
                      if (String(val) === String(questions[idx].correct)) perQCounts[idx] += 1;
                    }
                  }
                }
              } catch { }
            }
            const rates = perQTotals.map((t, i) => (t > 0 ? Math.round((perQCounts[i] / t) * 100) : 0));
            setClassScores(sc);
            setQuestionCorrect(rates);
            setGradingPer(nextGradingPer);
          } catch { }

          // Fetch violations for each submission
          if (submissionsData && submissionsData.length > 0) {
            const allViolations = new Map<string, any[]>();
            const emails = new Map<string, string>();
            const extMap = new Map<string, any[]>();

            for (const submission of submissionsData) {
              const { data: violationsData, error: violationsError } = await supabase
                .from('integrity_logs')
                .select('*')
                .eq('submission_id', submission.id)
                .order('created_at', { ascending: true });

              if (!violationsError && violationsData) {
                allViolations.set(submission.id, violationsData);
              }

              const { data: extData, error: extError } = await supabase
                .from('integrity_tab_logs')
                .select('*')
                .eq('submission_id', submission.id)
                .order('ts_ms', { ascending: true });
              if (!extError && extData) {
                extMap.set(submission.id, extData);
              }

              // Fetch student email
              const { data: authData } = await supabase.auth.admin.getUserById(submission.student_id);
              if (authData?.user?.email) {
                emails.set(submission.student_id, authData.user.email);
              }
            }

            setViolations(allViolations);
            try {
              const uniqueIds = Array.from(new Set(submissionsData.map((s: any) => s.student_id))).filter(Boolean);
              if (uniqueIds.length > 0) {
                const resp = await fetch('/api/admin/user-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: uniqueIds }) });
                const data = await resp.json().catch(() => ({ ok: false }));
                if (resp.ok && data.ok && data.map) {
                  for (const id of Object.keys(data.map)) {
                    emails.set(id, data.map[id]);
                  }
                }
              }
            } catch { }
            setUserEmails(emails);
            setExtensionLogs(extMap);
          }
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching results:', err);
        setError('Failed to load results');
        setLoading(false);
      }
    };

    fetchData();
  }, [quizId, supabase, router]);

  // Subscribe to real-time updates for violations
  useEffect(() => {
    if (!quizId) return;

    const channel = supabase
      .channel(`results_${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'integrity_logs',
        },
        (payload) => {
          // Check if this violation belongs to a submission in our quiz
          const submissionId = payload.new.submission_id;
          const submission = submissions.find((s) => s.id === submissionId);

          if (submission) {
            setViolations((prev) => {
              const updated = new Map(prev);
              const existing = updated.get(submissionId) || [];
              updated.set(submissionId, [...existing, payload.new]);
              return updated;
            });
          }
        }
      )
      .subscribe();

    const extChannel = supabase
      .channel(`results_ext_${quizId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'integrity_tab_logs',
        },
        (payload) => {
          const submissionId = payload.new.submission_id;
          const submission = submissions.find((s) => s.id === submissionId);
          if (submission) {
            setExtensionLogs((prev) => {
              const updated = new Map(prev);
              const existing = updated.get(submissionId) || [];
              updated.set(submissionId, [...existing, payload.new]);
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(extChannel);
    };
  }, [quizId, submissions, supabase]);

  // Calculate violation duration (time between consecutive tab switches)
  const calculateDuration = (violations: any[], index: number) => {
    if (index >= violations.length - 1) return null; // Last violation, no duration

    const current = new Date(violations[index].created_at);
    const next = new Date(violations[index + 1].created_at);
    const diffMs = next.getTime() - current.getTime();
    const diffMinutes = Math.round(diffMs / 60000);

    return diffMinutes;
  };

  // Format timestamp
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  // Get violation badge color
  const getViolationColor = (isAllowed: boolean) => {
    return isAllowed ? 'bg-yellow-100 border-yellow-300 text-yellow-900' : 'bg-red-100 border-red-300 text-red-900';
  };

  // Get violation status badge
  const getViolationStatus = (isAllowed: boolean) => {
    return isAllowed ? '⚠️ Allowed Domain' : '🚨 Unauthorized Tab';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading results...</p>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">{quiz?.title}</h1>
          <p className="text-slate-600">
            <span className="font-semibold">{submissions.length}</span> submission(s) • Integrity Monitoring:{' '}
            <span className={quiz?.integrity_monitor_enabled ? 'text-green-600 font-semibold' : 'text-slate-500'}>
              {quiz?.integrity_monitor_enabled ? '✓ Enabled' : '✗ Disabled'}
            </span>
          </p>
          <div className="mt-3">
            <a
              href={`/dashboard/quiz/${quizId}/edit`}
              className="inline-flex items-center px-3 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 text-sm"
            >
              Edit quiz
            </a>
          </div>
          {assetUrl && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Question Source</p>
              <a href={assetUrl} target="_blank" className="text-xs text-blue-700 underline">Open original</a>
              <div className="mt-2">
                <img src={assetUrl} alt="Question source" className="max-h-64 rounded border" />
              </div>
            </div>
          )}
        </div>

        {/* No submissions */}
        {submissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <p className="text-slate-600">No submissions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Submissions list */}
            {submissions.map((submission) => {
              const submissionViolations = violations.get(submission.id) || [];
              const submissionExtLogs = extensionLogs.get(submission.id) || [];
              const isExpanded = expandedStudent === submission.id;
              const studentEmail = userEmails.get(submission.student_id) || 'Unknown Student';

              const loadAnswers = async () => {
                const sid = submission.id as string;
                if (answersBySubmission.has(sid)) return;
                try {
                  const { data: file } = await supabase.storage
                    .from('question_banks')
                    .download(`answers/${sid}.json`);
                  if (file) {
                    const txt = await file.text();
                    const obj = JSON.parse(txt);
                    setAnswersBySubmission((prev) => {
                      const next = new Map(prev);
                      next.set(sid, obj);
                      return next;
                    });
                  }
                } catch { }
              };
              const onExpandClick = async () => {
                const nextExpanded = isExpanded ? null : submission.id;
                setExpandedStudent(nextExpanded);
                if (!isExpanded) await loadAnswers();
              };
              const gradingState = grading.get(submission.id) || { score: '', feedback: '' };
              return (
                <div
                  key={submission.id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                >
                  {/* Submission header (clickable) */}
                  <button
                    onClick={onExpandClick}
                    className="w-full text-left px-6 py-4 hover:bg-slate-50 transition flex items-center justify-between border-b border-slate-200"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{studentEmail}</h3>
                      <p className="text-sm text-slate-600">
                        Started: {formatTime(submission.started_at)}
                        {submission.submitted_at && (
                          <>
                            {' • '}
                            <span className="text-green-600">
                              Submitted: {formatTime(submission.submitted_at)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Violation badge */}
                    <div className="ml-4 text-right">
                      <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 border border-blue-300 text-blue-900">
                        {submissionViolations.length} violation(s)
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {isExpanded ? '▼ Click to collapse' : '▶ Click to expand'}
                      </p>
                    </div>
                  </button>

                  {/* Expanded view: violations */}
                  {isExpanded && (
                    <div className="px-6 py-4 bg-slate-50">
                      {submissionViolations.length === 0 ? (
                        <p className="text-slate-600 text-sm">✓ No integrity violations detected.</p>
                      ) : (
                        <div className="space-y-3">
                          <p className="font-semibold text-slate-900 mb-3">
                            Integrity Violations ({submissionViolations.length})
                          </p>
                          {submissionViolations.map((violation, index) => {
                            const duration = calculateDuration(submissionViolations, index);
                            const isUnauthorized = !violation.is_allowed;
                            const closest = (() => {
                              const logs = submissionExtLogs;
                              if (!logs || logs.length === 0) return null;
                              const vTs = new Date(violation.created_at).getTime();
                              let best = null as any;
                              let bestDiff = Infinity;
                              for (const log of logs) {
                                const d = Math.abs((new Date(log.ts_ms).getTime()) - vTs);
                                if (d < bestDiff) { bestDiff = d; best = log; }
                              }
                              if (bestDiff > 30000) return null;
                              return best;
                            })();
                            const destHost = (() => {
                              if (!closest?.url) return null;
                              try { return new URL(closest.url).hostname; } catch { return null; }
                            })();
                            const allowedDomains = (quiz?.allowed_websites || '')
                              .split(',')
                              .map((w: string) => w.trim().toLowerCase())
                              .filter((w: string) => w.length > 0);
                            const isDestAllowed = destHost ? allowedDomains.some((d: string) => destHost.toLowerCase().includes(d)) : false;

                            return (
                              <div
                                key={violation.id}
                                className={`p-4 rounded-lg border ${getViolationColor(
                                  violation.is_allowed
                                )}`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">
                                      {getViolationStatus(violation.is_allowed)}
                                    </span>
                                  </div>
                                  <span className="text-xs opacity-75">
                                    #{index + 1}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  {/* Timestamp */}
                                  <div>
                                    <p className="opacity-75 text-xs mb-1">TIMESTAMP</p>
                                    <p className="font-mono text-xs">
                                      {formatTime(violation.created_at)}
                                    </p>
                                  </div>

                                  {/* Referrer/Website */}
                                  <div>
                                    <p className="opacity-75 text-xs mb-1">TAB SWITCH DETECTED</p>
                                    <p className="font-mono text-xs break-all">
                                      {violation.referrer}
                                    </p>
                                    <p className="text-xs opacity-60 mt-1">
                                      <em>Note: We can detect tab switches but cannot determine the destination due to browser security. All tab switches are flagged.</em>
                                    </p>
                                    {destHost && (
                                      <p className="text-xs mt-1">
                                        Destination: <span className="font-mono">{destHost}</span> {isDestAllowed ? '(Allowed)' : '(Flagged)'}
                                      </p>
                                    )}
                                  </div>

                                  {/* Duration */}
                                  {duration !== null && (
                                    <div>
                                      <p className="opacity-75 text-xs mb-1">
                                        DURATION OFF QUIZ
                                      </p>
                                      <p className="font-semibold">
                                        {duration} minute{duration !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                  )}

                                  {/* Status */}
                                  <div>
                                    <p className="opacity-75 text-xs mb-1">STATUS</p>
                                    <p className="font-semibold">
                                      {violation.is_allowed ? 'Allowed' : 'Flagged'}
                                    </p>
                                  </div>
                                </div>

                                {/* Severity indicator */}
                                {isUnauthorized && (
                                  <div className="mt-3 p-2 bg-red-200 bg-opacity-50 rounded text-xs font-medium">
                                    ⚠️ Student accessed unauthorized website during quiz
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-6">
                        <p className="font-semibold text-black mb-3">Extension URL Logs ({submissionExtLogs.length})</p>
                        {submissionExtLogs.length === 0 ? (
                          <p className="text-black text-sm">No extension URL logs.</p>
                        ) : (
                          <div className="space-y-2">
                            {submissionExtLogs.map((log: any, i: number) => (
                              <div key={`${log.id || i}`} className="p-3 rounded border bg-white">
                                <div className="flex justify-between">
                                  <span className="text-xs font-semibold text-black">EXTENSION_URL_LOG</span>
                                  <span className="text-xs text-black">{new Date(log.ts_ms).toLocaleString()}</span>
                                </div>
                                <code className="block mt-1 p-2 bg-slate-100 border border-slate-200 rounded text-black break-words">{log.url}</code>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-6">
                        <p className="font-semibold text-black mb-3">Submitted Answers</p>
                        {(() => {
                          const a = answersBySubmission.get(submission.id);
                          if (!a) return <p className="text-black text-sm">No answers file found.</p>;
                          const entries = Object.entries(a.answers || {});
                          if (entries.length === 0) return <p className="text-black text-sm">No answers recorded.</p>;
                          const per = gradingPer.get(submission.id) || {};
                          return (
                            <div className="space-y-3">
                              {entries.map(([qi, val]) => {
                                const idx = Number(qi);
                                const prompt = questions[idx]?.prompt || `Question ${idx + 1}`;
                                const current = per[qi] || { score: '', feedback: '' };
                                return (
                                  <div key={qi} className="p-3 rounded border bg-white fade-in">
                                    <p className="text-sm font-semibold text-black">{prompt}</p>
                                    <p className="text-sm text-black"><span className="font-mono">Answer:</span> <span className="break-words">{String(val)}</span></p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                      <div>
                                        <label className="text-xs text-black">Score</label>
                                        <input
                                          type="number"
                                          value={current.score}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setGradingPer((prev) => {
                                              const next = new Map(prev);
                                              const obj = { ...(next.get(submission.id) || {}) };
                                              obj[qi] = { ...(obj[qi] || { score: '', feedback: '' }), score: v };
                                              next.set(submission.id, obj);
                                              return next;
                                            });
                                          }}
                                          className="w-full px-3 py-2 border border-slate-300 rounded text-black"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-black">Feedback</label>
                                        <textarea
                                          value={current.feedback}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setGradingPer((prev) => {
                                              const next = new Map(prev);
                                              const obj = { ...(next.get(submission.id) || {}) };
                                              obj[qi] = { ...(obj[qi] || { score: '', feedback: '' }), feedback: v };
                                              next.set(submission.id, obj);
                                              return next;
                                            });
                                          }}
                                          className="w-full px-3 py-2 border border-slate-300 rounded h-20 text-black"
                                        />
                                      </div>
                                      <div>
                                        <button
                                          onClick={async () => {
                                            try {
                                              const studentAnswer = String(val ?? '');
                                              const correctAnswer = String(questions[idx]?.correct ?? '');
                                              const { data, error } = await supabase.functions.invoke<{ score: number; feedback: string }>('ai-grader', {
                                                body: { studentAnswer, correctAnswer },
                                              });
                                              if (error) {
                                                alert('AI grading failed');
                                                return;
                                              }
                                              const score = Number(data?.score ?? 0);
                                              const feedback = String(data?.feedback ?? '');
                                              setGradingPer((prev) => {
                                                const next = new Map(prev);
                                                const obj = { ...(next.get(submission.id) || {}) };
                                                obj[qi] = { score: String(score), feedback };
                                                next.set(submission.id, obj);
                                                return next;
                                              });
                                            } catch {
                                              alert('AI grading error');
                                            }
                                          }}
                                          className="mt-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                        >
                                          Grade with AI
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="mt-6">
                        <p className="font-semibold text-black mb-3">Save Per-Question Grades</p>
                        {(() => {
                          const per = gradingPer.get(submission.id) || {};
                          const totalScore = Object.values(per).reduce((s, v: any) => s + (Number(v?.score) || 0), 0);
                          const totalMax = questions.reduce((s: number, q: any) => s + (typeof q?.max_marks === 'number' ? q.max_marks : 0), 0);
                          return (
                            <p className="text-sm text-black mb-2">Total: <span className="font-mono">{totalScore}</span>{totalMax > 0 ? ` / ${totalMax}` : ''}</p>
                          );
                        })()}
                        <div className="mt-3 flex gap-3 flex-wrap">
                          <button
                            onClick={async () => {
                              setGradingAll((prev) => {
                                const next = new Map(prev);
                                next.set(submission.id, true);
                                return next;
                              });
                              try {
                                const a = answersBySubmission.get(submission.id);
                                if (!a) { alert('No answers file'); return; }
                                const entries = Object.entries(a.answers || {});
                                const results = await Promise.all(entries.map(async ([qi, val]) => {
                                  const idx = Number(qi);
                                  const studentAnswer = String(val ?? '');
                                  const correctAnswer = String(questions[idx]?.correct ?? '');
                                  const { data, error } = await supabase.functions.invoke<{ score: number; feedback: string }>('ai-grader', { body: { studentAnswer, correctAnswer } });
                                  if (error) return { score: 0, feedback: '' } as { score: number; feedback: string };
                                  return { score: Number(data?.score ?? 0), feedback: String(data?.feedback ?? '') } as { score: number; feedback: string };
                                }));
                                setGradingPer((prev) => {
                                  const next = new Map(prev);
                                  const obj = { ...(next.get(submission.id) || {}) } as Record<string, { score: string; feedback: string }>;
                                  entries.forEach(([qi], i) => {
                                    const idx = Number(qi);
                                    const max = typeof questions[idx]?.max_marks === 'number' ? Number(questions[idx].max_marks) : undefined;
                                    const s = results[i]?.score ?? 0;
                                    const finalScore = typeof max === 'number' ? Math.min(max, s) : s;
                                    obj[qi] = { score: String(finalScore), feedback: String(results[i]?.feedback ?? '') };
                                  });
                                  next.set(submission.id, obj);
                                  return next;
                                });
                              } catch {
                                alert('AI grading error');
                              } finally {
                                setGradingAll((prev) => {
                                  const next = new Map(prev);
                                  next.set(submission.id, false);
                                  return next;
                                });
                              }
                            }}
                            disabled={gradingAll.get(submission.id) === true}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {gradingAll.get(submission.id) === true ? 'Grading…' : 'Grade All with AI'}
                          </button>
                          <button
                            onClick={async () => {
                              const per = gradingPer.get(submission.id) || {};
                              const totalScore = Object.values(per).reduce((s, v: any) => s + (Number(v?.score) || 0), 0);
                              const totalMax = questions.reduce((s: number, q: any) => s + (typeof q?.max_marks === 'number' ? q.max_marks : 0), 0);
                              const payload = { per_question: per, total_score: totalScore, total_max: totalMax, ts_iso: new Date().toISOString() };
                              const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                              const path = `grades/${submission.id}.json`;
                              const { error: upErr } = await supabase.storage
                                .from('question_banks')
                                .upload(path, blob, { upsert: true });
                              if (upErr) {
                                alert('Failed to save grade');
                              } else {
                                alert('Grade saved');
                              }
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            Save Grades
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary statistics */}
        {submissions.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-2">Total Submissions</p>
              <p className="text-3xl font-bold text-slate-900">{submissions.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-2">Total Violations</p>
              <p className="text-3xl font-bold text-slate-900">
                {Array.from(violations.values()).reduce((sum, v) => sum + v.length, 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-2">Students with Violations</p>
              <p className="text-3xl font-bold text-slate-900">
                {Array.from(violations.values()).filter((v) => v.length > 0).length}
              </p>
            </div>
          </div>
        )}

        {submissions.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-2">Class Average Score</p>
              <p className="text-3xl font-bold text-slate-900">{classScores.length > 0 ? Math.round((classScores.reduce((a, b) => a + b, 0) / classScores.length) * 100) / 100 : 0}</p>
              <p className="text-sm text-slate-600 mt-4">Score Distribution</p>
              <svg viewBox="0 0 400 160" className="w-full h-40 mt-2">
                <rect x="0" y="0" width="400" height="160" fill="white" />
                {(() => {
                  const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
                  const counts = bins.slice(0, -1).map((b, i) => classScores.filter((s) => s >= b && s < bins[i + 1]).length);
                  const max = Math.max(...counts, 1);
                  return counts.map((c, i) => {
                    const x = 10 + i * (360 / counts.length);
                    const h = (c / max) * 120;
                    const y = 150 - h;
                    return <rect key={i} x={x} y={y} width={12} height={h} fill="#2563eb" />;
                  });
                })()}
              </svg>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-2">Question Correctness</p>
              <svg viewBox="0 0 400 160" className="w-full h-40">
                <rect x="0" y="0" width="400" height="160" fill="white" />
                {questionCorrect.map((pct, i) => {
                  const x = 10 + i * (360 / Math.max(questionCorrect.length, 1));
                  const h = ((pct || 0) / 100) * 120;
                  const y = 150 - h;
                  return <rect key={i} x={x} y={y} width={12} height={h} fill="#10b981" />;
                })}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
