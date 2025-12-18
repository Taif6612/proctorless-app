import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ ok: false, error: 'service role missing' }, { status: 500 });
    const admin = createClient(url, key);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const target = (list?.users || []).find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (!target) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
    const uid = target.id;
    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', uid).maybeSingle();
    return NextResponse.json({ ok: true, role: roleRow?.role || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
