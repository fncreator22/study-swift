import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { LogOut, Shield, Coins, CreditCard, Trash2, Key, User } from "lucide-react";

export const Route = createFileRoute("/_student/profile")({ component: Profile });

function Profile() {
  const { user, signOut, tokens, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [pwd, setPwd] = useState("");
  const [stats, setStats] = useState({ attempts: 0, purchases: 0, score: 0, avg: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setName(p?.full_name ?? ""); setCollege(p?.college ?? "");
      const { data: r } = await supabase.from("rankings_view").select("*").eq("user_id", user.id).maybeSingle();
      const { count: pc } = await supabase.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      setStats({
        attempts: r?.attempts_count ?? 0,
        purchases: pc ?? 0,
        score: r?.total_score ?? 0,
        avg: r?.avg_percentage ?? 0,
      });
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ full_name: name, college }).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refreshProfile?.();
  }

  async function changePwd() {
    if (pwd.length < 6) return toast.error("Password must be 6+ chars");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPwd("");
  }

  async function deleteAccount() {
    if (!user) return;
    await supabase.from("profiles").delete().eq("id", user.id);
    await signOut();
    toast.success("Account deleted");
    nav({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Profile & Settings</h1>
        <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={async () => { await signOut(); nav({ to: "/" }); }}>
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </Button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          { l: "Attempts", v: stats.attempts }, { l: "Purchases", v: stats.purchases },
          { l: "Total score", v: stats.score }, { l: "Avg %", v: `${stats.avg}%` },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="text-xs text-muted-foreground">{s.l}</p>
            <p className="mt-1 font-display text-2xl font-bold">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="space-y-8">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <User className="h-5 w-5 text-primary" /> Personal info
            </h2>
            <div className="mt-4 grid gap-4">
              <div><Label>Email</Label><Input value={user?.email ?? ""} disabled className="bg-muted" /></div>
              <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>College / University</Label><Input value={college} onChange={(e) => setCollege(e.target.value)} /></div>
            </div>
            <div className="mt-5"><Button onClick={save} disabled={loading}>Save changes</Button></div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Key className="h-5 w-5 text-primary" /> Security
            </h2>
            <div className="mt-4">
              <Label>New password</Label>
              <div className="mt-1.5 flex gap-3">
                <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="6+ characters" />
                <Button onClick={changePwd} disabled={loading} variant="outline">Update</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Shield className="h-5 w-5 text-primary" /> Membership & Wallet
            </h2>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Coins className="h-5 w-5" /></div>
                  <div>
                    <p className="text-sm font-medium">Token Balance</p>
                    <p className="text-xs text-muted-foreground">Used for unlocking tests</p>
                  </div>
                </div>
                <p className="font-display text-xl font-bold">{tokens}</p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></div>
                  <div>
                    <p className="text-sm font-medium">Account Status</p>
                    <p className="text-xs text-muted-foreground">Membership level</p>
                  </div>
                </div>
                <p className="text-sm font-bold uppercase tracking-wider text-primary">Standard</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-destructive">
              <Trash2 className="h-5 w-5" /> Danger zone
            </h2>
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
      </div>
    </div>
  );
}
