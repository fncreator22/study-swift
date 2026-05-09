import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_student/tests/$testId/attempt")({ component: Attempt });

type Q = { id: string; question: string; option_a: string; option_b: string; option_c: string; option_d: string; position: number };

function Attempt() {
  const { testId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: test } = await supabase.from("tests").select("duration_min").eq("id", testId).maybeSingle();
      if (!test) return;
      setDuration(test.duration_min);
      setRemaining(test.duration_min * 60);

      const { data: a, error } = await supabase
        .from("test_attempts")
        .insert({ user_id: user.id, test_id: testId })
        .select().single();
      if (error) { toast.error(error.message); nav({ to: "/tests/$testId", params: { testId } }); return; }
      setAttemptId(a.id);

      const { data: qs } = await supabase
        .from("test_questions")
        .select("id,question,option_a,option_b,option_c,option_d,position")
        .eq("test_id", testId)
        .order("position");
      setQuestions((qs as Q[]) ?? []);
    })();
    // eslint-disable-next-line
  }, [user, testId]);

  useEffect(() => {
    if (remaining <= 0) return;
    const i = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(i);
  }, [remaining > 0]);

  useEffect(() => {
    if (duration > 0 && remaining === 0) submit();
    // eslint-disable-next-line
  }, [remaining]);

  const answered = useMemo(() => Object.keys(answers).length, [answers]);

  async function submit() {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    // insert answers
    const rows = questions.map((q) => ({
      attempt_id: attemptId, question_id: q.id, selected_option: answers[q.id] ?? null,
    }));
    if (rows.length) await supabase.from("test_answers").insert(rows);

    // score on server via correct_option (RLS allows reading questions the user has access to)
    const { data: corrects } = await supabase
      .from("test_questions")
      .select("id,correct_option")
      .eq("test_id", testId);
    const map = new Map((corrects ?? []).map((c: any) => [c.id, c.correct_option]));
    let score = 0;
    questions.forEach((q) => { if (answers[q.id] && answers[q.id] === map.get(q.id)) score++; });

    await supabase.from("test_attempts").update({
      submitted_at: new Date().toISOString(),
      score, total: questions.length,
    }).eq("id", attemptId);

    toast.success("Submitted");
    nav({ to: "/tests/$testId/review/$attemptId", params: { testId, attemptId } });
  }

  if (!questions.length) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const m = Math.floor(remaining / 60), s = remaining % 60;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-14 z-10 -mx-4 mb-6 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="text-sm text-muted-foreground">{answered}/{questions.length} answered</div>
        <div className="font-mono text-sm font-semibold">{m}:{s.toString().padStart(2, "0")}</div>
      </div>
      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <p className="text-xs text-muted-foreground">Question {i + 1}</p>
            <h3 className="mt-1 font-display text-lg font-semibold">{q.question}</h3>
            <div className="mt-4 grid gap-2">
              {(["a", "b", "c", "d"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [q.id]: k })}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition ${answers[q.id] === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <span className="mr-2 font-semibold uppercase">{k}.</span>
                  {(q as any)["option_" + k]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex justify-end">
        <Button size="lg" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit test"}</Button>
      </div>
    </div>
  );
}
