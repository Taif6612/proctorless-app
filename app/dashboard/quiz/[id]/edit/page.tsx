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
  // Multi-file upload state
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);

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

      const sblob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
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
            <button onClick={() => router.push(`/dashboard/quiz/${quizId}/session`)} className="px-3 py-2 bg-purple-600 text-white rounded">Session Control</button>
            <button onClick={saveAll} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>

        {/* Note: Timer settings have been moved to Session Control */}

        {/* Questions */}
        <div className="bg-white rounded border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Questions</h2>
            <button onClick={() => setQuestions((prev) => [...prev, { prompt: 'New question', type: 'text' }])} className="px-3 py-2 bg-green-600 text-white rounded">Add Question</button>
          </div>

          <div className="mb-4 p-4 bg-slate-50 border rounded-lg">
            <p className="text-sm font-semibold text-slate-800 mb-3">Upload Question Sources (Multiple Files Supported)</p>

            {/* File Input */}
            <div className="flex items-center gap-3 mb-3">
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setStagedFiles(prev => [...prev, ...files]);
                  e.target.value = '';
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
              <div className="mb-3 bg-white rounded-lg p-3 border">
                <p className="text-xs text-slate-600 mb-2">{stagedFiles.length} file(s) staged</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {stagedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded border text-sm">
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
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload & Parse Button */}
            <button
              onClick={async () => {
                if (stagedFiles.length === 0) { alert('Select at least one file'); return; }
                setParsing(true);
                const allQuestions: any[] = [];

                try {
                  for (let i = 0; i < stagedFiles.length; i++) {
                    const file = stagedFiles[i];
                    setUploadProgress({ current: i + 1, total: stagedFiles.length, fileName: file.name });

                    const path = `quiz_assets/${quizId}/${Date.now()}_${file.name}`;
                    const { error: upErr } = await supabase.storage.from('question_assets').upload(path, file, { upsert: true });
                    if (upErr) {
                      console.error('Upload error:', upErr.message);
                      continue;
                    }
                    const { data: pub } = await supabase.storage.from('question_assets').getPublicUrl(path);
                    setUploadedAssetUrl(pub.publicUrl);

                    const resp = await fetch('/api/gemini/extract', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fileUrl: pub.publicUrl, contentType: file.type })
                    });
                    const data = await resp.json().catch(() => ({ ok: false }));
                    if (resp.ok && data.ok) {
                      const qs = normalizeQuestions(data.questions || []).map((q: any, idx: number) => ({
                        ...q,
                        order_index: allQuestions.length + idx + 1
                      }));
                      allQuestions.push(...qs);
                    }
                  }

                  setParsedQuestions(allQuestions);
                  setQuestions(allQuestions);
                  setGroupSets([{ name: 'Original', questions: allQuestions }]);
                  setActiveSetIndex(0);
                  setStagedFiles([]);

                  // Auto-generate variations if variantCount > 0
                  if (variantCount > 0 && allQuestions.length > 0) {
                    setGenerating(true);
                    try {
                      const fullText = serializeQuestionsToText(allQuestions);
                      const vresp = await fetch('/api/gemini/variations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ master: fullText, count: variantCount, mode: 'set' }) });
                      const vdata = await vresp.json().catch(() => ({ ok: false }));
                      if (vresp.ok && vdata.ok) {
                        const texts = Array.isArray(vdata.set_texts) ? vdata.set_texts : [];
                        const sets = texts.map((t: string, i: number) => ({ name: `Var Set ${i + 1}`, questions: normalizeQuestions(parseTextToQuestionsClient(t)) }));
                        const allSets = [{ name: 'Original', questions: allQuestions }, ...sets];
                        setGroupSets(allSets);
                        setGeneratedCount(sets.length);
                        try {
                          const payload = { sets: allSets.map((s) => ({ name: s.name, questions: s.questions })) };
                          const vblob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                          await supabase.storage.from('question_banks').upload(`variations/${quizId}.json`, vblob, { upsert: true });
                        } catch { }
                      }
                    } finally {
                      setGenerating(false);
                    }
                  }
                } catch (err) {
                  console.error('Error:', err);
                  alert('Error processing files');
                } finally {
                  setParsing(false);
                  setUploadProgress(null);
                }
              }}
              disabled={parsing || stagedFiles.length === 0}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition"
            >
              {parsing ? 'Processing...' : `Upload & Parse ${stagedFiles.length > 0 ? `(${stagedFiles.length} files)` : ''}`}
            </button>

            {uploadedAssetUrl && (
              <div className="mt-3 text-xs">
                <a href={uploadedAssetUrl} target="_blank" className="underline text-blue-700">Open last uploaded source</a>
              </div>
            )}

            {parsedQuestions.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-slate-700">Parsed questions: {parsedQuestions.length}</p>
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
