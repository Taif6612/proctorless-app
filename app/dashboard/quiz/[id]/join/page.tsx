'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { autoIdentifyMachine, MachineFingerprint, MachineIdentification } from '@/lib/machineFingerprint';
import { formatTime } from '@/lib/seating';

/**
 * Auto-Join Page: /dashboard/quiz/[id]/join
 * 
 * Simplified flow:
 * 1. Student accesses this page from enrolled course
 * 2. System auto-detects machine via fingerprint
 * 3. If machine recognized → auto-assign seat and variant
 * 4. If machine not recognized → show "waiting for proctor" message
 * 5. Wait for professor to start quiz
 * 6. Auto-redirect to quiz page when live
 */

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
    student_id: string;
    seat_row: number | null;
    seat_column: number | null;
    variant_index: number | null;
    status: string;
}

export default function AutoJoinQuizPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.id as string;
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'identifying' | 'joining' | 'seated' | 'waiting' | 'live' | 'error'>('identifying');
    const [statusMessage, setStatusMessage] = useState('Identifying machine...');

    const [user, setUser] = useState<any>(null);
    const [quiz, setQuiz] = useState<any>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [myParticipation, setMyParticipation] = useState<Participant | null>(null);

    // Machine identification
    const [fingerprint, setFingerprint] = useState<MachineFingerprint | null>(null);
    const [machineInfo, setMachineInfo] = useState<MachineIdentification | null>(null);
    const [extensionAvailable, setExtensionAvailable] = useState(false);

    const [timeRemaining, setTimeRemaining] = useState(0);

    // Main flow: identify → join → wait for start
    const runAutoJoin = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Get user
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) {
                router.push('/auth/login');
                return;
            }
            setUser(currentUser);

            // 2. Fetch quiz
            const { data: quizData } = await supabase
                .from('quizzes')
                .select('id, title, course_id')
                .eq('id', quizId)
                .single();

            if (!quizData) {
                setStatus('error');
                setStatusMessage('Quiz not found');
                setLoading(false);
                return;
            }
            setQuiz(quizData);

            // 3. Fetch session
            const { data: sessionData } = await supabase
                .from('quiz_sessions')
                .select('*')
                .eq('quiz_id', quizId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!sessionData) {
                setStatus('error');
                setStatusMessage('No active session. Please wait for the professor to start a session.');
                setLoading(false);
                return;
            }
            setSession(sessionData as Session);

            // 4. Check if already participating
            const { data: existingParticipation } = await supabase
                .from('session_participants')
                .select('*')
                .eq('session_id', sessionData.id)
                .eq('student_id', currentUser.id)
                .single();

            if (existingParticipation) {
                setMyParticipation(existingParticipation as Participant);

                // Already joined - check status
                if (sessionData.status === 'live' && existingParticipation.seat_row !== null) {
                    // Quiz is live and we're seated - redirect to quiz
                    await handleQuizStart(existingParticipation, sessionData, currentUser);
                    return;
                } else if (existingParticipation.seat_row !== null) {
                    // Seated, waiting for start
                    setStatus('seated');
                    setStatusMessage('You are seated. Waiting for quiz to start...');
                } else {
                    // In queue, waiting for seat assignment
                    setStatus('waiting');
                    setStatusMessage('Waiting for proctor to assign your seat...');
                }
                setLoading(false);
                return;
            }

            // 5. Not participating yet - identify machine and join
            setStatus('identifying');
            setStatusMessage('Identifying machine...');

            const machineResult = await autoIdentifyMachine(sessionData.id, sessionData.total_variants);
            setFingerprint(machineResult.fingerprint);
            setMachineInfo(machineResult.identification);
            setExtensionAvailable(machineResult.extensionAvailable);

            // 6. Join session
            setStatus('joining');
            setStatusMessage('Joining quiz session...');

            let seatRow: number | null = null;
            let seatColumn: number | null = null;
            let variantIndex: number | null = null;
            let participantStatus = 'waiting';

            if (machineResult.identification?.identified && machineResult.identification.machine) {
                // Machine recognized - auto-assign seat
                seatRow = machineResult.identification.machine.row;
                seatColumn = machineResult.identification.machine.column;
                variantIndex = machineResult.identification.variantIndex ?? null;
                participantStatus = 'seated';

                console.log('[AutoJoin] Machine identified, auto-assigning:', { seatRow, seatColumn, variantIndex });
            } else {
                console.log('[AutoJoin] Machine not recognized, waiting for manual assignment');
            }

            // Insert participation
            const { data: newParticipation, error: insertError } = await supabase
                .from('session_participants')
                .insert({
                    session_id: sessionData.id,
                    student_id: currentUser.id,
                    student_email: currentUser.email,
                    seat_row: seatRow,
                    seat_column: seatColumn,
                    variant_index: variantIndex,
                    status: participantStatus,
                    machine_fingerprint: machineResult.fingerprint?.hash || null
                })
                .select()
                .single();

            if (insertError) {
                if (insertError.code === '23505') {
                    // Already joined (race condition) - refetch
                    const { data: refetched } = await supabase
                        .from('session_participants')
                        .select('*')
                        .eq('session_id', sessionData.id)
                        .eq('student_id', currentUser.id)
                        .single();

                    if (refetched) {
                        setMyParticipation(refetched as Participant);
                        if (refetched.seat_row !== null) {
                            setStatus('seated');
                            setStatusMessage('You are seated. Waiting for quiz to start...');
                        } else {
                            setStatus('waiting');
                            setStatusMessage('Waiting for proctor to assign your seat...');
                        }
                    }
                } else {
                    setStatus('error');
                    setStatusMessage('Failed to join: ' + insertError.message);
                }
                setLoading(false);
                return;
            }

            setMyParticipation(newParticipation as Participant);

            if (seatRow !== null) {
                setStatus('seated');
                setStatusMessage('You are seated. Waiting for quiz to start...');
            } else {
                setStatus('waiting');
                setStatusMessage('Waiting for proctor to assign your seat...');
            }

            setLoading(false);

        } catch (error: any) {
            console.error('[AutoJoin] Error:', error);
            setStatus('error');
            setStatusMessage('An error occurred: ' + error.message);
            setLoading(false);
        }
    }, [quizId, supabase, router]);

    // Handle transition to quiz
    const handleQuizStart = async (participation: Participant, sessionData: Session, currentUser: any) => {
        setStatus('live');
        setStatusMessage('Quiz is starting...');

        // Update status to taking
        if (participation.status === 'seated' || participation.status === 'ready') {
            await supabase
                .from('session_participants')
                .update({ status: 'taking', started_at: new Date().toISOString() })
                .eq('id', participation.id);
        }

        // Create submission if needed
        const { data: existingSub } = await supabase
            .from('submissions')
            .select('id')
            .eq('quiz_id', quizId)
            .eq('student_id', currentUser.id)
            .maybeSingle();

        if (!existingSub) {
            await supabase
                .from('submissions')
                .insert({
                    quiz_id: quizId,
                    student_id: currentUser.id,
                    started_at: new Date().toISOString()
                });
        }

        // Redirect to quiz
        router.push(`/dashboard/quiz/${quizId}?variant=${participation.variant_index}`);
    };

    // Run on mount
    useEffect(() => {
        runAutoJoin();
    }, [runAutoJoin]);

    // Real-time subscription for updates
    useEffect(() => {
        if (!session?.id || !user?.id) return;

        const channel = supabase
            .channel(`autojoin-${session.id}-${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'session_participants',
                filter: `session_id=eq.${session.id}`
            }, async (payload) => {
                // Check if it's our participation that changed
                const changed = payload.new as any;
                if (changed?.student_id === user.id) {
                    setMyParticipation(changed as Participant);

                    if (changed.seat_row !== null && status === 'waiting') {
                        setStatus('seated');
                        setStatusMessage('You have been assigned a seat!');
                    }
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'quiz_sessions',
                filter: `id=eq.${session.id}`
            }, async (payload) => {
                const updated = payload.new as any;
                setSession(updated as Session);

                // Quiz started!
                if (updated.status === 'live' && myParticipation?.seat_row !== null) {
                    await handleQuizStart(myParticipation, updated, user);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.id, user?.id, myParticipation, status, supabase]);

    // Timer
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

    // Render based on status
    const getStatusIcon = () => {
        switch (status) {
            case 'identifying': return '🔍';
            case 'joining': return '⏳';
            case 'waiting': return '⏰';
            case 'seated': return '✅';
            case 'live': return '🚀';
            case 'error': return '❌';
            default: return '📝';
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'seated': return 'from-green-500 to-emerald-600';
            case 'live': return 'from-green-600 to-teal-600';
            case 'error': return 'from-red-500 to-rose-600';
            case 'waiting': return 'from-yellow-500 to-amber-600';
            default: return 'from-indigo-500 to-purple-600';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Joining Quiz</h1>
                    <p className="text-slate-600">{statusMessage}</p>
                </div>
            </div>
        );
    }

    const variantLabel = myParticipation?.variant_index !== null
        ? String.fromCharCode(65 + (myParticipation.variant_index || 0))
        : null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="text-center max-w-md bg-white/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg">
                {/* Status Icon */}
                <div className={`w-20 h-20 bg-gradient-to-br ${getStatusColor()} rounded-2xl mx-auto mb-6 flex items-center justify-center`}>
                    <span className="text-4xl">{getStatusIcon()}</span>
                </div>

                {/* Quiz Title */}
                <h1 className="text-2xl font-bold text-slate-800 mb-2">{quiz?.title || 'Quiz'}</h1>

                {/* Status Message */}
                <p className="text-slate-600 mb-6">{statusMessage}</p>

                {/* Seat Info (if seated) */}
                {status === 'seated' && myParticipation?.seat_row !== null && (
                    <div className="bg-indigo-50 rounded-xl p-4 mb-6">
                        <p className="text-lg text-indigo-700 font-semibold">
                            Row {(myParticipation.seat_row || 0) + 1}, Seat {(myParticipation.seat_column || 0) + 1}
                        </p>
                        {variantLabel && (
                            <p className="text-sm text-indigo-600 mt-1">
                                Question Set: <strong>{variantLabel}</strong>
                            </p>
                        )}
                    </div>
                )}

                {/* Machine Info (if identified) */}
                {machineInfo?.identified && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm">
                        <p className="text-green-700">
                            ✓ Machine: {machineInfo.machine?.label || `Row ${(machineInfo.machine?.row || 0) + 1}, Col ${(machineInfo.machine?.column || 0) + 1}`}
                        </p>
                    </div>
                )}

                {/* Waiting for proctor */}
                {status === 'waiting' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 justify-center">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                            <p className="text-yellow-700 font-medium">Waiting for proctor...</p>
                        </div>
                        <p className="text-xs text-yellow-600 mt-2">
                            The professor will assign you a seat. Stay on this page.
                        </p>
                    </div>
                )}

                {/* Waiting for start */}
                {status === 'seated' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 justify-center">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <p className="text-green-700 font-medium">Ready! Waiting for quiz to start...</p>
                        </div>
                    </div>
                )}

                {/* Error state */}
                {status === 'error' && (
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="w-full py-3 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition"
                    >
                        Back to Dashboard
                    </button>
                )}

                {/* Timer (if quiz is live) */}
                {session?.status === 'live' && (
                    <div className="text-4xl font-mono font-bold text-green-600 mb-4">
                        {formatTime(timeRemaining)}
                    </div>
                )}
            </div>
        </div>
    );
}
