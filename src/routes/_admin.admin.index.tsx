import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, PlayCircle, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/")({ component: AdminHome });

function AdminHome() {
  const [s, setS] = useState({ users: 0, tests: 0, videos: 0, comments: 0 });
  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("tests").select("id", { count: "exact", head: true }),
      supabase.from("videos").select("id", { count: "exact", head: true }),
      supabase.from("comments").select("id", { count: "exact", head: true }),
    ]).then(([u, t, v, c]) => setS({ users: u.count ?? 0, tests: t.count ?? 0, videos: v.count ?? 0, comments: c.count ?? 0 }));
  }, []);
  const cards = [
    { l: "Users", v: s.users, icon: Users },
    { l: "Tests", v: s.tests, icon: BookOpen },
    { l: "Videos", v: s.videos, icon: PlayCircle },
    { l: "Comments", v: s.comments, icon: MessageSquare },
  ];
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-bold">Overview</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <c.icon className="h-5 w-5 text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Total {c.l}</p>
            <p className="mt-1 font-display text-3xl font-bold">{c.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
