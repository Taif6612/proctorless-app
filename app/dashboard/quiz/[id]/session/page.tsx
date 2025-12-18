'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { calculateVariantIndex, autoAssignSeats, formatTime } from '@/lib/seating';

interface Session {
    id: string;
    quiz_id: string;
    rows: number;
    columns: number;
    status: 'waiting' | 'seated' | 'live' | 'ended';
    start_time: string | null;
    duration_minutes: number;
    late_joiner_extra_minutes: number;
    total_variants: number;
}

interface Participant {
    id: string;
    student_id: string;
    student_email: string | null;
    seat_row: number | null;
    seat_column: number | null;
    variant_index: number | null;
    status: string;
    joined_at: string;
}

export default function SessionControlPage() {
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [quiz, setQuiz] = useState<any>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

    // Config state for new session
    const [rows, setRows] = useState(5);
    const [columns, setColumns] = useState(6);
    const [durationMinutes, setDurationMinutes] = useState(30);
    const [lateJoinerExtraMinutes, setLateJoinerExtraMinutes] = useState(5);
    const [totalVariants, setTotalVariants] = useState(4);

    // Timer state
    const [timeRemaining, setTimeRemaining] = useState(0);

    // Fetch quiz and session data
    const fetchData = useCallback(async () => {
        // Fetch quiz info
        const { data: quizData } = await supabase
            .from('quizzes')
            .select('id, title, course_id')
            .eq('id', quizId)
            .single();

        if (quizData) setQuiz(quizData);

        // Fetch existing session
        const { data: sessionData } = await supabase
            .from('quiz_sessions')
            .select('*')
            .eq('quiz_id', quizId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (sessionData) {
            setSession(sessionData as Session);
            setRows(sessionData.rows);
            setColumns(sessionData.columns);
            setDurationMinutes(sessionData.duration_minutes);
            setLateJoinerExtraMinutes(sessionData.late_joiner_extra_minutes || 0);
            setTotalVariants(sessionData.total_variants);

            // Fetch participants
            const { data: participantsData } = await supabase
                .from('session_participants')
                .select('*')
                .eq('session_id', sessionData.id)
                .order('joined_at', { ascending: true });

            if (participantsData) setParticipants(participantsData as Participant[]);
        }

        setLoading(false);
    }, [quizId, supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Real-time subscription for participants
    useEffect(() => {
        if (!session?.id) return;

        const channel = supabase
            .channel(`session-${session.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'session_participants', filter: `session_id=eq.${session.id}` },
                () => fetchData()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${session.id}` },
                () => fetchData()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session?.id, supabase, fetchData]);

    // Timer countdown
    useEffect(() => {
        if (!session?.start_time || session.status !== 'live') return;

        const interval = setInterval(() => {
            const start = new Date(session.start_time!);
            const end = new Date(start.getTime() + session.duration_minutes * 60 * 1000);
            const now = new Date();
            const remaining = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
            setTimeRemaining(remaining);

            if (remaining <= 0) {
                // Auto-end session
                supabase.from('quiz_sessions').update({ status: 'ended' }).eq('id', session.id);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [session?.start_time, session?.duration_minutes, session?.status, session?.id, supabase]);

    // Create new session
    const createSession = async () => {
        const { data, error } = await supabase
            .from('quiz_sessions')
            .insert({
                quiz_id: quizId,
                rows,
                columns,
                duration_minutes: durationMinutes,
                late_joiner_extra_minutes: lateJoinerExtraMinutes,
                total_variants: totalVariants,
                status: 'waiting'
            })
            .select()
            .single();

        if (error) {
            alert('Error creating session: ' + error.message);
        } else {
            setSession(data as Session);
        }
    };

    // Assign seat to selected student
    const assignSeat = async (row: number, column: number) => {
        if (!selectedStudent || !session) return;

        const variantIndex = calculateVariantIndex(row, column, session.total_variants);

        const { error } = await supabase
            .from('session_participants')
            .update({
                seat_row: row,
                seat_column: column,
                variant_index: variantIndex,
                status: 'seated',
                seated_at: new Date().toISOString()
            })
            .eq('id', selectedStudent);

        if (error) {
            alert('Error assigning seat: ' + error.message);
        } else {
            setSelectedStudent(null);
            fetchData();
        }
    };

    // Auto-assign all waiting students
    const autoAssignAll = async () => {
        if (!session) return;

        const waiting = participants.filter(p => p.status === 'waiting');
        const occupied = participants
            .filter(p => p.seat_row !== null)
            .map(p => ({ row: p.seat_row!, column: p.seat_column! }));

        const assignments = autoAssignSeats(
            session.rows,
            session.columns,
            occupied,
            waiting.length,
            session.total_variants
        );

        // Update each waiting student
        for (let i = 0; i < waiting.length && i < assignments.length; i++) {
            const p = waiting[i];
            const a = assignments[i];
            await supabase
                .from('session_participants')
                .update({
                    seat_row: a.row,
                    seat_column: a.column,
                    variant_index: a.variantIndex,
                    status: 'seated',
                    seated_at: new Date().toISOString()
                })
                .eq('id', p.id);
        }

        fetchData();
    };

    // Start quiz (green light)
    const startQuiz = async () => {
        if (!session) return;

        const { error } = await supabase
            .from('quiz_sessions')
            .update({
                status: 'live',
                start_time: new Date().toISOString()
            })
            .eq('id', session.id);

        if (error) {
            alert('Error starting quiz: ' + error.message);
        } else {
            fetchData();
        }
    };

    // End quiz
    const endQuiz = async () => {
        if (!session) return;

        await supabase
            .from('quiz_sessions')
            .update({ status: 'ended' })
            .eq('id', session.id);

        fetchData();
    };

    // Get participant at a seat
    const getParticipantAtSeat = (row: number, col: number) => {
        return participants.find(p => p.seat_row === row && p.seat_column === col);
    };

    // Waiting students
    const waitingStudents = participants.filter(p => p.status === 'waiting');
    const seatedStudents = participants.filter(p => p.seat_row !== null);
    const takingStudents = participants.filter(p => p.status === 'taking');

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Quiz Session Control</h1>
                        <p className="text-slate-600">{quiz?.title}</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push(`/dashboard/quiz/${quizId}/live`)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition"
                        >
                            Open Live Dashboard
                        </button>
                        <button
                            onClick={() => router.back()}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition"
                        >
                            Back
                        </button>
                    </div>
                </div>

                {/* Session Status Bar */}
                {session && (
                    <div className="mb-6 bg-white/80 backdrop-blur-xl rounded-2xl p-4 shadow-lg border border-white/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="text-sm text-slate-500">Status:</span>
                                    <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${session.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' :
                                        session.status === 'seated' ? 'bg-blue-100 text-blue-700' :
                                            session.status === 'live' ? 'bg-green-100 text-green-700' :
                                                'bg-slate-100 text-slate-700'
                                        }`}>
                                        {session.status.toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-sm text-slate-500">Grid:</span>
                                    <span className="ml-2 font-medium text-slate-800">{session.rows} × {session.columns}</span>
                                </div>
                                <div>
                                    <span className="text-sm text-slate-500">Duration:</span>
                                    <span className="ml-2 font-medium text-slate-800">{session.duration_minutes} min</span>
                                </div>
                                <div>
                                    <span className="text-sm text-slate-500">Variants:</span>
                                    <span className="ml-2 font-medium text-slate-800">{session.total_variants}</span>
                                </div>
                            </div>
                            {session.status === 'live' && (
                                <div className="text-3xl font-mono font-bold text-indigo-600">
                                    {formatTime(timeRemaining)}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* No Session - Create Form */}
                {!session && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-white/20 max-w-xl">
                        <h2 className="text-xl font-bold text-slate-800 mb-6">Create Quiz Session</h2>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rows</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={rows}
                                    onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Columns</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={columns}
                                    onChange={(e) => setColumns(parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 30)}
                                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Late Joiner Extra (min)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={lateJoinerExtraMinutes}
                                    onChange={(e) => setLateJoinerExtraMinutes(parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Question Variants</label>
                                <input
                                    type="number"
                                    min={2}
                                    max={26}
                                    value={totalVariants}
                                    onChange={(e) => setTotalVariants(parseInt(e.target.value) || 4)}
                                    className="w-full px-3 py-2 border rounded-lg text-slate-800"
                                />
                            </div>
                        </div>
                        <button
                            onClick={createSession}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition shadow-lg"
                        >
                            Create Session
                        </button>
                    </div>
                )}

                {/* Session Controls */}
                {session && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Waiting Queue */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-800">
                                    Waiting Queue ({waitingStudents.length})
                                </h2>
                                {waitingStudents.length > 0 && session.status === 'waiting' && (
                                    <button
                                        onClick={autoAssignAll}
                                        className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
                                    >
                                        Auto-Assign All
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {waitingStudents.length === 0 ? (
                                    <p className="text-slate-500 text-sm">No students waiting</p>
                                ) : (
                                    waitingStudents.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => setSelectedStudent(selectedStudent === p.id ? null : p.id)}
                                            className={`p-3 rounded-lg cursor-pointer transition ${selectedStudent === p.id
                                                ? 'bg-indigo-100 border-2 border-indigo-500'
                                                : 'bg-slate-50 hover:bg-slate-100'
                                                }`}
                                        >
                                            <p className="text-sm font-medium text-slate-800">{p.student_email || 'Unknown'}</p>
                                            <p className="text-xs text-slate-500">Joined {new Date(p.joined_at).toLocaleTimeString()}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                            {selectedStudent && (
                                <p className="mt-3 text-sm text-indigo-600 font-medium">
                                    Click on a seat to assign
                                </p>
                            )}
                        </div>

                        {/* Seating Grid */}
                        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-slate-800">
                                    Seating Grid ({seatedStudents.length} seated)
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <div className="inline-block">
                                    {/* Column headers */}
                                    <div className="flex mb-2">
                                        <div className="w-8"></div>
                                        {Array.from({ length: session.columns }).map((_, col) => (
                                            <div key={col} className="w-12 h-6 flex items-center justify-center text-xs text-slate-500 font-medium">
                                                {col + 1}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Rows */}
                                    {Array.from({ length: session.rows }).map((_, row) => (
                                        <div key={row} className="flex mb-1">
                                            <div className="w-8 h-10 flex items-center justify-center text-xs text-slate-500 font-medium">
                                                {row + 1}
                                            </div>
                                            {Array.from({ length: session.columns }).map((_, col) => {
                                                const participant = getParticipantAtSeat(row, col);
                                                const variantLabel = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[calculateVariantIndex(row, col, session.total_variants)];
                                                return (
                                                    <div
                                                        key={col}
                                                        onClick={() => !participant && selectedStudent && assignSeat(row, col)}
                                                        className={`w-12 h-10 m-0.5 rounded-lg flex items-center justify-center text-xs font-bold transition cursor-pointer ${participant
                                                            ? participant.status === 'taking'
                                                                ? 'bg-green-500 text-white'
                                                                : participant.status === 'submitted'
                                                                    ? 'bg-slate-400 text-white'
                                                                    : 'bg-indigo-500 text-white'
                                                            : selectedStudent
                                                                ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-600 border-2 border-dashed border-indigo-300'
                                                                : 'bg-slate-100 text-slate-400'
                                                            }`}
                                                        title={participant ? participant.student_email || 'Student' : `Seat ${row + 1}-${col + 1} (Variant ${variantLabel})`}
                                                    >
                                                        {participant ? variantLabel : '·'}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 bg-indigo-500 rounded"></div>
                                    <span className="text-slate-600">Seated</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                                    <span className="text-slate-600">Taking Quiz</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-4 h-4 bg-slate-400 rounded"></div>
                                    <span className="text-slate-600">Submitted</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {session && (
                    <div className="mt-6 flex gap-4">
                        {session.status === 'waiting' && seatedStudents.length > 0 && (
                            <button
                                onClick={startQuiz}
                                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition shadow-lg text-lg"
                            >
                                🚀 Start Quiz (Green Light)
                            </button>
                        )}
                        {session.status === 'live' && (
                            <button
                                onClick={endQuiz}
                                className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg"
                            >
                                End Quiz
                            </button>
                        )}
                    </div>
                )}

                {/* Stats Summary */}
                {session && (
                    <div className="mt-6 grid grid-cols-4 gap-4">
                        <div className="bg-white/80 backdrop-blur-xl rounded-xl p-4 shadow-lg border border-white/20 text-center">
                            <p className="text-3xl font-bold text-yellow-600">{waitingStudents.length}</p>
                            <p className="text-sm text-slate-600">Waiting</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-xl p-4 shadow-lg border border-white/20 text-center">
                            <p className="text-3xl font-bold text-indigo-600">{seatedStudents.length}</p>
                            <p className="text-sm text-slate-600">Seated</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-xl p-4 shadow-lg border border-white/20 text-center">
                            <p className="text-3xl font-bold text-green-600">{takingStudents.length}</p>
                            <p className="text-sm text-slate-600">Taking Quiz</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-xl rounded-xl p-4 shadow-lg border border-white/20 text-center">
                            <p className="text-3xl font-bold text-slate-600">{participants.filter(p => p.status === 'submitted').length}</p>
                            <p className="text-sm text-slate-600">Submitted</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
