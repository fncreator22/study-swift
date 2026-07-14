import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, ShieldAlert, User, Key, BarChart3, Coins, CreditCard, Clock, Award, Download, Share2, Trophy, Medal, Star } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CertificateModal } from "@/components/CertificateModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_student/profile")({ component: Profile });

function Profile() {
  const { user, signOut, tokens, refreshProfile } = useAuth();
  const nav = useNavigate();
  const router = useRouter();
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
      supabase.from("course_certificates_v2").select(`
        id,
        recipient_name,
        date_of_birth,
        issued_at,
        final_score,
        certificate_number,
        course_enrollments_v2!inner(
          user_id,
          course_id,
          courses_v2(
            title,
            instructor_name
          )
        )
      `).eq("course_enrollments_v2.user_id", user.id).order("issued_at", { ascending: false })
    ]);
    
    setName(p?.full_name ?? ""); 
    setCollege(p?.college ?? "");
    setCountry(p?.country ?? "India");
    setStateName(p?.state ?? "Delhi");
    setAddress(p?.address ?? "");
    setTimeSpent(p?.total_time_spent ?? 0);

    const mappedCerts = (certs ?? []).map((c: any) => ({
      id: c.id,
      recipient_name: c.recipient_name,
      date_of_birth: c.date_of_birth,
      issued_at: c.issued_at,
      score: c.final_score,
      total: 100,
      certificate_code: c.certificate_number,
      course_title: c.course_enrollments_v2?.courses_v2?.title || "Unknown Course",
      instructor_name: c.course_enrollments_v2?.courses_v2?.instructor_name || "Expert Educator"
    }));
    setCertificates(mappedCerts);

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
    router.invalidate();
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
    <div className="mx-auto max-w-5xl pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight">Profile & Settings</h1>
        <Button variant="outline" size="sm" onClick={handleLogout} className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
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

      <Tabs defaultValue="profile" className="mt-8">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile & Settings</TabsTrigger>
          <TabsTrigger value="achievements">
            Achievements{certificates.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 min-w-[18px]">
                {certificates.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-soft h-fit">
              <div className="flex items-center gap-2 mb-6">
                <User className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold">Personal info</h2>
              </div>
              <div className="grid gap-4">
                <div className="space-y-2"><Label>Email address</Label><Input value={user?.email ?? ""} disabled className="bg-muted/50" /></div>
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Your Name" 
                    disabled={certificates.length > 0}
                    className={certificates.length > 0 ? "bg-muted/50 cursor-not-allowed" : ""}
                  />
                  {certificates.length > 0 && (
                    <p className="text-[10px] text-muted-foreground italic mt-0.5 font-medium">🔒 Name locked due to issued certifications.</p>
                  )}
                </div>
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
        </TabsContent>

        <TabsContent value="achievements">
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-500" />
                Your Certifications
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {certificates.length} certificate{certificates.length !== 1 ? 's' : ''} earned
              </p>
            </div>

            {certificates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border p-16 text-center">
                <Medal className="mx-auto h-16 w-16 text-muted-foreground/20 mb-4" />
                <h3 className="font-display font-bold text-lg text-muted-foreground">No Certificates Yet</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  Complete a course and pass the final assessment to earn your first professional certificate.
                </p>
                <Link to="/courses">
                  <Button className="mt-6 rounded-xl">Browse Courses</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {certificates.map((cert) => (
                  <div key={cert.id} className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden group">
                    {/* Certificate preview thumbnail */}
                    <div className="bg-gradient-to-br from-[#1e3a8a]/10 via-[#d4af37]/5 to-[#1e3a8a]/5 p-6 border-b border-border text-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d4af37] to-[#aa771c] flex items-center justify-center mx-auto shadow-md">
                        <Trophy className="h-6 w-6 text-white" />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-3">Examly LMS Certificate</p>
                    </div>

                    <div className="p-5 space-y-3">
                      <div>
                        <h3 className="font-display font-bold line-clamp-2 text-base leading-tight">{cert.course_title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Instructor: {cert.instructor_name}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Issued: {new Date(cert.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="font-mono bg-muted px-2 py-0.5 rounded text-[9px]">{cert.certificate_code.slice(0, 8).toUpperCase()}</span>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button 
                          size="sm" 
                          className="flex-1 rounded-xl text-xs font-bold"
                          onClick={() => { setSelectedCert(cert); setCertModalOpen(true); }}
                        >
                          <Award className="mr-1.5 h-3 w-3" /> View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="rounded-xl text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/verify-certificate/${cert.certificate_code}`);
                            toast.success('Verification link copied!');
                          }}
                        >
                          <Share2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {selectedCert && (
        <CertificateModal open={certModalOpen} onOpenChange={setCertModalOpen} certificate={selectedCert} />
      )}
    </div>
  );
}
