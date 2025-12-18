import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, role, actorEmail } = await req.json();
    if (!email || !role) {
      return NextResponse.json({ ok: false, error: 'email and role required' }, { status: 400 });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ ok: false, error: 'service role missing' }, { status: 500 });
    const admin = createClient(url, key);
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const target = (list?.users || []).find((u: any) => (u.email || '').toLowerCase() === String(email).toLowerCase());
    if (!target) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
    const uid = target.id;
    const { data: existing } = await admin.from('user_roles').select('*').eq('user_id', uid).maybeSingle();
    if (existing) {
      const { error: updErr } = await admin.from('user_roles').update({ role }).eq('user_id', uid);
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    } else {
      const { error: insErr } = await admin.from('user_roles').insert({ user_id: uid, role });
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }
    try {
      let actorId: string | null = null;
      if (actorEmail) {
        const { data: whoList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const actor = (whoList?.users || []).find((u: any) => (u.email || '').toLowerCase() === String(actorEmail).toLowerCase());
        actorId = actor?.id || null;
      }
      await admin.from('admin_audit_logs').insert({ actor_id: actorId, actor_email: actorEmail || null, action: 'set_role', target_user_id: uid, details: { email, role } });
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
