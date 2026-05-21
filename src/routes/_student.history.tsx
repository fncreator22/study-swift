import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_student/history")({ component: History });

function History() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("test_attempts").select("id,score,total,submitted_at,started_at,test_id,tests(title)")
      .eq("user_id", user.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [user]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-bold">Attempt history</h1>
      <div className="mt-8 responsive-table-container rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-4 text-left">Test</th>
              <th className="px-6 py-4 text-center">Score</th>
              <th className="px-6 py-4 text-center">%</th>
              <th className="px-6 py-4 text-left">Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">No attempts yet. Start practicing!</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/30">
                <td className="px-6 py-4 font-medium whitespace-nowrap">{r.tests?.title}</td>
                <td className="px-6 py-4 text-center tabular-nums">{r.score}/{r.total}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold ${r.total && (r.score / r.total) >= 0.7 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {r.total ? Math.round((r.score / r.total) * 100) : 0}%
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap text-xs">{new Date(r.submitted_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  <Link to="/tests/$testId/review/$attemptId" params={{ testId: r.test_id, attemptId: r.id }}>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg border border-border/50 bg-background hover:bg-muted">Review</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

