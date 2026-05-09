import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_student/tests/$testId/review/$attemptId")({ component: Review });

type Q = { id: string; question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string };
type Attempt = { score: number; total: number; submitted_at: string };

function Review() {
  const { testId, attemptId } = Route.useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});

  useEffect(() => {
    (async () => {
      const { data: a } = await supabase.from("test_attempts").select("score,total,submitted_at").eq("id", attemptId).maybeSingle();
      setAttempt(a as Attempt);
      const { data: qs } = await supabase.from("test_questions").select("*").eq("test_id", testId).order("position");
      setQuestions((qs as Q[]) ?? []);
      const { data: ans } = await supabase.from("test_answers").select("question_id,selected_option").eq("attempt_id", attemptId);
      const m: Record<string, string | null> = {};
      (ans ?? []).forEach((r: any) => { m[r.question_id] = r.selected_option; });
      setAnswers(m);
    })();
  }, [testId, attemptId]);

  if (!attempt) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
        <p className="text-sm text-muted-foreground">Your result</p>
        <div className="mt-2 flex flex-wrap items-end gap-6">
          <div><p className="font-display text-5xl font-bold">{attempt.score}<span className="text-2xl text-muted-foreground">/{attempt.total}</span></p><p className="text-sm text-muted-foreground">Score</p></div>
          <div><p className="font-display text-5xl font-bold text-primary">{pct}%</p><p className="text-sm text-muted-foreground">Percentage</p></div>
        </div>
        <div className="mt-6 flex gap-2">
          <Link to="/rankings"><Button variant="outline">View rankings</Button></Link>
          <Link to="/tests"><Button variant="ghost">More tests</Button></Link>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {questions.map((q, i) => {
          const sel = answers[q.id];
          const correct = q.correct_option;
          return (
            <div key={q.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Question {i + 1}</p>
                {sel === correct ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
              </div>
              <h3 className="mt-1 font-display font-semibold">{q.question}</h3>
              <div className="mt-3 grid gap-2">
                {(["a", "b", "c", "d"] as const).map((k) => {
                  const isCorrect = k === correct;
                  const isSel = k === sel;
                  return (
                    <div key={k} className={`rounded-xl border px-4 py-2 text-sm ${isCorrect ? "border-success bg-success/5" : isSel ? "border-destructive bg-destructive/5" : "border-border"}`}>
                      <span className="mr-2 font-semibold uppercase">{k}.</span>
                      {(q as any)["option_" + k]}
                      {isCorrect && <span className="ml-2 text-xs font-medium text-success">Correct</span>}
                      {isSel && !isCorrect && <span className="ml-2 text-xs font-medium text-destructive">Your answer</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
