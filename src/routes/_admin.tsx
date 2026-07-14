import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, BookOpen, PlayCircle, MessageSquare, Settings, LogOut, Lock, Coins, FileText, Crown, BarChart3, Sparkles, Bell, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_admin")({ component: AdminLayout });

const items: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/tests", label: "Tests", icon: BookOpen },
  { to: "/admin/reviews", label: "Review Tests", icon: FileText },
  { to: "/admin/courses", label: "Courses", icon: PlayCircle },
  { to: "/admin/tokens", label: "Token Requests", icon: Coins },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: Crown },
  { to: "/admin/bugs", label: "Bugs", icon: ShieldAlert },
  { to: "/admin/monitoring", label: "Monitoring", icon: BarChart3 },
  { to: "/admin/marketing", label: "Marketing", icon: Sparkles },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/support", label: "Complaints", icon: MessageSquare },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/admin/login" });
      return;
    }
    if (isAdmin) return;

    // Grace period for async role check to resolve
    const timer = setTimeout(() => {
      console.warn("[AdminGuard] Not an admin, redirecting.");
      nav({ to: "/admin/login" });
    }, 4000);

    return () => clearTimeout(timer);
  }, [user, isAdmin, loading, nav]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <h2 className="font-display text-xl font-bold">Verifying authority</h2>
          <p className="mt-2 text-sm text-muted-foreground italic">Establishing secure administrative session...</p>
        </div>
      </div>
    );
  }
  if (!user || !isAdmin) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <Link to="/admin" className="flex items-center gap-2 px-2 py-2 font-display text-base font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background shrink-0"><Lock className="h-4 w-4" /></span>
              <span className="group-data-[collapsible=icon]:hidden">Admin</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((it) => {
                    const active = it.exact ? path === it.to : path === it.to || path.startsWith(it.to + "/");
                    return (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={it.to as any}><it.icon className="h-4 w-4" /><span>{it.label}</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 rounded-lg text-muted-foreground hover:text-destructive group-data-[collapsible=icon]:justify-center"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur shrink-0">
            <div className="flex items-center gap-3">
              {/* Sidebar toggle — always visible including mobile */}
              <SidebarTrigger />
              {/* Mobile brand label */}
              <Link to="/admin" className="flex items-center gap-2 font-display text-sm font-bold md:hidden">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-foreground text-background shrink-0">
                  <Lock className="h-3 w-3" />
                </span>
                Admin Panel
              </Link>
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-10 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
