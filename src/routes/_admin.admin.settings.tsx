import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const { user } = useAuth();
  const [pwd, setPwd] = useState("");
  async function changePwd() {
    if (pwd.length < 6) return toast.error("Password must be 6+ chars");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) return toast.error(error.message);
    toast.success("Password updated"); setPwd("");
  }
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Admin settings</h1>
      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Profile</h2>
        <div className="mt-4"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
      </div>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Change password</h2>
        <div className="mt-4 flex gap-3">
          <div className="flex-1"><Label>New password</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
          <div className="flex items-end"><Button onClick={changePwd}>Update</Button></div>
        </div>
      </div>
    </div>
  );
}
