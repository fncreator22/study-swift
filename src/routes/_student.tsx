import { useEffect, useState, useRef } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, BookOpen, CheckCircle, Clock, Trophy, Wallet, 
  PlayCircle, Crown, Settings, User, MessageSquare, GraduationCap, 
  Coins, Plus, LogOut, ArrowRight, Sparkles, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TokenRequestModal } from "@/components/TokenRequestModal";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_student")({ component: StudentLayout });

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tests", label: "All Tests", icon: BookOpen },
  { to: "/purchased", label: "Purchased", icon: CheckCircle },
  { to: "/history", label: "History", icon: Clock },
  { to: "/rankings", label: "Rankings", icon: Trophy },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/courses", label: "Courses", icon: PlayCircle },
  { to: "/subscriptions", label: "Subscriptions", icon: Crown },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/support", label: "Support", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: Settings },
] as const;

function getUserInitials(name?: string, email?: string) {
  const source = name || email || "Student";
  const clean = source.split("@")[0];
  const parts = clean.split(/[\s._-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function StudentLayout() {
  const { user, loading, signOut, tokens, isBlocked, isAdmin, refreshProfile } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isExamMode = path.includes("/attempt");
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ fullName: string; tier: string } | null>(null);
  const [hasMembership, setHasMembership] = useState<boolean | null>(null);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState<boolean | null>(null);

  // Marketing Campaign popups
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignReceiptOpen, setCampaignReceiptOpen] = useState(false);
  const [campaignReceiptFile, setCampaignReceiptFile] = useState<File | null>(null);
  const [submittingCampaignReceipt, setSubmittingCampaignReceipt] = useState(false);
  // Notifications
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  // Marketing plans selector / custom info
  const [allSubscriptions, setAllSubscriptions] = useState<any[]>([]);
  const [selectedPlanForCampaign, setSelectedPlanForCampaign] = useState<any>(null);
  const [customRequestText, setCustomRequestText] = useState("");

  // Refs & Queue states for sequential campaign popups and analytics
  const openedAtRef = useRef<number>(0);
  const hasLoggedClickOrCloseForActiveCampaignRef = useRef<boolean>(false);
  const viewEventLoggedRef = useRef<boolean>(false);
  const [campaignQueue, setCampaignQueue] = useState<any[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);

  useEffect(() => {
    if (user) {
      Promise.all([
        supabase
          .from("profiles")
          .select("full_name, membership_status, country, state")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("memberships")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
      ]).then(([{ data: profData }, { data: memData }]) => {
        if (profData) {
          setProfile({
            fullName: profData.full_name || "",
            tier: profData.membership_status || "free",
          });
          const incomplete = !profData.country || !profData.state;
          setIsProfileIncomplete(incomplete);
        }
        const activeMem = memData && memData.length > 0;
        setHasMembership(activeMem);
      });
    }
  }, [user, path]);

  useEffect(() => {
    if (!user) return;
    let localTime = 0;
    
    supabase.from("profiles").select("total_time_spent").eq("id", user.id).maybeSingle().then(({ data }) => {
      localTime = data?.total_time_spent ?? 0;
    });

    const interval = setInterval(async () => {
      localTime += 1;
      await supabase.from("profiles").update({ total_time_spent: localTime }).eq("id", user.id);
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

  const handleCampaignDismiss = (isUpgradeClick = false) => {
    if (!activeCampaign) return;
    const secondsSpent = Math.round((Date.now() - openedAtRef.current) / 1000);
    
    if (!hasLoggedClickOrCloseForActiveCampaignRef.current) {
      hasLoggedClickOrCloseForActiveCampaignRef.current = true;
      const metric = isUpgradeClick ? 'click' : 'close';
      supabase.rpc("increment_campaign_metric", {
        _campaign_id: activeCampaign.id,
        _metric: metric,
        _seconds: secondsSpent
      }).then(() => {});
    }

    setCampaignOpen(false);

    // Schedule next campaign in queue after a 10s gap to prevent overlapping/stacking
    const nextIdx = queueIndex + 1;
    if (nextIdx < campaignQueue.length) {
      setTimeout(() => {
        const nextCampaign = campaignQueue[nextIdx];
        setQueueIndex(nextIdx);
        setActiveCampaign(nextCampaign);
        setCampaignOpen(true);
        sessionStorage.setItem(`shown_campaign_${nextCampaign.id}`, "true");

        if (nextCampaign.plan_mode === 'all') {
          supabase.from("subscriptions" as any)
            .select("*")
            .eq("is_active", true)
            .then(({ data: subs }) => {
              setAllSubscriptions(subs ?? []);
              if (subs && subs.length > 0) {
                setSelectedPlanForCampaign(subs[0]);
              }
            });
        }
      }, 10000);
    }
  };

  // Marketing Campaign triggers and analytics
  useEffect(() => {
    if (!user || isBlocked || isAdmin || isExamMode) return;
    
    const trigger = path === "/welcome-subscription" ? "welcome" : "dashboard";

    supabase.from("marketing_campaigns")
      .select("*, subscriptions(*)")
      .eq("is_active", true)
      .eq("display_trigger", trigger)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const unshown = data.filter(c => !sessionStorage.getItem(`shown_campaign_${c.id}`));
          if (unshown.length > 0) {
            setCampaignQueue(unshown);
            setQueueIndex(0);
            
            const first = unshown[0];
            setActiveCampaign(first);
            setCampaignOpen(true);
            sessionStorage.setItem(`shown_campaign_${first.id}`, "true");

            if (first.plan_mode === 'all') {
              supabase.from("subscriptions" as any)
                .select("*")
                .eq("is_active", true)
                .then(({ data: subs }) => {
                  setAllSubscriptions(subs ?? []);
                  if (subs && subs.length > 0) {
                    setSelectedPlanForCampaign(subs[0]);
                  }
                });
            }
          }
        }
      });
  }, [user, path, isExamMode, isBlocked, isAdmin]);

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return;
    supabase
      .from("system_notifications" as any)
      .select("id")
      .eq("is_active", true)
      .then(({ data: notifs }) => {
        if (!notifs || notifs.length === 0) return setUnreadNotifCount(0);
        const ids = notifs.map((n: any) => n.id);
        supabase
          .from("notification_reads" as any)
          .select("notification_id")
          .eq("user_id", user.id)
          .in("notification_id", ids)
          .then(({ data: reads }) => {
            const readIds = new Set((reads ?? []).map((r: any) => r.notification_id));
            setUnreadNotifCount(ids.filter((id: string) => !readIds.has(id)).length);
          });
      });
  }, [user, path]);

  // Campaign 35s auto-dismiss + view-count at 5s (view metric triggered at 5s)
  useEffect(() => {
    if (campaignOpen && activeCampaign) {
      openedAtRef.current = Date.now();
      hasLoggedClickOrCloseForActiveCampaignRef.current = false;
      viewEventLoggedRef.current = false;

      // View count recorded after 5 seconds of opening
      const viewTimer = setTimeout(async () => {
        if (!viewEventLoggedRef.current) {
          viewEventLoggedRef.current = true;
          await supabase.rpc("increment_campaign_metric", {
            _campaign_id: activeCampaign.id,
            _metric: 'view',
            _seconds: 5
          });
        }
      }, 5000);

      // Auto-dismiss at 35s
      const closeTimer = setTimeout(() => {
        handleCampaignDismiss(false);
      }, 35000);

      return () => {
        clearTimeout(viewTimer);
        clearTimeout(closeTimer);
      };
    }
  }, [campaignOpen, activeCampaign]);

  async function handleCampaignClick() {
    if (!activeCampaign) return;
    handleCampaignDismiss(true);
    setCampaignReceiptOpen(true);
  }

  async function handleCampaignReceiptSubmit() {
    if (!campaignReceiptFile || submittingCampaignReceipt) return;
    setSubmittingCampaignReceipt(true);
    try {
      const fileExt = campaignReceiptFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, campaignReceiptFile);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);

      const targetSubId = activeCampaign?.plan_mode === 'specific'
        ? activeCampaign?.subscription_id
        : (activeCampaign?.plan_mode === 'all' ? selectedPlanForCampaign?.id : null);

      // Insert subscription request
      const { error: reqError } = await supabase.from("subscription_requests").insert({
        user_id: user.id,
        subscription_id: targetSubId,
        receipt_url: publicUrl,
        status: "pending",
        custom_details: activeCampaign?.plan_mode === 'custom' ? customRequestText : null
      });
      if (reqError) throw reqError;

      // Increment conversions_count
      const { data: cData } = await supabase.from("marketing_campaigns").select("conversions_count").eq("id", activeCampaign.id).maybeSingle();
      const conversions = cData?.conversions_count ?? 0;
      await supabase.from("marketing_campaigns").update({ conversions_count: conversions + 1 }).eq("id", activeCampaign.id);

      toast.success("Upgrade request submitted successfully! Admin will audit the receipt.");
      setCampaignReceiptOpen(false);
      setCampaignReceiptFile(null);
      setCustomRequestText("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit receipt");
    } finally {
      setSubmittingCampaignReceipt(false);
    }
  }

  useEffect(() => {
    if (!loading) {
      if (!user) {
        nav({ to: "/login" });
      } else if (isAdmin) {
        nav({ to: "/admin" });
      } else if (isProfileIncomplete === true && path !== "/profile" && !isExamMode) {
        toast.info("Please complete your profile details (Country and State) to proceed.");
        nav({ to: "/profile" });
      } else if (isProfileIncomplete === false && hasMembership === false && path !== "/welcome-subscription" && !isExamMode) {
        nav({ to: "/welcome-subscription" });
      }
    }
  }, [loading, user, isAdmin, isProfileIncomplete, hasMembership, path, isExamMode, nav]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (isBlocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-destructive/20 bg-card p-8 shadow-card text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive mb-4">
            <User className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Account Suspended</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Your Examly account has been suspended by an administrator. Please contact support for assistance.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <a href="mailto:support@examly.com" className="w-full">
              <Button className="w-full">Contact Support</Button>
            </a>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {!isExamMode && (
          <>
            <Sidebar collapsible="icon" className="hidden md:flex">
              <SidebarHeader>
                <Link to="/dashboard" className="flex items-center gap-2 px-2 py-2 font-display text-base font-bold">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="h-4 w-4" /></span>
                  <span className="group-data-[collapsible=icon]:hidden">Examly</span>
                </Link>
              </SidebarHeader>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {items.map((it) => (
                        <SidebarMenuItem key={it.to}>
                          <SidebarMenuButton asChild isActive={path === it.to || path.startsWith(it.to + "/")}>
                            <Link to={it.to}><it.icon className="h-4 w-4" /><span>{it.label}</span></Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>

            {/* Mobile Bottom Nav */}
            <nav className="mobile-bottom-nav px-4 md:hidden">
              {[items[0], items[1], items[5], items[3], items[6]].map((it) => {
                const active = path === it.to || path.startsWith(it.to + "/");
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${active ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <it.icon className={active ? "h-6 w-6" : "h-5 w-5"} />
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? "opacity-100" : "opacity-60"}`}>{it.label.split(" ")[0]}</span>
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        <div className="flex flex-1 flex-col">
          {!isExamMode && (
            <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:h-16">
              <div className="flex items-center gap-2">
                <div className="md:hidden">
                  <Link to="/dashboard" className="flex items-center gap-2 font-display text-sm font-bold">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="h-3.3 w-3.3" /></span>
                    Examly
                  </Link>
                </div>
                <div className="hidden md:block">
                  <SidebarTrigger />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                {/* Notification Bell */}
                <Link to="/notifications" className="relative">
                  <button className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-muted transition-colors">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-black text-white">
                        {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                      </span>
                    )}
                  </button>
                </Link>
                <div className="flex items-center gap-1.5 rounded-full bg-primary/5 px-2.5 py-1 text-xs sm:text-sm font-semibold text-primary border border-primary/10">
                  <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>{tokens} Tokens</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 sm:h-6 sm:w-6 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => setPurchaseOpen(true)}>
                    <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </div>

                <div className="md:hidden flex items-center">
                  <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                    <SheetTrigger asChild>
                      <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card p-0 hover:bg-muted active:scale-95 transition-all cursor-pointer">
                        <Avatar className="h-7.5 w-7.5">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold font-display">
                            {getUserInitials(profile?.fullName, user?.email)}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[300px] sm:w-[320px] p-0 flex flex-col h-full border-l bg-card">
                      {/* User profile card */}
                      <div className="p-6 border-b border-border bg-muted/20">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 border-2 border-primary/20 shadow-sm">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold font-display">
                              {getUserInitials(profile?.fullName, user?.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-display font-bold text-foreground truncate text-sm">
                              {profile?.fullName || user?.user_metadata?.full_name || "Student User"}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                          </div>
                        </div>

                        {/* Membership Tier badge */}
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Current Tier</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            profile?.tier === "premium"
                              ? "bg-primary/10 text-primary animate-pulse"
                              : "bg-muted text-muted-foreground border"
                          }`}>
                            {profile?.tier === "premium" ? (
                              <><Crown className="h-2.5 w-2.5 shrink-0" /> Premium</>
                            ) : (
                              "Free Basic"
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Token Summary Card */}
                      <div className="mx-6 mt-6 p-4 rounded-2xl border border-primary/10 bg-primary/5 flex items-center justify-between shadow-soft">
                        <div className="flex items-center gap-2">
                          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Coins className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">Token Balance</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Value: ₹{tokens * 10}</p>
                          </div>
                        </div>
                        <span className="font-display text-base font-black text-primary">{tokens}</span>
                      </div>

                      {/* Menu Links */}
                      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-3">Navigation</p>
                        
                        {[
                          { to: "/profile", label: "My Profile", icon: Settings },
                          { to: "/subscriptions", label: "Subscriptions & Upgrade", icon: Crown },
                          { to: "/rankings", label: "Leaderboard Rankings", icon: Trophy },
                          { to: "/purchased", label: "My Purchased Items", icon: CheckCircle },
                          { to: "/support", label: "Support & Help Desk", icon: MessageSquare },
                          { to: "/wallet", label: "Wallet & Transactions", icon: Wallet },
                          { to: "/history", label: "Attempt History", icon: Clock },
                        ].map((lnk) => {
                          const active = path === lnk.to || path.startsWith(lnk.to + "/");
                          return (
                            <Link
                              key={lnk.to}
                              to={lnk.to as any}
                              onClick={() => setMenuOpen(false)}
                              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all hover:bg-muted ${
                                active
                                  ? "bg-primary/10 text-primary"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <lnk.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                              <span>{lnk.label}</span>
                            </Link>
                          );
                        })}
                      </div>

                      {/* Footer Actions */}
                      <div className="p-6 border-t border-border bg-muted/10 space-y-2">
                        {profile?.tier !== "premium" && (
                          <Link to="/subscriptions" onClick={() => setMenuOpen(false)}>
                            <Button className="w-full rounded-2xl font-bold bg-primary shadow-lg shadow-primary/15 h-10 text-xs hover:scale-[1.01] transition-transform">
                              <Crown className="mr-2 h-3.5 w-3.5 shrink-0" /> Upgrade to Premium
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          className="w-full rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/10 h-10 justify-start font-bold text-xs"
                          onClick={async () => {
                            setMenuOpen(false);
                            await signOut();
                          }}
                        >
                          <LogOut className="mr-3 h-4 w-4 shrink-0" /> Sign Out
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </header>
          )}
          <main className={cn(
            "flex-1 px-4 py-6 md:px-8 md:py-10",
            isExamMode ? "px-0 py-0 md:px-0 md:py-0" : "pb-24 md:pb-10"
          )}>
            <Outlet />
          </main>
        </div>
      </div>
      {!isExamMode && <TokenRequestModal open={purchaseOpen} onOpenChange={setPurchaseOpen} />}

      {/* Marketing Campaign Pop-up */}
      <Dialog open={campaignOpen} onOpenChange={(open) => { if (!open) handleCampaignDismiss(false); }}>
        <DialogContent className="sm:max-w-[460px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
              <span>{activeCampaign?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Exclusive promotional offer for active members.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <p className="text-sm text-foreground font-medium">{activeCampaign?.description}</p>
            
            {/* Specific Plan Mode */}
            {activeCampaign?.plan_mode === 'specific' && activeCampaign?.subscriptions && (
              <div className="rounded-2xl border p-4 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{activeCampaign.subscriptions.name}</span>
                  <span className="font-bold text-primary text-sm">₹{activeCampaign.subscriptions.price_inr}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Includes {activeCampaign.subscriptions.token_price} tokens and unlocks premium features for {activeCampaign.subscriptions.duration_days} days.
                </p>
              </div>
            )}

            {/* All Plans Mode */}
            {activeCampaign?.plan_mode === 'all' && (
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select a Subscription Package</Label>
                <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                  {allSubscriptions.map(s => {
                    const isSelected = selectedPlanForCampaign?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedPlanForCampaign(s)}
                        className={`cursor-pointer rounded-xl border p-3 flex items-center justify-between transition-all ${
                          isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs text-foreground">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{s.token_price} tokens · {s.duration_days} days</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xs text-primary">₹{s.price_inr}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Plan Mode */}
            {activeCampaign?.plan_mode === 'custom' && (
              <div className="space-y-3">
                {activeCampaign?.custom_description && (
                  <div className="rounded-2xl border p-3 bg-muted/20 text-xs text-muted-foreground space-y-1">
                    {activeCampaign.custom_description.split(/•|\n/).map(x => x.trim()).filter(Boolean).map((pt, i) => (
                      <p key={i} className="flex items-start gap-1">
                        <span>•</span>
                        <span>{pt}</span>
                      </p>
                    ))}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Specify Your Requirements / Request Details</Label>
                  <textarea
                    value={customRequestText}
                    onChange={(e) => setCustomRequestText(e.target.value)}
                    placeholder="Enter what you would like to request (e.g. special pricing, custom duration, etc.)"
                    className="w-full min-h-[80px] rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleCampaignDismiss(false)} className="rounded-xl">Close</Button>
            <Button 
              onClick={handleCampaignClick} 
              disabled={activeCampaign?.plan_mode === 'custom' && !customRequestText.trim()}
              className="rounded-xl bg-primary text-primary-foreground font-bold"
            >
              Upgrade Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Marketing Receipt Upload Dialog */}
      <Dialog open={campaignReceiptOpen} onOpenChange={(o) => { if(!o) { setCampaignReceiptOpen(false); setCampaignReceiptFile(null); } }}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold">
              <Crown className="h-5 w-5 text-amber-500" />
              <span>Submit Payment Receipt</span>
            </DialogTitle>
            <DialogDescription>
              {activeCampaign?.plan_mode === 'custom' ? (
                "Upload receipt screenshot to request custom activation."
              ) : (
                `Upload payment screenshot to request activation for ${
                  activeCampaign?.plan_mode === 'specific' 
                    ? activeCampaign?.subscriptions?.name 
                    : selectedPlanForCampaign?.name
                }.`
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 text-sm">
            <div className="rounded-2xl border p-4 bg-muted/30 space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Payment Details</p>
              <p className="text-xs text-foreground font-medium">
                {activeCampaign?.plan_mode === 'custom' ? (
                  "Please transfer the custom amount discussed with the administrator using UPI or Bank details:"
                ) : (
                  <>
                    Please transfer <strong>₹{
                      activeCampaign?.plan_mode === 'specific' 
                        ? activeCampaign?.subscriptions?.price_inr 
                        : selectedPlanForCampaign?.price_inr
                    }</strong> using UPI or Bank details:
                  </>
                )}
              </p>
              <div className="bg-card p-3 rounded-xl border border-border/50 font-mono text-[11px] text-muted-foreground space-y-1">
                <div><strong>UPI ID:</strong> examy@upi</div>
                <div><strong>Bank:</strong> HDFC Bank</div>
                <div><strong>A/c Number:</strong> 50200012345678</div>
                <div><strong>IFSC Code:</strong> HDFC0000123</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Upload Receipt Screenshot</Label>
              <div className="flex items-center justify-center border border-dashed border-border rounded-xl p-4 bg-muted/10">
                {campaignReceiptFile ? (
                  <div className="text-center space-y-2 w-full">
                    <p className="text-xs font-semibold text-primary truncate max-w-[300px] mx-auto">✓ {campaignReceiptFile.name}</p>
                    <Button variant="ghost" size="xs" onClick={() => setCampaignReceiptFile(null)} className="text-[10px] text-destructive hover:bg-destructive/10">Remove file</Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer w-full text-center py-2">
                    <Upload className="h-5 w-5 text-muted-foreground animate-bounce" />
                    <span className="text-xs font-semibold text-muted-foreground">Select Screenshot Image</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => setCampaignReceiptFile(e.target.files?.[0] || null)} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignReceiptOpen(false)} className="rounded-xl">Cancel</Button>
            <Button 
              disabled={!campaignReceiptFile || submittingCampaignReceipt} 
              onClick={handleCampaignReceiptSubmit} 
              className="rounded-xl bg-primary text-primary-foreground font-bold shadow-lg"
            >
              {submittingCampaignReceipt ? "Submitting..." : "Submit Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

