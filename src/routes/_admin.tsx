import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, BookOpen, ListChecks, PlayCircle, MessageSquare, Settings, LogOut, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin")({ component: AdminLayout });

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/tests", label: "Tests", icon: BookOpen },
  { to: "/admin/questions", label: "Questions", icon: ListChecks },
  { to: "/admin/courses", label: "Courses", icon: PlayCircle },
  { to: "/admin/comments", label: "Comments", icon: MessageSquare },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) nav({ to: "/admin/login" });
  }, [user, isAdmin, loading, nav]);

  if (loading || !user || !isAdmin) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;

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
                          <Link to={it.to}><it.icon className="h-4 w-4" /><span>{it.label}</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <Button variant="ghost" className="justify-start gap-2" onClick={async () => { await signOut(); nav({ to: "/" }); }}>
              <LogOut className="h-4 w-4" /><span className="group-data-[collapsible=icon]:hidden">Log out</span>
            </Button>
          </SidebarFooter>
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
