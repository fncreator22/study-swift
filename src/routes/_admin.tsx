import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, BookOpen, PlayCircle, MessageSquare, Settings, LogOut, Lock, Coins, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin")({ component: AdminLayout });

const items: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/tests", label: "Tests", icon: BookOpen },
  { to: "/admin/reviews", label: "Review Tests", icon: FileText },
  { to: "/admin/courses", label: "Courses", icon: PlayCircle },
  { to: "/admin/tokens", label: "Token Requests", icon: Coins },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    // If we have a user but isAdmin is false, wait a moment to see if it updates
    // (AuthProvider might be in the middle of a role check)
    if (!user) {
      nav({ to: "/admin/login" });
    } else if (!isAdmin) {
      // Allow more time for role verification (3s) to prevent race conditions on login
      const timer = setTimeout(() => {
        if (!isAdmin) {
          console.warn("[AdminGuard] Authority verification failed. Access denied.");
          nav({ to: "/admin/login" });
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, isAdmin, loading, nav]);

  if (loading || (user && !isAdmin)) {
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
  if (!user || !isAdmin) return null; // Should be handled by redirect

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <Link to="/admin" className="flex items-center gap-2 px-2 py-2 font-display text-base font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-foreground text-background"><Lock className="h-4 w-4" /></span>
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
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
          </header>
          <main className="flex-1 px-4 py-6 md:px-8 md:py-10"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}
