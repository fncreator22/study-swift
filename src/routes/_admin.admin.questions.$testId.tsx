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

const empty = { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "a", position: 0 };

function QuestionsAdmin() {
  const { testId } = Route.useParams();
  const nav = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [qs, setQs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  async function load() {
    const { data: t } = await supabase.from("tests").select("title").eq("id", testId).maybeSingle();
    setTest(t);
    const { data } = await supabase.from("test_questions").select("*").eq("test_id", testId).order("position");
    setQs(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [testId]);

  async function save() {
    const payload = { ...form, test_id: testId, position: qs.length };
    const { error } = await supabase.from("test_questions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Added"); setOpen(false); setForm(empty); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await supabase.from("test_questions").delete().eq("id", id);
    load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => nav({ to: "/admin/tests" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Tests</button>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Questions · {test?.title}</h1>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add question</Button>
      </div>
      <div className="mt-8 space-y-3">
        {qs.length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
        {qs.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Q{i + 1}</p>
                <h3 className="mt-1 font-display font-semibold">{q.question}</h3>
                <ul className="mt-3 space-y-1 text-sm">
                  {(["a", "b", "c", "d"] as const).map((k) => (
                    <li key={k} className={k === q.correct_option ? "font-medium text-success" : "text-muted-foreground"}>
                      <span className="mr-1 uppercase">{k}.</span> {q["option_" + k]}
                    </li>
                  ))}
                </ul>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(q.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New question</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Question</Label><Textarea value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
            {(["a", "b", "c", "d"] as const).map((k) => (
              <div key={k}><Label>Option {k.toUpperCase()}</Label><Input value={form["option_" + k]} onChange={(e) => setForm({ ...form, ["option_" + k]: e.target.value })} /></div>
            ))}
            <div><Label>Correct answer</Label>
              <Select value={form.correct_option} onValueChange={(v) => setForm({ ...form, correct_option: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["a", "b", "c", "d"] as const).map((k) => <SelectItem key={k} value={k}>{k.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
