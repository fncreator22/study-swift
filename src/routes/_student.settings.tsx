import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_student/settings")({ component: Settings });

function Settings() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");

  async function changePwd() {
    if (pwd.length < 6) return toast.error("Password must be 6+ chars");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPwd("");
  }

  async function deleteAccount() {
    if (!user) return;
    // delete profile (cascades attempts, purchases, comments via FK)
    await supabase.from("profiles").delete().eq("id", user.id);
    await signOut();
    toast.success("Account deleted");
    nav({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Settings</h1>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Change password</h2>
        <div className="mt-4 flex gap-3">
          <div className="flex-1"><Label>New password</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
          <div className="flex items-end"><Button onClick={changePwd}>Update</Button></div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-display text-lg font-semibold text-destructive">Danger zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">Permanently delete your account and all data.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="mt-4">Delete account</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete account?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone. All attempts and purchases will be lost.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteAccount}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
