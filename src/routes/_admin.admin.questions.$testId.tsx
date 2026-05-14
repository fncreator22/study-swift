import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/questions/$testId")({ component: QuestionsAdmin });

const MAX_QUESTIONS = 100;
const emptyMcq = { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "a", explanation: "" };
const emptyWritten = { question: "", max_words: 500 };

function QuestionsAdmin() {
  const { testId } = Route.useParams();
  const nav = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [qs, setQs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyMcq);

  const isWritten = test?.test_type === "written";

  async function load() {
    const { data: t } = await supabase.from("tests").select("*").eq("id", testId).maybeSingle();
    setTest(t);
    const { data } = await supabase.from("test_questions").select("*").eq("test_id", testId).order("position");
    setQs(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [testId]);

  function openNew() {
    if (qs.length >= MAX_QUESTIONS) return toast.error(`Max ${MAX_QUESTIONS} questions per test`);
    setForm(isWritten ? { ...emptyWritten, max_words: test?.word_limit ?? 500 } : emptyMcq);
    setOpen(true);
  }

  async function save() {
    if (!form.question.trim()) return toast.error("Question text required");
    const base: any = {
      test_id: testId,
      position: qs.length,
      question: form.question,
      question_type: isWritten ? "written" : "mcq",
    };
    if (isWritten) {
      base.max_words = Number(form.max_words) || 500;
    } else {
      if (!form.option_a || !form.option_b || !form.option_c || !form.option_d)
        return toast.error("All four options required");
      Object.assign(base, {
        option_a: form.option_a, option_b: form.option_b, option_c: form.option_c, option_d: form.option_d,
        correct_option: form.correct_option,
        explanation: form.explanation,
      });
    }
    const { error } = await supabase.from("test_questions").insert(base);
    if (error) return toast.error(error.message);
    toast.success(`Question ${qs.length + 1} added`);
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await supabase.from("test_questions").delete().eq("id", id);
    load();
  }

  if (!test) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => nav({ to: "/admin/tests" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Tests</button>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Questions · {test.title}</h1>
          <p className="text-sm text-muted-foreground">
            {isWritten ? "Written" : "MCQ"} test · {qs.length}/{MAX_QUESTIONS} questions
          </p>
        </div>
        <Button onClick={openNew} disabled={qs.length >= MAX_QUESTIONS}>
          <Plus className="mr-2 h-4 w-4" /> Add another question
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {qs.length === 0 && <p className="text-sm text-muted-foreground">No questions yet. Click “Add another question” to begin.</p>}
        {qs.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Q{i + 1} · {q.question_type === "written" ? "Written" : "MCQ"}</p>
                <h3 className="mt-1 font-display font-semibold">{q.question}</h3>
                {q.question_type === "written" ? (
                  <p className="mt-2 text-xs text-muted-foreground">Max words: {q.max_words ?? "—"}</p>
                ) : (
                  <ul className="mt-3 space-y-1 text-sm">
                    {(["a", "b", "c", "d"] as const).map((k) => (
                      <li key={k} className={k === q.correct_option ? "font-medium text-success" : "text-muted-foreground"}>
                        <span className="mr-1 uppercase">{k}.</span> {q["option_" + k]}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(q.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New {isWritten ? "written" : "MCQ"} question (Q{qs.length + 1})</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Question</Label><Textarea rows={3} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
            {isWritten ? (
              <div>
                <Label>Word limit</Label>
                <Input type="number" value={form.max_words} onChange={(e) => setForm({ ...form, max_words: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Students will get a writing area sized for this limit.</p>
              </div>
            ) : (
              <>
                {(["a", "b", "c", "d"] as const).map((k) => (
                  <div key={k}><Label>Option {k.toUpperCase()}</Label><Input value={form["option_" + k] ?? ""} onChange={(e) => setForm({ ...form, ["option_" + k]: e.target.value })} /></div>
                ))}
                <div>
                  <Label>Correct answer</Label>
                  <Select value={form.correct_option} onValueChange={(v) => setForm({ ...form, correct_option: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["a", "b", "c", "d"] as const).map((k) => <SelectItem key={k} value={k}>{k.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Explanation (for correct answer)</Label>
                  <Textarea
                    rows={3}
                    value={form.explanation}
                    onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                    placeholder="Why is the answer correct?"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter><Button onClick={save}>Add question</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
