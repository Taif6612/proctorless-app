"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function QuizEditPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const quizId = params?.id as string;

  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<{ timer_enabled: boolean; duration_minutes: number; buffer_minutes: number; original_probability: number }>({
    timer_enabled: false,
    duration_minutes: 60,
    buffer_minutes: 5,
    original_probability: 0.2,
  });
  const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string>('');
  const [parsing, setParsing] = useState<boolean>(false);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [variantCount, setVariantCount] = useState<number>(3);
  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedCount, setGeneratedCount] = useState<number>(0);
  const [groupSets, setGroupSets] = useState<Array<{ name: string; questions: any[] }>>([]);
  const [activeSetIndex, setActiveSetIndex] = useState<number>(0);
  const [quizMode, setQuizMode] = useState<'online' | 'physical'>('online');
  const [seatingRows, setSeatingRows] = useState<number>(5);
  const [seatingColumns, setSeatingColumns] = useState<number>(6);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: q } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
      setQuiz(q);
      if (q?.question_bank_path) {
        try {
          const { data: file } = await supabase.storage.from('question_banks').download(q.question_bank_path);
          if (file) {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const qs = Array.isArray(parsed?.questions) ? parsed.questions : (Array.isArray(parsed) ? parsed : []);
            setQuestions(normalizeQuestions(qs));
          }
        } catch { }
      }
      try {
        const { data: sfile } = await supabase.storage.from('question_banks').download(`settings/${quizId}.json`);
        if (sfile) {
          const stext = await sfile.text();
          const sobj = JSON.parse(stext);
          setSettings({
            timer_enabled: !!sobj.timer_enabled,
            duration_minutes: Number(sobj.duration_minutes || 60),
            buffer_minutes: Number(sobj.buffer_minutes || 5),
            original_probability: typeof sobj.original_probability === 'number' ? sobj.original_probability : 0.2,
          });
          // Load quiz mode and seating settings
          if (sobj.quiz_mode) setQuizMode(sobj.quiz_mode);
          if (sobj.seating_rows) setSeatingRows(Number(sobj.seating_rows));
          if (sobj.seating_columns) setSeatingColumns(Number(sobj.seating_columns));
        }
      } catch { }
      try {
        const { data: vfile } = await supabase.storage.from('question_banks').download(`variations/${quizId}.json`);
        if (vfile) {
          const vtext = await vfile.text();
          const vobj = JSON.parse(vtext || '{}');
          const sets = Array.isArray(vobj?.sets) ? vobj.sets : [];
          if (sets.length > 0) {
            const mapped = sets.map((s: any, i: number) => ({ name: String(s?.name || `Set ${i}`), questions: normalizeQuestions(Array.isArray(s?.questions) ? s.questions : []) }));
            setGroupSets(mapped);
            setActiveSetIndex(0);
            if (mapped[0]?.questions) setQuestions(mapped[0].questions);
          }
        }
      } catch { }
    };
    load();
  }, [quizId, supabase, router]);

  const normalizeQuestions = (qs: any[]) => {
    return qs.map((q, idx) => {
      const type = String(q?.type || '').toLowerCase();
      if (type === 'boolean' && (!Array.isArray(q?.choices) || q.choices.length === 0)) {
        return { ...q, type: 'mcq', choices: ['True', 'False'] };
      }
      if (type !== 'mcq' && Array.isArray(q?.choices) && q.choices.length >= 2) {
        return { ...q, type: 'mcq' };
      }
      if (!type) {
        return { ...q, type: 'text' };
      }
      return q;
    });
  };

  const updateQuestion = (index: number, updates: any) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const deleteQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const payload = { questions };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const path = quiz?.question_bank_path || `banks/${quizId}.json`;
      const { error: upErr } = await supabase.storage.from('question_banks').upload(path, blob, { upsert: true });
      if (upErr) throw upErr;
      if (!quiz?.question_bank_path) {
        await supabase.from('quizzes').update({ question_bank_path: path }).eq('id', quizId);
      }

      const sblob = new Blob([JSON.stringify({
        ...settings,
        quiz_mode: quizMode,
        seating_rows: seatingRows,
        seating_columns: seatingColumns,
      }, null, 2)], { type: 'application/json' });
      await supabase.storage.from('question_banks').upload(`settings/${quizId}.json`, sblob, { upsert: true });
      alert('Saved');
    } catch (e) {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Edit Quiz</h1>
          <div className="flex gap-2">
            <button onClick={() => router.push('/dashboard')} className="px-3 py-2 bg-slate-500 text-white rounded">Return to Dashboard</button>
            <button onClick={() => router.push(`/dashboard/quiz/${quizId}`)} className="px-3 py-2 bg-slate-600 text-white rounded">Open Quiz</button>
            <button onClick={saveAll} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>

        {/* Quiz Mode Toggle */}
        <div className="bg-white rounded border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-black">Quiz Mode</h2>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setQuizMode('online')}
              className={`px-4 py-2 rounded-lg font-medium transition ${quizMode === 'online'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              🌐 Online Quiz
            </button>
            <button
              onClick={() => setQuizMode('physical')}
              className={`px-4 py-2 rounded-lg font-medium transition ${quizMode === 'physical'
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              🏫 Physical Quiz
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            {quizMode === 'online'
              ? 'Online quiz with integrity monitoring and AI grading.'
              : 'In-person exam with seating arrangement and synchronized timer.'}
          </p>

          {/* Seating Grid for Physical Mode */}
          {quizMode === 'physical' && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-sm font-semibold text-green-900 mb-3">Seating Arrangement</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-green-700 mb-1">Rows</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={seatingRows}
                    onChange={(e) => setSeatingRows(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-green-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-green-700 mb-1">Columns</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={seatingColumns}
                    onChange={(e) => setSeatingColumns(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-green-300 rounded"
                  />
                </div>
              </div>
              <p className="text-xs text-green-700 mb-3">
                Total seats: {seatingRows * seatingColumns}
              </p>
              {/* Mini Seating Grid Preview */}
              <div className="bg-white p-3 rounded border border-green-200 overflow-x-auto">
                <p className="text-xs text-slate-500 mb-2">Seating Grid Preview:</p>
                <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(seatingColumns, 10)}, 1fr)` }}>
                  {Array.from({ length: Math.min(seatingRows, 6) * Math.min(seatingColumns, 10) }).map((_, i) => (
                    <div key={i} className="w-6 h-6 bg-green-100 border border-green-300 rounded-sm flex items-center justify-center text-[8px] text-green-700">
                      {i + 1}
                    </div>
                  ))}
                </div>
                {(seatingRows > 6 || seatingColumns > 10) && (
                  <p className="text-xs text-slate-400 mt-2">... and more seats</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-white rounded border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-black">Timer Settings</h2>
          <label className="flex items-center gap-2 mb-3 text-sm text-black">
            <input type="checkbox" checked={settings.timer_enabled} onChange={(e) => setSettings({ ...settings, timer_enabled: e.target.checked })} />
            <span>Enable Timer</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Buffer (minutes)</label>
              <input type="number" min={0} value={settings.buffer_minutes} onChange={(e) => setSettings({ ...settings, buffer_minutes: Number(e.target.value) })} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Duration (minutes)</label>
              <input type="number" min={1} value={settings.duration_minutes} onChange={(e) => setSettings({ ...settings, duration_minutes: Number(e.target.value) })} className="w-full px-3 py-2 border rounded" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs text-slate-600 mb-1">Probability to include original question (0–1)</label>
            <input type="number" min={0} max={1} step={0.05} value={settings.original_probability} onChange={(e) => setSettings({ ...settings, original_probability: Math.max(0, Math.min(1, Number(e.target.value))) })} className="w-40 px-3 py-2 border rounded" />
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white rounded border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Questions</h2>
            <button onClick={() => setQuestions((prev) => [...prev, { prompt: 'New question', type: 'text' }])} className="px-3 py-2 bg-green-600 text-white rounded">Add Question</button>
          </div>

          <div className="mb-4 p-4 bg-slate-50 border rounded">
            <p className="text-sm font-semibold text-black mb-2">Upload & Parse with Gemini</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fileInput = (e.currentTarget as HTMLFormElement).querySelector('input[name="question_asset"]') as HTMLInputElement;
                const f = fileInput?.files?.[0] || null;
                if (!f) { alert('Select a file'); return; }
                setParsing(true);
                try {
                  const path = `quiz_assets/${quizId}/${Date.now()}_${f.name}`;
                  const { error: upErr } = await supabase.storage.from('question_assets').upload(path, f, { upsert: true });
                  if (upErr) { alert('Upload error: ' + upErr.message); setParsing(false); return; }
                  const { data: pub } = await supabase.storage.from('question_assets').getPublicUrl(path);
                  setUploadedAssetUrl(pub.publicUrl);
                  const resp = await fetch('/api/gemini/extract', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileUrl: pub.publicUrl, contentType: f.type })
                  });
                  const data = await resp.json().catch(() => ({ ok: false, error: 'Unknown parse error' }));
                  console.log('[Parse Debug] API Response:', { status: resp.status, ok: resp.ok, data });
                  if (resp.ok && (data as any)?.ok) {
                    const parsed = normalizeQuestions(((data as any)?.questions) || []);
                    console.log('[Parse Debug] Parsed questions:', parsed.length, parsed);
                    setParsedQuestions(parsed);
                    setGroupSets([{ name: 'Original', questions: parsed }]);
                    setActiveSetIndex(0);
                    setQuestions(parsed);
                    try {
                      setGenerating(true);
                      let totalVars = 0;
                      if (variantCount > 0 && parsed.length > 0) {
                        const fullText = serializeQuestionsToText(parsed);
                        const vresp = await fetch('/api/gemini/variations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ master: fullText, count: variantCount, mode: 'set' }) });
                        const vdata = await vresp.json().catch(() => ({ ok: false }));
                        if (vresp.ok && (vdata as any)?.ok) {
                          const texts = Array.isArray((vdata as any)?.set_texts) ? (vdata as any).set_texts : [];
                          const sets = texts.map((t: string, i: number) => ({ name: `Var Set ${i + 1}`, questions: normalizeQuestions(parseTextToQuestionsClient(t)) }));
                          totalVars = sets.length;
                          const allSets = [{ name: 'Original', questions: parsed }, ...sets];
                          setGroupSets(allSets);
                          setActiveSetIndex(0);
                          try {
                            const payload = { sets: allSets.map((s) => ({ name: s.name, questions: s.questions })) };
                            const vblob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                            await supabase.storage.from('question_banks').upload(`variations/${quizId}.json`, vblob, { upsert: true });
                          } catch { }
                        }
                      } else {
                        setGeneratedCount(0);
                      }
                      setGeneratedCount(totalVars);
                    } finally {
                      setGenerating(false);
                    }
                  } else {
                    const detailsRaw = (data as any)?.details;
                    const fallbackRaw = (data as any)?.fallbackError;
                    const details = typeof detailsRaw === 'string' ? detailsRaw : JSON.stringify(detailsRaw || {});
                    const fb = typeof fallbackRaw === 'string' ? fallbackRaw : JSON.stringify(fallbackRaw || {});
                    alert('Parse failed: ' + ((data as any)?.error || resp.status) + (details ? ('\nDetails: ' + details.substring(0, 400)) : '') + (fb ? ('\nFallback: ' + fb.substring(0, 400)) : ''));
                  }
                } catch (err) {
                  alert('Parse error');
                } finally {
                  setParsing(false);
                }
              }}
              className="flex items-center gap-3"
            >
              <input name="question_asset" type="file" accept="image/*,application/pdf" className="flex-1 text-sm text-slate-900 file:bg-slate-700 file:text-white file:border-0 file:px-3 file:py-2 file:rounded" />
              <button type="submit" disabled={parsing} className="px-3 py-2 bg-purple-600 text-white rounded disabled:opacity-50">
                {parsing ? 'Parsing…' : 'Upload & Parse'}
              </button>
            </form>

            {uploadedAssetUrl && (
              <div className="mt-3 text-xs">
                <a href={uploadedAssetUrl} target="_blank" className="underline text-blue-700">Open uploaded source</a>
              </div>
            )}

            {parsedQuestions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-black">Parsed questions: {parsedQuestions.length}</p>
                <button
                  onClick={() => setQuestions((prev) => normalizeQuestions([...(prev || []), ...parsedQuestions]))}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Add Parsed to Editor
                </button>
              </div>
            )}
          </div>
          <div className="mb-4 p-4 bg-white border rounded">
            <p className="text-sm font-semibold text-black mb-2">Set Tabs</p>
            {groupSets.length === 0 ? (
              <p className="text-xs text-slate-600">No sets available</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {groupSets.map((s, si) => (
                    <button
                      key={si}
                      onClick={() => { setActiveSetIndex(si); setQuestions(groupSets[si].questions); }}
                      className={`px-2 py-1 rounded text-sm border ${activeSetIndex === si ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-900 border-slate-300'}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-600">Active: {groupSets[activeSetIndex]?.name}</p>
              </div>
            )}
          </div>

          <div className="mb-4 p-4 bg-slate-50 border rounded">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs text-slate-600 mb-1">Variations to generate after parse (0–10)</label>
                <input type="number" min={0} max={10} value={variantCount} onChange={(e) => setVariantCount(parseInt(e.target.value || '3', 10))} className="w-32 px-3 py-2 border rounded" />
              </div>
              <div>
                <button
                  onClick={async () => {
                    setGenerating(true);
                    try {
                      const baseQs = Array.isArray(groupSets[activeSetIndex]?.questions) && groupSets[activeSetIndex]?.questions.length > 0 ? groupSets[activeSetIndex].questions : questions;
                      if (!baseQs || baseQs.length === 0) {
                        alert('Please add or parse questions first before generating variations.');
                        setGenerating(false);
                        return;
                      }
                      const fullText = serializeQuestionsToText(baseQs);
                      const vresp = await fetch('/api/gemini/variations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ master: fullText, count: Math.max(0, variantCount), mode: 'set' }) });
                      const vdata = await vresp.json().catch(() => ({ ok: false }));
                      if (vresp.ok && (vdata as any)?.ok) {
                        const texts = Array.isArray((vdata as any)?.set_texts) ? (vdata as any).set_texts : [];
                        const existingVarCount = Math.max(0, (groupSets.length || 0) - 1);
                        const appended = texts.map((t: string, i: number) => ({ name: `Var Set ${existingVarCount + i + 1}`, questions: normalizeQuestions(parseTextToQuestionsClient(t)) }));
                        const baseOriginal = groupSets.length > 0 ? groupSets[0] : { name: 'Original', questions: baseQs };
                        const prior = groupSets.length > 0 ? groupSets.slice(1) : [];
                        const allSets = [baseOriginal, ...prior, ...appended];
                        setGroupSets(allSets);
                        setGeneratedCount((prev) => (prev || 0) + appended.length);
                        try {
                          const payload = { sets: allSets.map((s) => ({ name: s.name, questions: s.questions })) };
                          const vblob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                          await supabase.storage.from('question_banks').upload(`variations/${quizId}.json`, vblob, { upsert: true });
                        } catch { }
                      } else {
                        const errText = typeof (vdata as any)?.error === 'string' ? (vdata as any).error : JSON.stringify((vdata as any)?.error || {});
                        const detailsText = typeof (vdata as any)?.details === 'string' ? (vdata as any).details : JSON.stringify((vdata as any)?.details || {});
                        alert('Generation failed' + (errText ? ('\nError: ' + errText.substring(0, 400)) : '') + (detailsText ? ('\nDetails: ' + detailsText.substring(0, 400)) : ''));
                      }
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  disabled={generating}
                  className="mb-2 px-3 py-2 bg-purple-600 text-white rounded disabled:opacity-50"
                >
                  {generating ? 'Generating…' : 'Generate Sets'}
                </button>
                {generatedCount > 0 && (
                  <p className="text-xs text-slate-600">Generated variations: {generatedCount}</p>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="p-4 bg-slate-50 border rounded">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
                  <div className="md:col-span-3">
                    <input value={q.prompt || ''} onChange={(e) => updateQuestion(i, { prompt: e.target.value })} className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <select value={(q.type || 'text')} onChange={(e) => updateQuestion(i, { type: e.target.value })} className="w-full px-3 py-2 border rounded">
                      <option value="text">Q/A</option>
                      <option value="mcq">MCQ</option>
                      <option value="boolean">True/False</option>
                      <option value="numeric">Numeric</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Max Marks</label>
                    <input type="number" min={0} value={q.max_marks ?? ''} onChange={(e) => updateQuestion(i, { max_marks: Number(e.target.value) })} className="w-full px-3 py-2 border rounded" />
                  </div>
                  {String(q.type).toLowerCase() === 'text' && (
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Expected Answer (optional)</label>
                      <input value={q.expected_answer ?? ''} onChange={(e) => updateQuestion(i, { expected_answer: e.target.value || undefined })} className="w-full px-3 py-2 border rounded" />
                    </div>
                  )}
                  {String(q.type).toLowerCase() === 'numeric' && (
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Expected Number (optional)</label>
                      <input type="number" value={q.expected_answer ?? ''} onChange={(e) => {
                        const v = e.target.value;
                        updateQuestion(i, { expected_answer: v === '' ? undefined : Number(v) });
                      }} className="w-full px-3 py-2 border rounded" />
                    </div>
                  )}
                </div>
                {(String(q.type).toLowerCase() === 'mcq' || String(q.type).toLowerCase() === 'boolean') && (
                  <div className="mt-3 space-y-2">
                    {((String(q.type).toLowerCase() === 'boolean') ? ['True', 'False'] : (Array.isArray(q.choices) ? q.choices : ['Option A', 'Option B'])).map((c: string, ci: number) => (
                      <div key={ci} className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Choice {ci + 1}</span>
                        <input value={c} onChange={(e) => {
                          const next = Array.isArray(q.choices) ? [...q.choices] : ['Option A', 'Option B'];
                          next[ci] = e.target.value;
                          updateQuestion(i, { choices: next, type: 'mcq' });
                        }} className="flex-1 px-3 py-2 border rounded" />
                        <label className="flex items-center gap-1 text-xs">
                          <input type="radio" name={`correct_${i}`} checked={q.correct_index === ci} onChange={() => updateQuestion(i, { correct_index: ci, type: 'mcq' })} />
                          Correct
                        </label>
                      </div>
                    ))}
                    <button onClick={() => updateQuestion(i, { choices: [...(Array.isArray(q.choices) ? q.choices : []), `Option ${(Array.isArray(q.choices) ? q.choices.length : 0) + 1}`], type: 'mcq' })} className="mt-2 px-3 py-1 bg-slate-600 text-white rounded">Add Choice</button>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => moveQuestion(i, -1)} className="px-3 py-1 bg-slate-700 text-white rounded">Move Up</button>
                  <button onClick={() => moveQuestion(i, 1)} className="px-3 py-1 bg-slate-700 text-white rounded">Move Down</button>
                  <button onClick={() => deleteQuestion(i)} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function serializeQuestionsToText(qs: any[]) {
  const lines: string[] = [];
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i] || {};
    const num = i + 1;
    lines.push(`${num}. ${String(q.prompt || '')}`);
    const choices = Array.isArray(q.choices) ? q.choices : [];
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let ci = 0; ci < choices.length; ci++) {
      lines.push(`(${labels[ci]}) ${choices[ci]}`);
    }
  }
  return lines.join('\n');
}

function parseTextToQuestionsClient(text: string) {
  const lines = text.replace(/\r/g, '').split(/\n/);
  const joined = lines.join('\n');
  const indices: number[] = [];
  const regex = /^\s*(\d+)[\).]\s+/gm;
  let m;
  while ((m = regex.exec(joined))) indices.push(m.index);
  if (indices.length === 0) return [] as any[];
  const result: any[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : joined.length;
    const chunk = joined.slice(start, end).trim();
    const body = chunk.replace(/^\s*(\d+)[\).]\s+/, '');
    const choiceRegex = /^\s*([A-Da-d])[\).]\s+(.*)$/gm;
    const choices: string[] = [];
    let cm;
    while ((cm = choiceRegex.exec(body))) choices.push(cm[2].trim());
    const markRegex = /([\[(]?)(\d+)(\s*)(m|marks)([\])]?)/i;
    const mm = body.match(markRegex);
    const maxMarks = mm ? parseInt(mm[2], 10) : undefined;
    let type: 'mcq' | 'boolean' | 'text' | 'numeric' = 'text';
    if (choices.length >= 2) {
      const tf = choices.map((c) => c.toLowerCase());
      type = tf.includes('true') && tf.includes('false') ? 'boolean' : 'mcq';
    } else {
      const numericHint = /\b\d+(?:\.\d+)?\b/.test(body);
      type = numericHint ? 'numeric' : 'text';
    }
    const prompt = body.replace(markRegex, '').trim();
    result.push({ order_index: i + 1, prompt, type, choices: choices.length ? choices : undefined, max_marks: maxMarks });
  }
  return result;
}
