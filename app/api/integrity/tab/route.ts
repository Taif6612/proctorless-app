/**
 * POST /api/integrity/tab
 * 
 * Receives URL logs from the ProctorLess Focus Chrome extension
 * Stores them in the integrity_tab_logs table for professor review
 * 
 * Request body:
 * {
 *   "url": "https://facebook.com",
 *   "ts": 1699874400000,
 *   "kind": "ACTIVE_TAB_URL",
 *   "examToken": "Bearer ...", (optional)
 *   "submissionId": "uuid" (optional)
 * }
 * 
 * Response:
 * {
 *   "ok": true,
 *   "id": 12345
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role (server-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

/**
 * Extract user_id from Bearer token (JWT)
 * This is a simple implementation; adjust based on your auth scheme
 */
function extractUserIdFromToken(token: string): string | null {
  if (!token.startsWith('Bearer ')) {
    return null;
  }

  const jwtToken = token.replace('Bearer ', '');

  try {
    // Decode JWT (simple base64 decode, not validating signature)
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return null;

    const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return decoded.sub || decoded.user_id || null;
  } catch (error) {
    console.warn('[API] Failed to decode token:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, ts, kind = 'ACTIVE_TAB_URL', examToken, submissionId } = body;

    // Validate required fields
    if (!url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
        { status: 400 }
      );
    }

    if (!ts) {
      return NextResponse.json(
        { error: 'Missing required field: ts' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      userId = extractUserIdFromToken(authHeader);
    }

    // If we have a submission_id, fetch the associated user_id from submissions table
  let finalUserId = userId;
  if (submissionId && !finalUserId) {
    const { data: submission } = await supabase
      .from('submissions')
      .select('student_id')
      .eq('id', submissionId)
      .single();

    if (submission) {
      finalUserId = (submission as any).student_id;
    }
  }

    // If still no user_id, return 401
    if (!finalUserId) {
      return NextResponse.json(
        { error: 'Could not identify user. Missing token or submission_id.' },
        { status: 401 }
      );
    }

    // Insert into integrity_tab_logs table
    const { data, error } = await supabase
      .from('integrity_tab_logs')
      .insert([
        {
          user_id: finalUserId,
          submission_id: submissionId || null,
          url,
          ts_ms: ts,
          kind,
          created_at: new Date().toISOString()
        }
      ])
      .select('id')
      .single();

    if (error) {
      console.error('[API] Failed to insert log:', error);
      return NextResponse.json(
        { error: 'Failed to store log', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[API] URL log stored: user_id=${finalUserId}, url=${url}, id=${data.id}`);

    return NextResponse.json(
      {
        ok: true,
        id: data.id,
        message: 'Log stored successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Optional: Add GET method to retrieve logs (for debugging)
 * In production, only professors should be able to call this
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication check to ensure only professors can view

    const submissionId = request.nextUrl.searchParams.get('submissionId');

    if (!submissionId) {
      return NextResponse.json(
        { error: 'Missing submissionId query parameter' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('integrity_tab_logs')
      .select('*')
      .eq('submission_id', submissionId)
      .order('ts_ms', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to retrieve logs', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count: data.length,
        logs: data
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
