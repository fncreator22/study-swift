import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_student/tests/$testId/attempt")({ component: Attempt });

type Q = {
  id: string;
  question: string;
  question_type: "mcq" | "written";
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  max_words: number | null;
  position: number;
};

function countWords(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function Attempt() {
  const { testId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [test, setTest] = useState<{ test_type: "mcq" | "written"; duration_min: number } | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // mcq: a/b/c/d, written: text
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: t, error: tErr } = await supabase.from("tests").select("test_type,duration_min").eq("id", testId).maybeSingle();
        if (tErr) throw tErr;
        if (!t) {
          toast.error("Test not found");
          nav({ to: "/tests" });
          return;
        }
        setTest(t as any);

        // Check for existing unsubmitted attempt
        const { data: existing } = await supabase
          .from("test_attempts")
          .select("id, started_at")
          .eq("user_id", user.id)
          .eq("test_id", testId)
          .is("submitted_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let aId = existing?.id;
        let startedAt = existing?.started_at ? new Date(existing.started_at).getTime() : null;

        if (!aId) {
          const { data: a, error: aErr } = await supabase
            .from("test_attempts")
            .insert({ user_id: user.id, test_id: testId })
            .select().single();
          if (aErr) throw aErr;
          aId = a.id;
          startedAt = new Date(a.started_at).getTime();
        }

        setAttemptId(aId);

        // Calculate remaining time based on started_at
        if (startedAt) {
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          const rem = Math.max(0, t.duration_min * 60 - elapsed);
          setRemaining(rem);
        } else {
          setRemaining(t.duration_min * 60);
        }

        const { data: qs, error: qErr } = await supabase
          .from("test_questions")
          .select("id,question,question_type,option_a,option_b,option_c,option_d,max_words,position")
          .eq("test_id", testId)
          .order("position");
        if (qErr) throw qErr;
        
        const questionsList = (qs as Q[]) ?? [];
        setQuestions(questionsList);

        if (questionsList.length === 0) {
          toast.error("This test has no questions yet.");
          nav({ to: "/tests/$testId", params: { testId } });
          return;
        }

        // Load existing answers if resuming
        if (existing) {
          const { data: ans } = await supabase
            .from("test_answers")
            .select("question_id, selected_option, written_answer")
            .eq("attempt_id", aId);
          
          const ansMap: Record<string, string> = {};
          (ans ?? []).forEach(a => {
            if (a.selected_option) ansMap[a.question_id] = a.selected_option;
            else if (a.written_answer) ansMap[a.question_id] = a.written_answer;
          });
          setAnswers(ansMap);
        }

      } catch (e: any) {
        toast.error(e.message || "Failed to load test");
        nav({ to: "/tests" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [user, testId]);

  useEffect(() => {
    if (remaining <= 0) return;
    const i = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(i);
  }, [remaining > 0]);

  useEffect(() => {
    if (test && remaining === 0 && attemptId) submit();
    // eslint-disable-next-line
  }, [remaining]);

  const answered = useMemo(
    () => Object.values(answers).filter((v) => v && v.toString().trim().length > 0).length,
    [answers],
  );

  async function saveAnswer(qId: string, val: string) {
    if (!attemptId) return;
    const q = questions.find(x => x.id === qId);
    if (!q) return;

    const row = {
      attempt_id: attemptId,
      question_id: qId,
      selected_option: q.question_type === "mcq" ? val : null,
      written_answer: q.question_type === "written" ? val : null,
    };

    await supabase.from("test_answers").upsert(row, { onConflict: "attempt_id,question_id" });
  }

  async function submit() {
    if (!attemptId || submitting || !test) return;
    setSubmitting(true);

    const rows = questions.map((q) => ({
      attempt_id: attemptId,
      question_id: q.id,
      selected_option: q.question_type === "mcq" ? (answers[q.id] ?? null) : null,
      written_answer: q.question_type === "written" ? (answers[q.id] ?? null) : null,
    }));
    if (rows.length) await supabase.from("test_answers").insert(rows);

    let score = 0;
    let total = questions.length;
    if (test.test_type === "mcq") {
      const { data: corrects } = await supabase
        .from("test_questions")
        .select("id,correct_option")
        .eq("test_id", testId);
      const map = new Map((corrects ?? []).map((c: any) => [c.id, c.correct_option]));
      questions.forEach((q) => { if (answers[q.id] && answers[q.id] === map.get(q.id)) score++; });
    }

    await supabase.from("test_attempts").update({
      submitted_at: new Date().toISOString(),
      score, total,
    }).eq("id", attemptId);

    toast.success("Submitted");
    nav({ to: "/tests/$testId/review/$attemptId", params: { testId, attemptId } });
  }

  if (loading || !test) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const m = Math.floor(remaining / 60), s = remaining % 60;
  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const written = q.question_type === "written";
  const wordCount = written ? countWords(answers[q.id] ?? "") : 0;
  const overLimit = written && q.max_words ? wordCount > q.max_words : false;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Sticky header */}
      <div className="sticky top-14 z-10 -mx-4 mb-6 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="text-sm text-muted-foreground">{answered}/{questions.length} answered</div>
        <div className="font-mono text-sm font-semibold">{m}:{s.toString().padStart(2, "0")}</div>
      </div>

      {/* Question pager */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((_, i) => {
          const isCurrent = i === idx;
          const hasAns = !!(answers[questions[i].id] && answers[questions[i].id].toString().trim());
          return (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-8 w-8 rounded-md border text-xs font-semibold transition ${
                isCurrent ? "border-primary bg-primary text-primary-foreground"
                : hasAns ? "border-success bg-success/10 text-success"
                : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <p className="text-xs text-muted-foreground">Question {idx + 1} of {questions.length}</p>
        <h3 className="mt-1 font-display text-lg font-semibold">{q.question}</h3>

        {written ? (
          <div className="mt-4">
            <Textarea
              rows={Math.min(20, Math.max(8, Math.ceil((q.max_words ?? 200) / 25)))}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              onBlur={(e) => saveAnswer(q.id, e.target.value)}
              placeholder="Write your answer here…"
              className="min-h-[240px]"
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={overLimit ? "text-destructive" : "text-muted-foreground"}>
                {wordCount} / {q.max_words ?? "—"} words
              </span>
              {overLimit && <span className="text-destructive">Over the word limit</span>}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            {(["a", "b", "c", "d"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setAnswers({ ...answers, [q.id]: k });
                  saveAnswer(q.id, k);
                }}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                  answers[q.id] === k ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <span className="mr-2 font-semibold uppercase">{k}.</span>
                {(q as any)["option_" + k]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
        </Button>
        {isLast ? (
          <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit test"}</Button>
        ) : (
          <Button onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
