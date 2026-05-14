import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import { LayoutDashboard, BookOpen, ShoppingBag, History, Trophy, PlayCircle, User, Settings, LogOut, GraduationCap, Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TokenRequestModal } from "@/components/TokenRequestModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_student")({ component: StudentLayout });

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tests", label: "All Tests", icon: BookOpen },
  { to: "/purchased", label: "Purchased", icon: ShoppingBag },
  { to: "/history", label: "History", icon: History },
  { to: "/rankings", label: "Rankings", icon: Trophy },
  { to: "/wallet", label: "Wallet", icon: Coins },
  { to: "/courses", label: "Courses", icon: PlayCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function StudentLayout() {
  const { user, loading, signOut, tokens } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isExamMode = path.includes("/attempt");
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <SidebarProvider open={!isExamMode}>
      <div className="flex min-h-screen w-full bg-background">
        {!isExamMode && (
          <Sidebar collapsible="icon">
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
        )}
        <div className="flex flex-1 flex-col">
          {!isExamMode && (
            <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-sm font-semibold text-primary border border-primary/10">
                  <Coins className="h-4 w-4" />
                  <span>{tokens} Tokens</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => setPurchaseOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </header>
          )}
          <main className={cn("flex-1 px-4 py-6 md:px-8 md:py-10", isExamMode && "px-0 py-0 md:px-0 md:py-0")}>
            <Outlet />
          </main>
        </div>
      </div>
      {!isExamMode && <TokenRequestModal open={purchaseOpen} onOpenChange={setPurchaseOpen} />}
    </SidebarProvider>
  );
}
