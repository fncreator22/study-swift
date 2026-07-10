import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, ShieldAlert, User, Key, BarChart3, Coins, CreditCard } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

  async function handleLogout() {
    await signOut();
    toast.success("Logged out");
    nav({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">Profile & Settings</h1>
        <Button variant="outline" size="sm" onClick={handleLogout} className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { l: "Attempts", v: stats.attempts, icon: BarChart3 }, 
          { l: "Purchases", v: stats.purchases, icon: User },
          { l: "Total score", v: stats.score, icon: BarChart3 }, 
          { l: "Avg %", v: `${stats.avg}%`, icon: BarChart3 },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.l}</p>
            <p className="mt-1 font-display text-2xl font-bold">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft h-fit">
          <div className="flex items-center gap-2 mb-6">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Personal info</h2>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2"><Label>Email address</Label><Input value={user?.email ?? ""} disabled className="bg-muted/50" /></div>
            <div className="space-y-2"><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" /></div>
            <div className="space-y-2"><Label>College / University</Label><Input value={college} onChange={(e) => setCollege(e.target.value)} placeholder="University Name" /></div>
            <Button onClick={save} disabled={loading} className="mt-2 w-full rounded-xl">{loading ? "Saving..." : "Save profile"}</Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 mb-6">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Membership & Wallet</h2>
            </div>
            <div className="space-y-4">
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

          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 mb-6">
              <Key className="h-5 w-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Security</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Update password</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="New password" /></div>
              <Button onClick={changePwd} variant="outline" className="w-full rounded-xl">Update password</Button>
            </div>
          </div>

          <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6">
            <div className="flex items-center gap-2 mb-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <h2 className="font-display text-lg font-bold">Danger zone</h2>
            </div>
            <p className="text-sm text-muted-foreground">This will permanently delete your account and all progress.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="mt-4 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/10">Delete my account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl border-destructive/20">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. All your test attempts, scores, and purchases will be permanently removed.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAccount} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, delete everything</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
