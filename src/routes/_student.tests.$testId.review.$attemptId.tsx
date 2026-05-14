import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_student/tests/$testId/review/$attemptId")({ component: Review });

type Q = {
  id: string;
  question: string;
  question_type: "mcq" | "written";
  option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null;
  correct_option: string | null;
  explanation: string | null;
  max_words: number | null;
};
type Attempt = { score: number; total: number; submitted_at: string };

function Review() {
  const { testId, attemptId } = Route.useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [test, setTest] = useState<{ test_type: "mcq" | "written" } | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, { selected: string | null; written: string | null }>>({});

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("tests").select("test_type").eq("id", testId).maybeSingle();
      setTest(t as any);
      const { data: a } = await supabase.from("test_attempts").select("score,total,submitted_at").eq("id", attemptId).maybeSingle();
      setAttempt(a as Attempt);
      const { data: qs } = await supabase.from("test_questions").select("*").eq("test_id", testId).order("position");
      setQuestions((qs as Q[]) ?? []);
      const { data: ans } = await supabase.from("test_answers").select("question_id,selected_option,written_answer").eq("attempt_id", attemptId);
      const m: Record<string, { selected: string | null; written: string | null }> = {};
      (ans ?? []).forEach((r: any) => { m[r.question_id] = { selected: r.selected_option, written: r.written_answer }; });
      setAnswers(m);
    })();
  }, [testId, attemptId]);

  if (!attempt || !test) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const isWritten = test.test_type === "written";
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
        <p className="text-sm text-muted-foreground">{isWritten ? "Submission received" : "Your result"}</p>
        {isWritten ? (
          <div className="mt-3">
            <p className="font-display text-2xl font-bold">Awaiting review</p>
            <p className="mt-1 text-sm text-muted-foreground">Written answers are graded manually. You'll see your score once it's reviewed.</p>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-6">
            <div><p className="font-display text-5xl font-bold">{attempt.score}<span className="text-2xl text-muted-foreground">/{attempt.total}</span></p><p className="text-sm text-muted-foreground">Score</p></div>
            <div><p className="font-display text-5xl font-bold text-primary">{pct}%</p><p className="text-sm text-muted-foreground">Percentage</p></div>
          </div>
        )}
        <div className="mt-6 flex gap-2">
          <Link to="/rankings"><Button variant="outline">View rankings</Button></Link>
          <Link to="/tests"><Button variant="ghost">More tests</Button></Link>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {questions.map((q, i) => {
          const a = answers[q.id];
          if (q.question_type === "written") {
            return (
              <div key={q.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Question {i + 1} · Written</p>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="mt-1 font-display font-semibold">{q.question}</h3>
                <div className="mt-3 rounded-xl bg-muted p-4 text-sm whitespace-pre-wrap">
                  {a?.written?.trim() ? a.written : <span className="text-muted-foreground italic">No answer submitted.</span>}
                </div>
              </div>
            );
          }
          const sel = a?.selected ?? null;
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
              {q.explanation && (
                <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-success mb-1">
                    <FileText className="h-3.5 w-3.5" /> Explanation
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
