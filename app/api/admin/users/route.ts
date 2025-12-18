import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) return NextResponse.json({ ok: false, error: 'service role missing' }, { status: 500 });
  const admin = createClient(url, key);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 25 });
  const users = (data?.users || []).map((u: any) => ({ id: u.id, email: u.email }));
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: NextRequest) {
  const { email, password, actorEmail } = await req.json();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) return NextResponse.json({ ok: false, error: 'service role missing' }, { status: 500 });
  const admin = createClient(url, key);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  try {
    await admin.from('admin_audit_logs').insert({ actor_email: actorEmail || null, action: 'create_user', target_user_id: data.user?.id || null, details: { email } });
  } catch {}
  return NextResponse.json({ ok: true, id: data.user?.id || null });
}

export async function DELETE(req: NextRequest) {
  const { email, actorEmail } = await req.json();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) return NextResponse.json({ ok: false, error: 'service role missing' }, { status: 500 });
  const admin = createClient(url, key);
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const target = (list?.users || []).find((u: any) => (u.email || '').toLowerCase() === String(email).toLowerCase());
  if (!target) return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  const { error } = await admin.auth.admin.deleteUser(target.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  try {
    await admin.from('admin_audit_logs').insert({ actor_email: actorEmail || null, action: 'delete_user', target_user_id: target.id, details: { email } });
  } catch {}
  return NextResponse.json({ ok: true });
}
