'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatTime } from '@/lib/seating';

interface Session {
    id: string;
    quiz_id: string;
    rows: number;
    columns: number;
    status: string;
    start_time: string | null;
    duration_minutes: number;
    late_joiner_extra_minutes: number;
    total_variants: number;
}

interface Participant {
    id: string;
    student_id: string;
    seat_row: number | null;
    seat_column: number | null;
    variant_index: number | null;
    status: string;
}

export default function StudentWaitingRoomPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.id as string;
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [quiz, setQuiz] = useState<any>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [myParticipation, setMyParticipation] = useState<Participant | null>(null);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [joining, setJoining] = useState(false);

    // Fetch user and data
    const fetchData = useCallback(async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            router.push('/auth/login');
            return;
        }
        setUser(currentUser);

        // Fetch quiz
        const { data: quizData } = await supabase
            .from('quizzes')
            .select('id, title, course_id')
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

            // Fetch my participation
            const { data: participationData } = await supabase
                .from('session_participants')
                .select('*')
                .eq('session_id', sessionData.id)
                .eq('student_id', currentUser.id)
                .single();

            if (participationData) {
                setMyParticipation(participationData as Participant);
                // No auto-redirect - students should use the "Take Quiz" button on the quiz page
            }
        }

        setLoading(false);
    }, [quizId, supabase, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Real-time subscription
    useEffect(() => {
        if (!session?.id || !user?.id) return;

        const channel = supabase
            .channel(`waiting-${session.id}-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${session.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${session.id}` }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session?.id, user?.id, supabase, fetchData]);

    // Join the waiting queue
    const joinQueue = async () => {
        if (!session || !user) return;

        setJoining(true);
        const { error } = await supabase
            .from('session_participants')
            .insert({
                session_id: session.id,
                student_id: user.id,
                student_email: user.email,
                status: 'waiting'
            });

        if (error) {
            if (error.code === '23505') {
                // Already in queue, just refetch
                fetchData();
            } else {
                alert('Error joining queue: ' + error.message);
            }
        } else {
            fetchData();
        }
        setJoining(false);
    };

    // Timer for live quiz
    useEffect(() => {
        if (!session?.start_time || session.status !== 'live') return;

        const interval = setInterval(() => {
            const start = new Date(session.start_time!);
            const end = new Date(start.getTime() + session.duration_minutes * 60 * 1000);
            const now = new Date();
            const remaining = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
            setTimeRemaining(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, [session?.start_time, session?.duration_minutes, session?.status]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
                    <h1 className="text-2xl font-bold text-slate-800 mb-4">No Active Session</h1>
                    <p className="text-slate-600 mb-6">The professor hasn't started a quiz session yet. Please wait or check back later.</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Not in queue yet
    if (!myParticipation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">{quiz?.title}</h1>
                    <p className="text-slate-600 mb-6">Ready to join the quiz?</p>
                    <div className="bg-indigo-50 rounded-xl p-4 mb-6">
                        <p className="text-sm text-slate-600">
                            <strong>Duration:</strong> {session.duration_minutes} minutes
                        </p>
                        <p className="text-sm text-slate-600">
                            <strong>Grid:</strong> {session.rows} × {session.columns} seats
                        </p>
                    </div>
                    <button
                        onClick={joinQueue}
                        disabled={joining}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition shadow-lg disabled:opacity-50"
                    >
                        {joining ? 'Joining...' : 'Join Queue'}
                    </button>
                </div>
            </div>
        );
    }

    // In queue, waiting for seat
    if (myParticipation.seat_row === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Waiting for Seat</h1>
                    <p className="text-slate-600 mb-6">
                        You're in the queue. The professor will assign you a seat shortly.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <p className="text-sm text-yellow-700">
                            Please wait in this screen. You'll be automatically notified when assigned a seat.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Seated, waiting for quiz to start
    if (session.status !== 'live') {
        const variantLabel = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[myParticipation.variant_index || 0];
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                        <span className="text-4xl font-bold text-white">{variantLabel}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">You're Seated!</h1>
                    <div className="bg-indigo-50 rounded-xl p-4 mb-6">
                        <p className="text-lg text-indigo-700 font-semibold">
                            Row {(myParticipation.seat_row || 0) + 1}, Seat {(myParticipation.seat_column || 0) + 1}
                        </p>
                        <p className="text-sm text-indigo-600 mt-1">
                            Question Set: <strong>{variantLabel}</strong>
                        </p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 justify-center">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                            <p className="text-yellow-700 font-medium">Waiting for professor to start...</p>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500">
                        Please go to your assigned seat and wait for the quiz to begin.
                    </p>
                </div>
            </div>
        );
    }

    // Quiz is live - show button to go to quiz page
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-100">
            <div className="text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
                <div className="text-6xl mb-4">🎯</div>
                <h1 className="text-2xl font-bold text-green-700 mb-2">Quiz is Live!</h1>
                <div className="bg-green-50 rounded-xl p-4 mb-6">
                    <p className="text-lg text-green-700 font-semibold">
                        Your Seat: Row {(myParticipation.seat_row || 0) + 1}, Seat {(myParticipation.seat_column || 0) + 1}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                        Question Set: <strong>{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[myParticipation.variant_index || 0]}</strong>
                    </p>
                </div>
                <p className="text-slate-600 mb-6">Click the button below to go to the quiz page and start your exam.</p>
                <button
                    onClick={() => router.push(`/dashboard/quiz/${quizId}`)}
                    className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition"
                >
                    Go to Quiz Page
                </button>
            </div>
        </div>
    );
}
