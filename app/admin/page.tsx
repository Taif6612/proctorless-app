'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminPage() {
  const router = useRouter();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const supabase = createClient();

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      const email = user.email || '';
      if (email && email.toLowerCase() === 'storage12002@gmail.com') {
        setOk(true);
        setLoading(false);
        return;
      }
      const { data: roleRow } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      const r = (roleRow?.role || '').toLowerCase();
      if (r !== 'admin' && r !== 'professor') {
        router.push('/dashboard');
        return;
      }
      setOk(true);
      setLoading(false);
    };
    check();
  }, [supabase, router]);

  const saveRole = async () => {
    setMsg('');
    try {
      if (!validEmail(email)) { setMsg('Enter a valid email'); return; }
      setSaving(true);
      const resp = await fetch('/api/admin/set-role', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, actorEmail: (await supabase.auth.getUser()).data.user?.email || '' })
      });
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
  }, [ok, supabase]);

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
  }, [activeTab, ok, supabase]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-svh w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-400/20 rounded-full blur-3xl float" style={{ animationDelay: '3s' }}></div>
      </div>
      <div className="w-full max-w-5xl md:max-w-6xl animate-[slideInUp_600ms_ease] relative z-10 px-2 md:px-4">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Admin</h1>
            <p className="text-slate-500 mt-2">Manage roles, users, courses and quizzes</p>
            {!ok && (
              <p className="mt-2 text-xs text-orange-600">Limited access: some actions may be disabled without admin privileges.</p>
            )}
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
            <a
              href="/dashboard"
              className="ml-auto px-3 py-2 rounded-xl border bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
            >
              Back
            </a>
          </div>

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">User Email</label>
                <input
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-slate-50/50"
                  placeholder="Enter user email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {!validEmail(email) && email && <p className="text-xs text-red-600">Invalid email format</p>}
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Role</label>
                <select
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-slate-50/50"
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
                  className="flex-1 h-12 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
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
