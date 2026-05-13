import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_student/tests/$testId/review/$attemptId")({ component: Review });

type Q = {
  id: string;
  question: string;
  question_type: "mcq" | "written";
  option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null;
  correct_option: string | null;
  max_words: number | null;
};
type Attempt = { score: number; total: number; submitted_at: string };

function Review() {
  const { testId, attemptId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, { selected: string | null; written: string | null }>>({});
  const [testType, setTestType] = useState<"mcq" | "written">("mcq");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: t } = await supabase.from("tests").select("test_type").eq("id", testId).maybeSingle();
      if (t) setTestType(t.test_type as any);

      // Task 1 & 2: Use secure RPC for review data
      const { data, error: rpcErr } = await supabase.rpc("get_test_review", { p_attempt_id: attemptId });
      
      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        return;
      }

      if (data) {
        setAttempt(data.attempt);
        setQuestions(data.questions || []);
        setAnswers(data.answers || {});
      }
      setLoading(false);
    })();
  }, [testId, attemptId]);

  if (loading) return <div className="grid h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return (
    <div className="mx-auto max-w-md rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
      <h3 className="mt-4 font-display text-lg font-semibold text-destructive">Error loading review</h3>
      <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      <Link to="/history"><Button variant="outline" className="mt-6">Back to history</Button></Link>
    </div>
  );

  if (!attempt) return <p className="text-sm text-muted-foreground">Attempt not found.</p>;
  
  const isWritten = testType === "written";
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
                    <div key={k} className={`rounded-xl border px-4 py-2 text-sm transition-colors ${isCorrect ? "border-success bg-success/5" : isSel ? "border-destructive bg-destructive/5" : "border-border"}`}>
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

