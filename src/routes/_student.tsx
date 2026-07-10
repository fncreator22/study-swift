import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, BookOpen, CheckCircle, Clock, Trophy, Wallet, 
  PlayCircle, Crown, Settings, User, MessageSquare, GraduationCap, 
  Coins, Plus, LogOut 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TokenRequestModal } from "@/components/TokenRequestModal";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("full_name, membership_status")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setProfile({
              fullName: data.full_name || "",
              tier: data.membership_status || "free",
            });
          }
        });
    }
  }, [user]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        nav({ to: "/login" });
      } else if (isAdmin) {
        nav({ to: "/admin" });
      }
    }
  }, [loading, user, isAdmin, nav]);

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
    </SidebarProvider>
  );
}

