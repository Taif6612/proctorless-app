import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { Settings, User } from "lucide-react";
import AuthButtonClient from "./auth-button-client";

export async function AuthButton() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  const user = userResp?.user;
  let role: string | undefined = undefined;
  let fullName: string | undefined = undefined;
  let avatarUrl: string | undefined = undefined;
  let avatarSrc: string | undefined = undefined;
  if (user?.id) {
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    role = roleRow?.role;
    const { data: profileRow } = await supabase
      .from('users')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    fullName = profileRow?.full_name || (user.user_metadata?.full_name as string | undefined);
    avatarUrl = profileRow?.avatar_url as string | undefined;
    if (avatarUrl) {
      if (avatarUrl.includes('/object/public/')) {
        avatarSrc = avatarUrl;
      } else {
        const idx = avatarUrl.indexOf('/avatars/');
        const key = idx >= 0 ? avatarUrl.substring(idx + '/avatars/'.length) : avatarUrl;
        try {
          const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(key, 600);
          avatarSrc = signed?.signedUrl || avatarUrl;
        } catch {
          avatarSrc = avatarUrl;
        }
      }
    } else {
      try {
        const { data: files } = await supabase.storage.from('avatars').list(user.id, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });
        const f = files && files.length > 0 ? files[0] : null;
        if (f?.name) {
          const key = `${user.id}/${f.name}`;
          const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(key, 600);
          avatarSrc = signed?.signedUrl;
        }
      } catch {}
    }
  }

  return (
    <AuthButtonClient
      userEmail={user?.email}
      role={role}
      fullName={fullName}
      avatarSrc={avatarSrc}
    />
  );
}
