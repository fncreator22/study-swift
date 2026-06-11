import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
type Attempt = { score: number; total: number; submitted_at: string; is_reviewed: boolean; status?: string; feedback?: string | null };

function Review() {
  const { testId, attemptId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, { selected: string | null; written: string | null; marks_awarded: number | null; feedback: string | null }>>({});
  const [testType, setTestType] = useState<"mcq" | "written">("mcq");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: t } = await supabase.from("tests").select("test_type").eq("id", testId).maybeSingle();
      if (t) setTestType(t.test_type as any);

      // Task 1 & 2: Use secure RPC for review data
      const { data, error: rpcErr } = await supabase.rpc("get_test_review", { _attempt_id: attemptId });
      
      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        return;
      }

      if (data) {
        const payload = data as any;
        setAttempt(payload.attempt);
        setQuestions(payload.questions || []);
        const ansMap: Record<string, { selected: string | null; written: string | null; marks_awarded: number | null; feedback: string | null }> = {};
        (payload.answers || []).forEach((a: any) => {
          ansMap[a.question_id] = {
            selected: a.selected_option ?? null,
            written: a.written_answer ?? null,
            marks_awarded: a.marks_awarded ?? null,
            feedback: a.feedback ?? null,
          };
        });
        setAnswers(ansMap);
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
  const isHybrid = (testType as string) === "hybrid";
  const needsReview = isWritten || isHybrid;
  const published = !!attempt.is_reviewed;
  const pct = attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
        <p className="text-sm text-muted-foreground">{needsReview && !published ? "Submission received" : "Your result"}</p>
        {needsReview && !published ? (
          <div className="mt-3">
            <p className="font-display text-2xl font-bold">Awaiting review</p>
            <p className="mt-1 text-sm text-muted-foreground">Your answers will be graded manually. The final score is hidden until an admin publishes the result.</p>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-end gap-6">
            <div><p className="font-display text-5xl font-bold">{attempt.score}<span className="text-2xl text-muted-foreground">/{attempt.total}</span></p><p className="text-sm text-muted-foreground">Score</p></div>
            <div><p className="font-display text-5xl font-bold text-primary">{pct}%</p><p className="text-sm text-muted-foreground">Percentage</p></div>
          </div>
        )}
        {attempt.feedback && published && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Feedback</p>
            <p className="mt-1 whitespace-pre-wrap">{attempt.feedback}</p>
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
            <div key={q.id} className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-soft transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Question {i + 1}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background shadow-sm">
                  {sel === correct ? <Check className="h-5 w-5 text-success" /> : <X className="h-5 w-5 text-destructive" />}
                </div>
              </div>
              <h3 className="mt-4 font-display text-base font-semibold leading-snug md:text-lg">{q.question}</h3>
              
              <div className="mt-5 grid gap-3">
                {(["a", "b", "c", "d"] as const).map((k) => {
                  const isCorrect = k === correct;
                  const isSel = k === sel;
                  const optText = (q as any)["option_" + k];
                  if (!optText) return null;

                  return (
                    <div key={k} className={cn(
                      "relative flex items-center gap-3 rounded-xl border p-4 text-sm transition-all md:text-base",
                      isCorrect ? "border-success/50 bg-success/5 ring-1 ring-success/20" : 
                      isSel ? "border-destructive/50 bg-destructive/5 ring-1 ring-destructive/20" : 
                      "border-border bg-background"
                    )}>
                      <span className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase",
                        isCorrect ? "bg-success text-success-foreground" : 
                        isSel ? "bg-destructive text-destructive-foreground" : 
                        "bg-muted text-muted-foreground"
                      )}>{k}</span>
                      <span className="flex-1 font-medium">{optText}</span>
                      {isCorrect && <Check className="h-4 w-4 shrink-0 text-success" />}
                      {isSel && !isCorrect && <X className="h-4 w-4 shrink-0 text-destructive" />}
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <div className="mt-6 rounded-2xl border-2 border-success/20 bg-success/[0.02] p-5">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-success">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-success/10">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    Concept Explanation
                  </div>
                  <div className="mt-3 text-sm leading-relaxed text-muted-foreground/90 md:text-base">
                    {q.explanation}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

