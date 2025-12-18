"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CourseStatsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const courseId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [submissionsByQuiz, setSubmissionsByQuiz] = useState<Record<string, any[]>>({});
  const [averages, setAverages] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: c } = await supabase.from('courses').select('*').eq('id', courseId).single();
      setCourse(c);
      const { data: qs } = await supabase.from('quizzes').select('*').eq('course_id', courseId);
      setQuizzes(qs || []);
      const byQuiz: Record<string, any[]> = {};
      const avgByQuiz: Record<string, number> = {};
      for (const q of qs || []) {
        const { data: subs } = await supabase.from('submissions').select('*').eq('quiz_id', q.id);
        byQuiz[q.id] = subs || [];
        let scores: number[] = [];
        for (const s of subs || []) {
          if (typeof s.score === 'number') {
            scores.push(Number(s.score));
          } else {
            try {
              const path = `grades/${s.id}.json`;
              const { data: gf } = await supabase.storage.from('question_banks').download(path);
              if (gf) {
                const text = await gf.text();
                const obj = JSON.parse(text || '{}');
                const val = typeof obj?.total_score === 'number' ? obj.total_score : (typeof obj?.score === 'number' ? obj.score : null);
                if (typeof val === 'number') scores.push(Number(val));
              }
            } catch {}
          }
        }
        const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
        avgByQuiz[q.id] = avg;
      }
      setSubmissionsByQuiz(byQuiz);
      setAverages(avgByQuiz);
      setLoading(false);
    };
    load();
  }, [courseId, supabase, router]);

  const bars = useMemo(() => {
    const items = quizzes.map((q) => ({ id: q.id, title: q.title, avg: averages[q.id] || 0, count: (submissionsByQuiz[q.id] || []).length }));
    const maxAvg = Math.max(10, ...items.map(i => i.avg));
    return items.map((i, idx) => {
      const h = Math.max(4, Math.round((i.avg / maxAvg) * 120));
      const x = 40 + idx * 40;
      return { x, h, title: i.title, avg: i.avg, count: i.count };
    });
  }, [quizzes, averages, submissionsByQuiz]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Course Statistics</h1>
          <div className="flex gap-2">
            <button onClick={() => router.push('/dashboard')} className="px-3 py-2 bg-slate-600 text-white rounded">Return to Dashboard</button>
          </div>
        </div>
        {loading ? (
          <p className="text-slate-600">Loading…</p>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded border p-6">
              <p className="text-sm text-slate-600">Course</p>
              <p className="text-xl font-semibold text-slate-900">{course?.title}</p>
              <p className="text-xs text-slate-600">Quizzes: {quizzes.length}</p>
            </div>

            <div className="bg-white p-6 rounded border">
              <p className="text-sm text-slate-600 mb-2">Average Grade per Quiz</p>
              <svg viewBox="0 0 600 200" className="w-full h-52">
                <rect x="0" y="0" width="600" height="200" fill="white" />
                {bars.map((b, i) => (
                  <g key={i}>
                    <rect x={b.x} y={160 - b.h} width="24" height={b.h} fill="#2563eb" />
                    <text x={b.x + 12} y={180} textAnchor="middle" fontSize="10" fill="#0f172a">{String(b.title).slice(0, 8)}</text>
                    <text x={b.x + 12} y={150 - b.h} textAnchor="middle" fontSize="10" fill="#0f172a">{b.avg}</text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="bg-white p-6 rounded border">
              <p className="text-sm text-slate-600 mb-4">Quiz Summary</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((q) => {
                  const subs = submissionsByQuiz[q.id] || [];
                  const avg = averages[q.id] || 0;
                  return (
                    <div key={q.id} className="p-4 bg-slate-50 border rounded">
                      <p className="text-sm font-semibold text-slate-900">{q.title}</p>
                      <p className="text-xs text-slate-600">Submissions: {subs.length}</p>
                      <p className="text-xs text-slate-600">Average Score: {avg}</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => router.push(`/dashboard/results/${q.id}`)} className="px-3 py-1 bg-blue-600 text-white rounded">View Results</button>
                        <button onClick={() => router.push(`/dashboard/quiz/${q.id}/edit`)} className="px-3 py-1 bg-green-600 text-white rounded">Edit Questions</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
