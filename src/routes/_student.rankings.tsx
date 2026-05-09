import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_student/rankings")({ component: Rankings });

function Rankings() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("rankings_view").select("*").order("total_score", { ascending: false }).limit(100)
      .then(({ data }) => setRows((data ?? []).filter((r: any) => r.attempts_count > 0)));
  }, []);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-bold">Rankings</h1>
      <p className="mt-1 text-muted-foreground">Top performers across all tests.</p>
      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-4">Rank</th><th className="p-4">Student</th><th className="p-4">College</th><th className="p-4">Score</th><th className="p-4">Tests</th><th className="p-4">Avg %</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No rankings yet.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.user_id} className="border-t border-border">
                <td className="p-4">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {i < 3 ? <Trophy className="h-3 w-3" /> : i + 1}
                  </span>
                </td>
                <td className="p-4 font-medium">{r.full_name || "Student"}</td>
                <td className="p-4 text-muted-foreground">{r.college || "—"}</td>
                <td className="p-4 font-semibold">{r.total_score}</td>
                <td className="p-4">{r.attempts_count}</td>
                <td className="p-4">{r.avg_percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
