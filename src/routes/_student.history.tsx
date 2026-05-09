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
      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-4">Test</th><th className="p-4">Score</th><th className="p-4">%</th><th className="p-4">Date</th><th className="p-4"></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No attempts yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-4 font-medium">{r.tests?.title}</td>
                <td className="p-4">{r.score}/{r.total}</td>
                <td className="p-4">{r.total ? Math.round((r.score / r.total) * 100) : 0}%</td>
                <td className="p-4 text-muted-foreground">{new Date(r.submitted_at).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <Link to="/tests/$testId/review/$attemptId" params={{ testId: r.test_id, attemptId: r.id }}>
                    <Button size="sm" variant="outline">Review</Button>
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
