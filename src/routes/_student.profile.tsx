import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, ShieldAlert, User, Key, BarChart3, Coins, CreditCard, Clock, Award } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CertificateModal } from "@/components/CertificateModal";

export const Route = createFileRoute("/_student/profile")({ component: Profile });

function Profile() {
  const { user, signOut, tokens, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [country, setCountry] = useState("India");
  const [stateName, setStateName] = useState("Delhi");
  const [address, setAddress] = useState("");
  const [timeSpent, setTimeSpent] = useState(0);
  const [activeSub, setActiveSub] = useState("Basic Tier");
  const [pwd, setPwd] = useState("");
  const [stats, setStats] = useState({ attempts: 0, purchases: 0, score: 0, avg: 0 });
  const [loading, setLoading] = useState(false);

  // Accomplishments state
  const [certificates, setCertificates] = useState<any[]>([]);
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [certModalOpen, setCertModalOpen] = useState(false);

  async function loadData() {
    if (!user) return;
    const [{ data: p }, { data: r }, { count: pc }, { data: mem }, { data: certs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("rankings_view").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("memberships" as any).select("*, subscriptions(*)").eq("user_id", user.id).eq("status", "active").order("valid_until", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("certificates").select("*").eq("user_id", user.id).order("issued_at", { ascending: false })
    ]);
    
    setName(p?.full_name ?? ""); 
    setCollege(p?.college ?? "");
    setCountry(p?.country ?? "India");
    setStateName(p?.state ?? "Delhi");
    setAddress(p?.address ?? "");
    setTimeSpent(p?.total_time_spent ?? 0);
    setCertificates(certs ?? []);
    
    const isSubActive = mem && new Date(mem.valid_until) > new Date();
    setActiveSub(isSubActive ? ((mem as any).subscriptions?.name || mem.plan || "Premium Tier") : "Basic Tier (Free)");

    setStats({
      attempts: r?.attempts_count ?? 0,
      purchases: pc ?? 0,
      score: r?.total_score ?? 0,
      avg: r?.avg_percentage ?? 0,
    });
  }

  useEffect(() => { loadData(); }, [user]);

  async function save() {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ 
      full_name: name, 
      college,
      country,
      state: stateName,
      address
    }).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile details saved successfully!");
    refreshProfile?.();
    nav({ to: "/welcome-subscription" });
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

  const formatTimeSpent = (mins: number) => {
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  };

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Profile & Settings</h1>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" /></div>
              <div className="space-y-2"><Label>State</Label><Input value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="State" /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="City / address" /></div>
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
                    <p className="text-xs text-muted-foreground">Active Subscription Plan</p>
                  </div>
                </div>
                <p className="text-sm font-bold uppercase tracking-wider text-primary truncate max-w-[150px]">{activeSub}</p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Clock className="h-5 w-5" /></div>
                  <div>
                    <p className="text-sm font-medium">Time on System</p>
                    <p className="text-xs text-muted-foreground">Total logged study time</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-foreground font-mono">{formatTimeSpent(timeSpent)}</p>
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

      {/* Accomplishments & Certificates List */}
      <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2 mb-6">
          <Award className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold">Accomplishments & Certificates</h2>
            <p className="text-xs text-muted-foreground">Download or share your verified course completion certificates.</p>
          </div>
        </div>
        
        {certificates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm italic">
            No certificates earned yet. Complete course certification exams to receive your verified accomplishments.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {certificates.map((c) => {
              const scorePct = c.total > 0 ? Math.round((c.score / c.total) * 100) : 0;
              return (
                <div key={c.id} className="flex flex-col justify-between p-5 rounded-2xl border border-border bg-muted/20 relative overflow-hidden group hover:border-primary/30 transition-all">
                  <div className="space-y-1">
                    <span className="inline-block rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                      Verified Certificate
                    </span>
                    <h3 className="font-serif font-bold text-slate-800 line-clamp-1 pt-2">{c.course_title}</h3>
                    <p className="text-[10px] text-muted-foreground">Issued on {new Date(c.issued_at).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-600 font-medium">Final Exam Grade: <span className="text-emerald-600 font-bold">{scorePct}%</span></p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center">
                    <span className="text-[9px] font-mono text-slate-400">ID: {c.certificate_code}</span>
                    <Button 
                      size="xs" 
                      onClick={() => { setSelectedCert(c); setCertModalOpen(true); }}
                      className="rounded-lg bg-primary hover:bg-primary/95 text-white flex items-center gap-1.5"
                    >
                      <Award className="h-3 w-3" /> View Certificate
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedCert && (
        <CertificateModal open={certModalOpen} onOpenChange={setCertModalOpen} certificate={selectedCert} />
      )}
    </div>
  );
}
