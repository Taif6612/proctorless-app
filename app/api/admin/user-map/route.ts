import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userIds = (body?.userIds || []) as string[];
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'userIds array required' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ ok: false, error: 'Supabase service role not configured' }, { status: 500 });
    }

    const admin = createClient(url, key);
    const map: Record<string, string> = {};
    for (const id of userIds) {
      try {
        const { data } = await admin.auth.admin.getUserById(id);
        const email = data?.user?.email || '';
        if (email) map[id] = email;
      } catch {}
    }
    return NextResponse.json({ ok: true, map });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

