import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/_student/history")({ component: History });

function History() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("test_attempts").select("id,score,total,submitted_at,started_at,test_id,tests(title)")
      .eq("user_id", user.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [user]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-bold">Attempt history</h1>

      {/* Mobile card list */}
      <div className="mt-8 sm:hidden space-y-3">
        {loading && <p className="text-sm text-muted-foreground animate-pulse">Loading attempts...</p>}
        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground italic">No attempts yet. Start practicing!</p>
          </div>
        )}
        {!loading && rows.map((r) => {
          const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
          const good = pct >= 70;
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{r.tests?.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{r.score}/{r.total} marks</span>
                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold ${good ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {pct}%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.submitted_at).toLocaleDateString()}</p>
              </div>
              <Link to="/tests/$testId/review/$attemptId" params={{ testId: r.test_id, attemptId: r.id }}>
                <Button size="sm" variant="ghost" className="h-8 rounded-lg border border-border/50 bg-background hover:bg-muted shrink-0">Review</Button>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="mt-8 responsive-table-container rounded-2xl border border-border bg-card hidden sm:block">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Test</th>
              <th className="px-6 py-4 text-center">Score</th>
              <th className="px-6 py-4 text-center">%</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground animate-pulse">Loading...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">No attempts yet. Start practicing!</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/30">
                <td className="px-6 py-4 font-medium max-w-[200px] truncate">{r.tests?.title}</td>
                <td className="px-6 py-4 text-center tabular-nums">{r.score}/{r.total}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold ${r.total && (r.score / r.total) >= 0.7 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {r.total ? Math.round((r.score / r.total) * 100) : 0}%
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">{new Date(r.submitted_at).toLocaleDateString()}</td>
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
