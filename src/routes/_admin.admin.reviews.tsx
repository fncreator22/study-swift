import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, CheckCircle, Clock, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/reviews")({ component: AdminReviews });

function AdminReviews() {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [form, setForm] = useState({ score: 0, total: 0 });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    // Fetch attempts for written tests that are submitted
    const { data } = await supabase
      .from("test_attempts")
      .select("*, tests(title, test_type, total_marks), profiles(full_name)")
      .not("submitted_at", "is", null)
      .eq("tests.test_type", "written")
      .order("submitted_at", { ascending: false });
    
    // Filter because Supabase doesn't support inner join filtering easily in JS client for nested objects sometimes
    const filtered = (data ?? []).filter(a => a.tests?.test_type === "written");
    setAttempts(filtered);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openReview(a: any) {
    setSelected(a);
    setForm({ score: a.score || 0, total: a.tests?.total_marks || 0 });
    const { data } = await supabase
      .from("test_answers")
      .select("*, test_questions(question, max_words)")
      .eq("attempt_id", a.id);
    setAnswers(data ?? []);
  }

  async function submitReview() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("test_attempts")
      .update({ score: Number(form.score), total: Number(form.total) })
      .eq("id", selected.id);
    
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Review published");
    setSelected(null);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Written Reviews</h1>
          <p className="text-sm text-muted-foreground">Grade and publish results for essay-style tests.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}><Search className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Test</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attempts.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">No written submissions found.</td>
                </tr>
              )}
              {attempts.map((a) => (
                <tr key={a.id} className="group hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium">{a.profiles?.full_name || "Unknown"}</td>
                  <td className="px-6 py-4">{a.tests?.title}</td>
                  <td className="px-6 py-4 text-muted-foreground">{new Date(a.submitted_at).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    {a.score > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success uppercase">
                        <CheckCircle className="h-3 w-3" /> Reviewed ({a.score}/{a.total})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning uppercase">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openReview(a)}>
                      <ExternalLink className="mr-2 h-3.5 w-3.5" /> Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reviewing {selected?.profiles?.full_name}'s submission</DialogTitle>
            <p className="text-sm text-muted-foreground">{selected?.tests?.title}</p>
          </DialogHeader>
          
          <div className="mt-4 space-y-6">
            {answers.map((ans, i) => (
              <div key={ans.id} className="rounded-2xl border border-border bg-muted/30 p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Question {i + 1}</p>
                <h4 className="mt-1 font-display font-semibold">{ans.test_questions?.question}</h4>
                <div className="mt-4 rounded-xl bg-card border border-border p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {ans.written_answer || <span className="text-muted-foreground italic">No answer provided.</span>}
                </div>
                <p className="mt-2 text-right text-[10px] text-muted-foreground">Word limit: {ans.test_questions?.max_words || "—"}</p>
              </div>
            ))}

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <h4 className="font-display font-bold">Assign Grade</h4>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Total Marks</Label>
                  <Input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={submitReview} disabled={saving}>
              {saving ? "Publishing..." : "Publish Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
