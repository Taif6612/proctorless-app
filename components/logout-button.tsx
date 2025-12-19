"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Use window.location for hard page reload (ensures server components refresh)
    window.location.href = "/auth/login";
  };

  return (
    <div onClick={logout} className="flex items-center cursor-pointer">
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </div>
  );
}
