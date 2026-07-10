import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingAttemptRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (loadingAttemptRef.current) return;
    loadingAttemptRef.current = true;

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

        // Exit-restart rule: a sessionStorage marker identifies the live tab session.
        // Refresh in same tab → resume; new tab / closed-and-reopened → discard previous.
        const sessKey = `attempt_${testId}`;
        const sessAttempt = typeof window !== "undefined" ? sessionStorage.getItem(sessKey) : null;

        let aId: string | undefined;
        let startedAt: number | null = null;

        if (sessAttempt) {
          const { data: existing } = await supabase
            .from("test_attempts")
            .select("id, started_at, submitted_at")
            .eq("id", sessAttempt)
            .eq("user_id", user.id)
            .is("submitted_at", null)
            .maybeSingle();
          if (existing) { aId = existing.id; startedAt = new Date(existing.started_at).getTime(); }
        }

        if (!aId) {
          // Discard any prior in-progress attempts and start fresh
          const { data: newId, error: rpcErr } = await supabase.rpc("start_fresh_attempt" as any, { _test_id: testId });
          if (rpcErr) throw rpcErr;
          aId = newId as string;
          startedAt = Date.now();
          if (typeof window !== "undefined") sessionStorage.setItem(sessKey, aId);
        }

        setAttemptId(aId);
        if (startedAt) {
          const elapsed = Math.floor((Date.now() - startedAt) / 1000);
          setRemaining(Math.max(0, t.duration_min * 60 - elapsed));
        } else {
          setRemaining(t.duration_min * 60);
        }

        // Load existing answers (resume case)
        const { data: prevAns } = await supabase
          .from("test_answers")
          .select("question_id, selected_option, written_answer")
          .eq("attempt_id", aId);
        const ansMap: Record<string, string> = {};
        (prevAns ?? []).forEach(a => { ansMap[a.question_id] = a.selected_option || a.written_answer || ""; });
        setAnswers(ansMap);

        // Fetch from secure view (no correct_option to prevent cheating)
        const { data: qs, error: qErr } = await supabase
          .from("test_questions_secure" as any)
          .select("id,question,question_type,option_a,option_b,option_c,option_d,max_words,position")
          .eq("test_id", testId)
          .order("position");
        if (qErr) throw qErr;
        
        const questionsList = (qs as unknown as Q[]) ?? [];
        setQuestions(questionsList);

        if (questionsList.length === 0) {
          toast.error("This test has no questions yet.");
          nav({ to: "/tests/$testId", params: { testId } });
          return;
        }

      } catch (e: any) {
        toast.error(e.message || "Failed to load test");
        nav({ to: "/tests" });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, testId]);

  // Task 3: Progress Sync (Auto-save)
  const syncAnswer = async (qId: string, val: string) => {
    if (!attemptId) return;
    setSyncing(true);
    const q = questions.find(x => x.id === qId);
    const payload = {
      attempt_id: attemptId,
      question_id: qId,
      selected_option: q?.question_type === "mcq" ? val : null,
      written_answer: q?.question_type === "written" ? val : null,
    };
    await supabase.from("test_answers").upsert(payload, { onConflict: "attempt_id,question_id" });
    setSyncing(false);
  };

  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => syncAnswer(qId, val), 1000);
  };

  useEffect(() => {
    if (remaining <= 0) return;
    const i = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(i);
  }, [remaining > 0]);

  useEffect(() => {
    if (test && remaining === 0 && attemptId) submit();
  }, [remaining]);

  const answered = useMemo(
    () => Object.values(answers).filter((v) => v && v.toString().trim().length > 0).length,
    [answers],
  );

  async function submit() {
    if (!attemptId || submitting || !test) return;
    setSubmitting(true);

    // Final sync of any pending answers
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      const lastQId = questions[idx].id;
      await syncAnswer(lastQId, answers[lastQId] || "");
    }

    // Task 2: Server-side grading (DB trigger handles score/total calculation)
    const { error } = await supabase.from("test_attempts").update({
      submitted_at: new Date().toISOString(),
    }).eq("id", attemptId);

    if (error) {
      toast.error("Failed to submit: " + error.message);
      setSubmitting(false);
      return;
    }

    if (typeof window !== "undefined") sessionStorage.removeItem(`attempt_${testId}`);
    toast.success("Submitted successfully");
    nav({ to: "/tests/$testId/review/$attemptId", params: { testId, attemptId } });
  }

  if (loading || !questions.length || !test) {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Loading assessment...</p>
        </div>
      </div>
    );
  }

  const m = Math.floor(remaining / 60), s = remaining % 60;
  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const written = q.question_type === "written";
  const wordCount = written ? countWords(answers[q.id] ?? "") : 0;
  const overLimit = written && q.max_words ? wordCount > q.max_words : false;

  return (
    <div className="mx-auto max-w-3xl pb-20 px-4">
      <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-muted-foreground">{answered}/{questions.length} <span className="hidden sm:inline">answered</span></div>
          {syncing && <div className="flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</div>}
        </div>
        <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 font-mono text-sm font-bold text-foreground">
          {m}:{s.toString().padStart(2, "0")}
        </div>
      </div>

      {/* Scrollable Question Pager */}
      <div className="responsive-table-container pb-2">
        <div className="flex w-max gap-1.5 px-0.5">
          {questions.map((_, i) => {
            const isCurrent = i === idx;
            const hasAns = !!(answers[questions[i].id] && answers[questions[i].id].toString().trim());
            return (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-9 w-9 shrink-0 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                  isCurrent ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : hasAns ? "border-success bg-success/10 text-success"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Question {idx + 1} of {questions.length}</p>
        <h3 className="mt-2 font-display text-lg font-semibold leading-snug md:text-xl">{q.question}</h3>

        {written ? (
          <div className="mt-6">
            <Textarea
              rows={Math.min(20, Math.max(8, Math.ceil((q.max_words ?? 200) / 25)))}
              value={answers[q.id] ?? ""}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              placeholder="Write your answer here…"
              className="min-h-[280px] rounded-2xl bg-muted/50 focus:bg-card transition-colors"
            />
            <div className="mt-3 flex items-center justify-between text-xs font-medium">
              <span className={overLimit ? "text-destructive" : "text-muted-foreground"}>
                {wordCount} / {q.max_words ?? "—"} words
              </span>
              {overLimit && <span className="flex items-center gap-1 text-destructive animate-pulse"><Loader2 className="h-3 w-3" /> Over limit</span>}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {(["a", "b", "c", "d"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleAnswerChange(q.id, k)}
                className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-left text-sm transition-all active:scale-[0.98] ${
                  answers[q.id] === k ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-bold uppercase transition-colors ${answers[q.id] === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground"}`}>{k}</span>
                <span className="font-medium leading-tight">{(q as any)["option_" + k]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Actions on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 p-4 backdrop-blur md:static md:mt-8 md:border-none md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Button variant="outline" size="lg" className="flex-1 rounded-2xl md:flex-initial" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
          </Button>
          {isLast ? (
            <Button onClick={submit} size="lg" disabled={submitting || syncing} className="flex-1 rounded-2xl shadow-lg shadow-primary/20 md:flex-initial md:min-w-[160px]">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit test"}
            </Button>
          ) : (
            <Button onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))} size="lg" className="flex-1 rounded-2xl md:flex-initial md:min-w-[120px]">
              <span className="hidden sm:inline">Next question</span><span className="sm:hidden">Next</span> <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
