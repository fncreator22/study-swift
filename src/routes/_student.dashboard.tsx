import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BookOpen, Trophy, History, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/_student/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ tests: 0, attempts: 0, avg: 0, videos: 0 });
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: tests }, { data: rank }, { count: videos }, { data: prof }] = await Promise.all([
        supabase.from("tests").select("id", { count: "exact", head: true }),
        supabase.from("rankings_view").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("videos").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      setStats({
        tests: tests ?? 0,
        attempts: (rank?.attempts_count as number) ?? 0,
        avg: (rank?.avg_percentage as number) ?? 0,
        videos: videos ?? 0,
      });
      setName(prof?.full_name ?? "");
    })();
  }, [user]);

  const cards = [
    { t: "Available tests", v: stats.tests, icon: BookOpen, to: "/tests" },
    { t: "Tests attempted", v: stats.attempts, icon: History, to: "/history" },
    { t: "Avg. percentage", v: `${stats.avg}%`, icon: Trophy, to: "/rankings" },
    { t: "Course videos", v: stats.videos, icon: PlayCircle, to: "/courses" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-bold">Hi{name ? `, ${name.split(" ")[0]}` : ""} 👋</h1>
      <p className="mt-1 text-muted-foreground">Here's an overview of your learning.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.t} to={c.to} className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:border-primary/40 hover:shadow-card">
            <c.icon className="h-5 w-5 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{c.t}</p>
            <p className="mt-1 font-display text-2xl font-bold">{c.v}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
