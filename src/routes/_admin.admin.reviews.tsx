import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, User, BookOpen, ExternalLink, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_admin/admin/reviews")({ component: AdminReviews });

type Attempt = {
  id: string;
  user_id: string;
  test_id: string;
  score: number;
  total: number;
  submitted_at: string;
  is_reviewed: boolean;
  feedback: string | null;
  profiles: { full_name: string; college: string };
  tests: { title: string; test_type: string };
};

function AdminReviews() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [score, setScore] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("test_attempts")
      .select("*, profiles(full_name, college), tests(title, test_type)")
      .not("submitted_at", "is", null)
      .eq("tests.test_type", "written")
      .order("submitted_at", { ascending: false });

    if (error) toast.error(error.message);
    else setAttempts(data as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openReview(a: Attempt) {
    setSelected(a);
    setScore(a.score.toString());
    setFeedback(a.feedback || "");
    
    // Load questions and answers
    const { data: qs } = await supabase.from("test_questions").select("*").eq("test_id", a.test_id).order("position");
    const { data: ans } = await supabase.from("test_answers").select("*").eq("attempt_id", a.id);
    
    setQuestions(qs ?? []);
    setAnswers(ans ?? []);
  }

  async function finalize() {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("test_attempts")
      .update({
        score: parseInt(score),
        feedback: feedback,
        is_reviewed: true
      })
      .eq("id", selected.id);

    if (error) toast.error(error.message);
    else {
      toast.success("Result finalized");
      setSelected(null);
      load();
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Written Test Reviews</h1>
        <p className="text-muted-foreground">Review and grade student submissions for written examinations.</p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : attempts.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">No submissions to review</TableCell></TableRow>
            ) : attempts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{a.profiles?.full_name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{a.profiles?.college}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{a.tests?.title}</span>
                    <span className="text-xs text-muted-foreground uppercase">{a.tests?.test_type}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(a.submitted_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {a.is_reviewed ? (
                    <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Reviewed</Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono">{a.score}/{a.total}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openReview(a)}>
                    <ExternalLink className="mr-2 h-3 w-3" /> {a.is_reviewed ? "Edit" : "Review"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Submission: {selected?.profiles?.full_name}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Test Details</p>
                <p className="mt-1 font-semibold">{selected?.tests?.title}</p>
                <p className="text-xs text-muted-foreground">Total Marks: {selected?.total}</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Submission Info</p>
                <p className="mt-1 font-semibold">{selected?.submitted_at && new Date(selected.submitted_at).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Attempt ID: {selected?.id.slice(0, 8)}...</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Student Responses
              </h3>
              {questions.map((q, i) => {
                const ans = answers.find(a => a.question_id === q.id);
                return (
                  <div key={q.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                    <p className="text-xs text-muted-foreground">Q{i + 1} · {q.question_type}</p>
                    <p className="mt-1 font-semibold">{q.question}</p>
                    <div className="mt-4 rounded-xl bg-muted p-4 text-sm whitespace-pre-wrap border border-border/50 italic">
                      {ans?.written_answer || "No answer submitted."}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" /> Grading & Feedback
              </h3>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-1">
                  <Label>Total Score</Label>
                  <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} max={selected?.total} />
                  <p className="text-[10px] text-muted-foreground mt-1">Out of {selected?.total}</p>
                </div>
                <div className="sm:col-span-3">
                  <Label>Overall Feedback</Label>
                  <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Provide constructive feedback..." />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button disabled={submitting} onClick={finalize}>
              {selected?.is_reviewed ? "Update Result" : "Finalize & Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
