'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Waiting Room Redirect
 * 
 * This page now simply redirects to the new /join page
 * which handles auto-identification and joining.
 * 
 * Kept for backwards compatibility with existing links.
 */
export default function WaitingRoomRedirect() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.id as string;

    useEffect(() => {
        if (quizId) {
            router.replace(`/dashboard/quiz/${quizId}/join`);
        }
    }, [quizId, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="text-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Redirecting to quiz...</p>
            </div>
        </div>
    );
}
