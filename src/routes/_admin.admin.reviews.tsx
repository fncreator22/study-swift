import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, BookOpen, ExternalLink, Send, Loader2 } from "lucide-react";
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
  profiles: { full_name: string; college?: string };
  tests: { title: string; test_type: string; total_marks: number };
};

function AdminReviews() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [mockLoading, setMockLoading] = useState(true);
  const [selected, setSelected] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [score, setScore] = useState("0");
  const [total, setTotal] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadMockTests() {
    setMockLoading(true);
    const { data: attemptsRes, error } = await supabase
      .from("test_attempts")
      .select("*, profiles(full_name, college), tests(title, test_type, total_marks)")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      // Filter only written or hybrid mock test formats
      const filtered = (attemptsRes ?? []).filter((a: any) =>
        a.tests && (a.tests.test_type === "written" || a.tests.test_type === "hybrid")
      );
      setAttempts(filtered as any);
    }
    setMockLoading(false);
  }

  useEffect(() => {
    loadMockTests();
  }, []);

  async function openReview(a: Attempt) {
    setSelected(a);
    setScore((a.score || 0).toString());
    setTotal((a.total || a.tests?.total_marks || 0).toString());
    setFeedback(a.feedback || "");
    const { data, error } = await supabase
      .from("test_answers")
      .select("*, test_questions(question, max_words, question_type, correct_option, explanation)")
      .eq("attempt_id", a.id);
    if (error) toast.error("Failed to load responses: " + error.message);
    else setAnswers(data ?? []);
  }

  async function finalizeMock() {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("publish_attempt" as any, {
      _attempt_id: selected.id,
      _score: parseInt(score) || 0,
      _total: parseInt(total) || 0,
      _feedback: feedback,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Result published successfully");
      setSelected(null);
      loadMockTests();
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Mock Test Reviews</h1>
        <p className="text-muted-foreground">Grade and finalize written/hybrid submissions for traditional mock tests.</p>
      </div>

      {mockLoading ? (
        <div className="flex min-h-[200px] items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground animate-pulse">Loading mock tests queue...</span>
        </div>
      ) : (
        <div className="responsive-table-container rounded-xl border border-border bg-card">
          <Table className="min-w-[650px]">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Test Title</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 italic text-muted-foreground">
                    No mock test submissions in queue.
                  </TableCell>
                </TableRow>
              ) : (
                attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{a.profiles?.full_name || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">{a.profiles?.college || "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{a.tests?.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{a.tests?.test_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.submitted_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {a.is_reviewed ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Reviewed
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 gap-1">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{a.score}/{a.total || a.tests?.total_marks}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openReview(a)} className="rounded-xl font-bold">
                        <ExternalLink className="mr-1.5 h-3 w-3" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mock Test Review Dialog */}
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
                <p className="text-xs text-muted-foreground">Total Marks: {selected?.tests?.total_marks}</p>
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
              {answers.map((ans, i) => {
                const q = ans.test_questions;
                const isMcq = q?.question_type === "mcq";
                const correct = isMcq && ans.selected_option && q?.correct_option &&
                  ans.selected_option.toLowerCase() === q.correct_option.toLowerCase();
                return (
                  <div key={ans.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Question {i + 1} · {isMcq ? "MCQ" : "Written"}
                    </p>
                    <p className="mt-1 font-semibold">{q?.question}</p>
                    {isMcq ? (
                      <div className="mt-3 text-sm">
                        <p>Student answer: <b className={correct ? "text-emerald-600" : "text-destructive"}>{ans.selected_option?.toUpperCase() || "—"}</b></p>
                        <p className="text-muted-foreground">Correct: <b className="text-emerald-600">{q?.correct_option?.toUpperCase()}</b></p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-4 rounded-xl bg-muted p-4 text-sm whitespace-pre-wrap border border-border/50 italic">
                          {ans.written_answer || "No answer submitted."}
                        </div>
                        <p className="mt-2 text-right text-[10px] text-muted-foreground">Word limit: {q?.max_words || "—"}</p>
                      </>
                    )}
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
                  <Label>Score</Label>
                  <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} max={total} />
                  <p className="text-[10px] text-muted-foreground mt-1">Out of {total}</p>
                </div>
                <div className="sm:col-span-1">
                  <Label>Total Marks</Label>
                  <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Overall Feedback</Label>
                  <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Provide constructive feedback..." />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button disabled={submitting} onClick={finalizeMock}>
              {submitting ? "Publishing..." : selected?.is_reviewed ? "Update Result" : "Finalize & Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
