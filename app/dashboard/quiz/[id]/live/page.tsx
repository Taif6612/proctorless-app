'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { calculateVariantIndex, formatTime } from '@/lib/seating';

interface Session {
    id: string;
    quiz_id: string;
    rows: number;
    columns: number;
    status: string;
    start_time: string | null;
    duration_minutes: number;
    total_variants: number;
}

interface Participant {
    id: string;
    student_email: string | null;
    seat_row: number | null;
    seat_column: number | null;
    variant_index: number | null;
    status: string;
}

export default function LiveDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.id as string;
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [quiz, setQuiz] = useState<any>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [bufferRemaining, setBufferRemaining] = useState(0);
    const [submissions, setSubmissions] = useState<any[]>([]);

    // Check authorization
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth/login');
                return;
            }

            // Check if professor or admin
            const email = user.email || '';
            if (email.toLowerCase() === 'storage12002@gmail.com') {
                setAuthorized(true);
            } else {
                const { data: roleRow } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', user.id)
                    .maybeSingle();
                const role = (roleRow?.role || '').toLowerCase();
                if (role === 'admin' || role === 'professor') {
                    setAuthorized(true);
                } else {
                    router.push('/dashboard');
                    return;
                }
            }
        };
        checkAuth();
    }, [supabase, router]);

    // Fetch data
    const fetchData = useCallback(async () => {
        if (!authorized) return;

        // Fetch quiz
        const { data: quizData } = await supabase
            .from('quizzes')
            .select('id, title')
            .eq('id', quizId)
            .single();
        if (quizData) setQuiz(quizData);

        // Fetch session
        const { data: sessionData } = await supabase
            .from('quiz_sessions')
            .select('*')
            .eq('quiz_id', quizId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (sessionData) {
            setSession(sessionData as Session);

            // Fetch participants
            const { data: participantsData } = await supabase
                .from('session_participants')
                .select('*')
                .eq('session_id', sessionData.id);
            if (participantsData) setParticipants(participantsData as Participant[]);
        }

        // Fetch submissions for this quiz to track who has completed
        const { data: submissionsData } = await supabase
            .from('submissions')
            .select('id, student_id, submitted_at')
            .eq('quiz_id', quizId);
        if (submissionsData) setSubmissions(submissionsData);

        setLoading(false);
    }, [quizId, supabase, authorized]);

    useEffect(() => {
        if (authorized) fetchData();
    }, [authorized, fetchData]);

    // Real-time subscription
    useEffect(() => {
        const sessionId = session?.id;
        if (!sessionId || !quizId) return;

        const channel = supabase
            .channel(`live-${sessionId}-${quizId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` }, () => fetchData())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions', filter: `quiz_id=eq.${quizId}` }, () => fetchData())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `quiz_id=eq.${quizId}` }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session, quizId, supabase, fetchData]);

    // Timer with buffer support
    useEffect(() => {
        if (!session?.start_time || session.status !== 'live') return;

        const interval = setInterval(() => {
            const start = new Date(session.start_time!);
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);

            // Buffer is first 5 minutes (could be made configurable)
            const bufferSec = 5 * 60; // 5 minutes buffer
            const bufRem = Math.max(0, bufferSec - elapsed);
            setBufferRemaining(bufRem);

            // Quiz time starts after buffer
            const quizElapsed = Math.max(0, elapsed - bufferSec);
            const durationSec = session.duration_minutes * 60;
            const remaining = Math.max(0, durationSec - quizElapsed);
            setTimeRemaining(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, [session?.start_time, session?.duration_minutes, session?.status]);

    // Get participant at seat with submission status
    const getParticipantAtSeat = (row: number, col: number) => {
        const participant = participants.find(p => p.seat_row === row && p.seat_column === col);
        if (participant) {
            // Check if this student has submitted
            const submission = submissions.find(s => s.student_id === (participant as any).student_id);
            if (submission?.submitted_at) {
                return { ...participant, status: 'submitted' };
            }
        }
        return participant;
    };

    // Calculate counts with submission status
    const seatedCount = participants.filter(p => p.seat_row !== null).length;
    const submittedCount = submissions.filter(s => s.submitted_at).length;
    // Taking Quiz = seated participants who haven't submitted yet
    const takingCount = participants.filter(p => {
        if (p.seat_row === null) return false; // Not seated
        const sub = submissions.find(s => s.student_id === (p as any).student_id);
        return !sub?.submitted_at; // Hasn't submitted
    }).length;
    const waitingCount = participants.filter(p => p.status === 'waiting').length;

    if (loading || !authorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading live dashboard...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center">
                    <p className="text-2xl text-slate-400">No active session</p>
                    <button
                        onClick={() => router.push(`/dashboard/quiz/${quizId}/session`)}
                        className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl"
                    >
                        Create Session
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">{quiz?.title}</h1>
                <div className={`inline-block px-4 py-2 rounded-full text-lg font-medium ${session.status === 'waiting' ? 'bg-yellow-500/20 text-yellow-400' :
                    session.status === 'live' ? 'bg-green-500/20 text-green-400' :
                        session.status === 'ended' ? 'bg-red-500/20 text-red-400' :
                            'bg-slate-500/20 text-slate-400'
                    }`}>
                    {session.status === 'waiting' ? '⏳ Waiting for Students' :
                        session.status === 'live' ? '🟢 LIVE' :
                            session.status === 'ended' ? '🔴 ENDED' : session.status.toUpperCase()}
                </div>
            </div>

            {/* Giant Timer with Buffer */}
            {session.status === 'live' && (
                <div className="text-center mb-12">
                    {bufferRemaining > 0 ? (
                        <>
                            <p className="text-slate-400 mb-2">Buffer Time (Students Preparing)</p>
                            <div className="text-8xl md:text-9xl font-mono font-bold text-amber-400 animate-pulse">
                                {formatTime(bufferRemaining)}
                            </div>
                            <p className="text-slate-500 mt-2">Quiz starts when buffer ends</p>
                        </>
                    ) : (
                        <>
                            <div className={`text-8xl md:text-9xl font-mono font-bold ${timeRemaining <= 300 ? 'text-red-500 animate-pulse' :
                                timeRemaining <= 600 ? 'text-yellow-500' : 'text-green-400'
                                }`}>
                                {formatTime(timeRemaining)}
                            </div>
                            <p className="text-slate-400 mt-2">Quiz Time Remaining</p>
                        </>
                    )}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 max-w-4xl mx-auto">
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 text-center border border-slate-700">
                    <p className="text-5xl font-bold text-yellow-400">{waitingCount}</p>
                    <p className="text-slate-400 mt-2">Waiting</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 text-center border border-slate-700">
                    <p className="text-5xl font-bold text-indigo-400">{seatedCount}</p>
                    <p className="text-slate-400 mt-2">Seated</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 text-center border border-slate-700">
                    <p className="text-5xl font-bold text-green-400">{takingCount}</p>
                    <p className="text-slate-400 mt-2">Taking Quiz</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 text-center border border-slate-700">
                    <p className="text-5xl font-bold text-slate-400">{submittedCount}</p>
                    <p className="text-slate-400 mt-2">Submitted</p>
                </div>
            </div>

            {/* Visual Seating Grid */}
            <div className="bg-slate-800/30 backdrop-blur rounded-2xl p-8 border border-slate-700 max-w-6xl mx-auto">
                <h2 className="text-xl font-bold text-slate-300 mb-6 text-center">
                    Classroom Layout ({session.rows} × {session.columns})
                </h2>
                <div className="flex justify-center">
                    <div className="inline-block">
                        {Array.from({ length: session.rows }).map((_, row) => (
                            <div key={row} className="flex mb-2">
                                {Array.from({ length: session.columns }).map((_, col) => {
                                    const participant = getParticipantAtSeat(row, col);
                                    const variantLabel = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[calculateVariantIndex(row, col, session.total_variants)];
                                    return (
                                        <div
                                            key={col}
                                            className={`w-14 h-14 m-1 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition ${participant
                                                ? participant.status === 'taking'
                                                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                                    : participant.status === 'submitted'
                                                        ? 'bg-slate-600 text-slate-300'
                                                        : 'bg-indigo-500 text-white'
                                                : 'bg-slate-700/50 text-slate-500'
                                                }`}
                                        >
                                            {participant?.status === 'submitted' ? (
                                                <span className="text-2xl">✓</span>
                                            ) : (
                                                <span className="text-lg">{variantLabel}</span>
                                            )}
                                            {participant && (
                                                <span className="text-[10px] opacity-75 truncate max-w-full px-1">
                                                    {participant.student_email?.split('@')[0] || ''}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mt-6 flex justify-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-slate-700"></div>
                        <span className="text-slate-400">Empty</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-indigo-500"></div>
                        <span className="text-slate-400">Seated</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-green-500"></div>
                        <span className="text-slate-400">Taking Quiz</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-slate-600"></div>
                        <span className="text-slate-400">Submitted</span>
                    </div>
                </div>
            </div>

            {/* Back button */}
            <div className="mt-8 text-center">
                <button
                    onClick={() => router.push(`/dashboard/quiz/${quizId}/session`)}
                    className="px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition"
                >
                    ← Back to Session Control
                </button>
            </div>
        </div>
    );
}
