import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, ExternalLink, ChevronLeft, ChevronRight, Save, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_admin/admin/reviews")({ component: AdminReviews });

type Attempt = {
  id: string; user_id: string; test_id: string;
  score: number; total: number; submitted_at: string;
  is_reviewed: boolean; feedback: string | null;
  profiles: { full_name: string; college?: string };
  tests: { title: string; test_type: string; total_marks: number };
};

type Q = {
  id: string; question: string; question_type: "mcq" | "written";
  option_a?: string; option_b?: string; option_c?: string; option_d?: string;
  correct_option?: string; explanation?: string; max_words?: number; marks: number;
};
type A = {
  question_id: string; selected_option: string | null; written_answer: string | null;
  marks_awarded: number | null; feedback: string | null;
};

function AdminReviews() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answersByQ, setAnswersByQ] = useState<Record<string, A>>({});
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*, profiles(full_name, college), tests(title, test_type, total_marks)")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });
    if (error) toast.error(error.message);
    else setAttempts(((data ?? []) as any).filter((a: any) =>
      a.tests && (a.tests.test_type === "written" || a.tests.test_type === "hybrid")
    ));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function openReview(a: Attempt) {
    setSelected(a);
    setIdx(0);
    setFeedback(a.feedback || "");
    const [{ data: qs }, { data: ans }] = await Promise.all([
      supabase.from("test_questions").select("*").eq("test_id", a.test_id).order("position"),
      supabase.from("test_answers").select("*").eq("attempt_id", a.id),
    ]);
    setQuestions((qs ?? []) as any);
    const map: Record<string, A> = {};
    (ans ?? []).forEach((x: any) => { map[x.question_id] = x; });
    setAnswersByQ(map);
  }

  const current = questions[idx];
  const currentAnswer = current ? answersByQ[current.id] : null;

  const totalAwarded = useMemo(
    () => Object.values(answersByQ).reduce((s, a) => s + (Number(a?.marks_awarded) || 0), 0),
    [answersByQ]
  );
  const totalMarks = useMemo(() => questions.reduce((s, q) => s + (q.marks || 0), 0), [questions]);

  function updateLocal(qid: string, patch: Partial<A>) {
    setAnswersByQ(prev => ({ ...prev, [qid]: { ...(prev[qid] || { question_id: qid, selected_option: null, written_answer: null, marks_awarded: null, feedback: null }), ...patch } }));
  }

  async function saveDraft() {
    if (!selected || !current) return;
    setSavingDraft(true);
    const a = answersByQ[current.id];
    const { error } = await supabase.rpc("save_review_answer" as any, {
      _attempt_id: selected.id,
      _question_id: current.id,
      _marks: a?.marks_awarded == null ? null : Number(a.marks_awarded),
      _feedback: a?.feedback || null,
    });
    setSavingDraft(false);
    if (error) toast.error(error.message);
    else toast.success("Draft saved");
  }

  async function publish() {
    if (!selected) return;
    setSubmitting(true);
    // Persist every per-question draft first
    for (const q of questions) {
      const a = answersByQ[q.id];
      if (!a) continue;
      await supabase.rpc("save_review_answer" as any, {
        _attempt_id: selected.id, _question_id: q.id,
        _marks: a.marks_awarded == null ? null : Number(a.marks_awarded),
        _feedback: a.feedback || null,
      });
    }
    const { error } = await supabase.rpc("publish_attempt" as any, {
      _attempt_id: selected.id, _score: 0, _total: 0, _feedback: feedback,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Result published"); setSelected(null); load(); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Written / Hybrid Reviews</h1>
        <p className="text-muted-foreground">Grade student submissions question by question.</p>
      </div>

      <div className="responsive-table-container rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead><TableHead>Test</TableHead>
              <TableHead>Submitted</TableHead><TableHead>Status</TableHead>
              <TableHead>Score</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              : attempts.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8">No submissions to review</TableCell></TableRow>
              : attempts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell><div className="flex flex-col"><span className="font-medium">{a.profiles?.full_name || "—"}</span><span className="text-xs text-muted-foreground">{a.profiles?.college || ""}</span></div></TableCell>
                  <TableCell><div className="flex flex-col"><span className="font-medium">{a.tests?.title}</span><span className="text-xs text-muted-foreground uppercase">{a.tests?.test_type}</span></div></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(a.submitted_at).toLocaleString()}</TableCell>
                  <TableCell>{a.is_reviewed
                    ? <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Reviewed</Badge>
                    : <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>}</TableCell>
                  <TableCell className="font-mono">{a.is_reviewed ? `${a.score}/${a.total || a.tests?.total_marks}` : "—"}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openReview(a)}><ExternalLink className="mr-2 h-3 w-3" />Review</Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
              <span>Review · {selected?.profiles?.full_name}</span>
              <span className="text-sm font-mono font-normal text-muted-foreground">{totalAwarded}/{totalMarks}</span>
            </DialogTitle>
          </DialogHeader>

          {!current ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No questions loaded.</div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-5 py-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Question {idx + 1} of {questions.length} · {current.question_type === "mcq" ? "MCQ" : "Written"} · {current.marks} marks</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" disabled={idx === questions.length - 1} onClick={() => setIdx(i => i + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="font-display font-semibold">{current.question}</p>
                {current.question_type === "mcq" ? (
                  <div className="mt-3 text-sm space-y-1">
                    {(["a", "b", "c", "d"] as const).map(k => {
                      const txt = (current as any)["option_" + k]; if (!txt) return null;
                      const isCorrect = current.correct_option?.toLowerCase() === k;
                      const isSel = currentAnswer?.selected_option?.toLowerCase() === k;
                      return <div key={k} className={isCorrect ? "text-success font-medium" : isSel ? "text-destructive font-medium" : "text-muted-foreground"}><span className="uppercase mr-1">{k}.</span>{txt}{isCorrect && " ✓"}{isSel && !isCorrect && " ✗"}</div>;
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-muted p-4 text-sm whitespace-pre-wrap border border-border/50 italic">
                    {currentAnswer?.written_answer || "No answer submitted."}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <Label>Marks awarded</Label>
                  <Input type="number" min={0} max={current.marks} step="0.5"
                    value={currentAnswer?.marks_awarded ?? ""}
                    onChange={(e) => updateLocal(current.id, { marks_awarded: e.target.value === "" ? null : Number(e.target.value) })} />
                  <p className="text-[10px] text-muted-foreground mt-1">Out of {current.marks}</p>
                </div>
                <div className="sm:col-span-2">
                  <Label>Feedback for this question</Label>
                  <Textarea rows={3} value={currentAnswer?.feedback ?? ""} onChange={(e) => updateLocal(current.id, { feedback: e.target.value })} />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Label>Overall feedback (shown on result page)</Label>
                <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" disabled={savingDraft} onClick={saveDraft}>
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save draft
            </Button>
            <Button disabled={submitting} onClick={publish}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} Publish result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
