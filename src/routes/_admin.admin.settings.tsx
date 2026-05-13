import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, Key, User } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");

  async function changePwd() {
    if (pwd.length < 6) return toast.error("Password must be 6+ chars");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) return toast.error(error.message);
    toast.success("Password updated"); setPwd("");
  }

  async function handleLogout() {
    await signOut();
    toast.success("Logged out");
    nav({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <Button variant="outline" size="sm" onClick={handleLogout} className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-6">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Profile</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Email address</Label><Input value={user?.email ?? ""} disabled className="bg-muted/50" /></div>
            <p className="text-xs text-muted-foreground">Admin credentials are managed via Supabase Auth.</p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-6">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Security</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-2"><Label>New password</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Minimum 6 characters" /></div>
            <Button onClick={changePwd} className="w-full rounded-xl">Update password</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
