import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, BookOpen, ExternalLink, Send, Loader2, Trophy, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_admin/admin/reviews")({ component: AdminReviews });

// ── Mock Test Attempt type ────────────────────────────────────────────────
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

// ── Course Assessment Attempt type ────────────────────────────────────────
type CourseAttempt = {
  id: string;
  status: string;
  score: number;
  started_at: string;
  completed_at: string | null;
  locked_full_name: string;
  locked_dob: string;
  responses: Record<string, string>;
  course_enrollments_v2: {
    id: string;
    course_id: string;
    user_id: string;
    courses_v2: { title: string; category: string };
    profiles: { full_name: string; college?: string };
  };
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    submitted:     { label: "Submitted",     cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    under_review:  { label: "Under Review",  cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    approved:      { label: "Approved",      cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    rejected:      { label: "Rejected",      cls: "bg-red-500/10 text-red-600 border-red-500/20" },
    resubmit:      { label: "Resubmit",      cls: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  };
  const d = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <Badge className={`border gap-1 font-semibold ${d.cls}`}>{d.label}</Badge>;
}

function AdminReviews() {
  // ── Mock Test state ───────────────────────────────────────────────────────
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [mockLoading, setMockLoading] = useState(true);
  const [selected, setSelected] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [score, setScore] = useState("0");
  const [total, setTotal] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Course Assessment state ───────────────────────────────────────────────
  const [courseAttempts, setCourseAttempts] = useState<CourseAttempt[]>([]);
  const [courseLoading, setCourseLoading] = useState(true);
  const [selectedCourseAttempt, setSelectedCourseAttempt] = useState<CourseAttempt | null>(null);
  const [marksAwarded, setMarksAwarded] = useState("0");
  const [adminNotes, setAdminNotes] = useState("");
  const [courseSubmitting, setCourseSubmitting] = useState(false);

  // ── Load mock tests ───────────────────────────────────────────────────────
  async function loadMockTests() {
    setMockLoading(true);
    const [attemptsRes, coursesRes] = await Promise.all([
      supabase
        .from("test_attempts")
        .select("*, profiles(full_name, college), tests(title, test_type, total_marks)")
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false }),
      supabase.from("courses_v2").select("id, title, completion_test_id"),
    ]);

    if (attemptsRes.error) {
      toast.error(attemptsRes.error.message);
    } else {
      const filtered = (attemptsRes.data ?? []).filter((a: any) =>
        a.tests && (a.tests.test_type === "written" || a.tests.test_type === "hybrid")
      );
      setAttempts(filtered as any);
    }
    if (coursesRes.data) setCourses(coursesRes.data);
    setMockLoading(false);
  }

  // ── Load course assessments ───────────────────────────────────────────────
  async function loadCourseAssessments() {
    setCourseLoading(true);
    const { data, error } = await supabase
      .from("course_assessment_attempts_v2")
      .select(`
        id, status, score, started_at, completed_at,
        locked_full_name, locked_dob, responses,
        course_enrollments_v2!inner(
          id, course_id, user_id,
          courses_v2!inner(title, category),
          profiles!inner(full_name, college)
        )
      `)
      .order("started_at", { ascending: false }) as any;

    if (error) {
      toast.error("Failed to load course assessments: " + error.message);
    } else {
      setCourseAttempts((data ?? []) as CourseAttempt[]);
    }
    setCourseLoading(false);
  }

  useEffect(() => {
    loadMockTests();
    loadCourseAssessments();
  }, []);

  // ── Mock test review helpers ──────────────────────────────────────────────
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
    if (error) toast.error(error.message);
    else {
      toast.success("Result published successfully");
      setSelected(null);
      loadMockTests();
    }
    setSubmitting(false);
  }

  // ── Course assessment review helpers ─────────────────────────────────────
  function openCourseReview(a: CourseAttempt) {
    setSelectedCourseAttempt(a);
    setMarksAwarded((a.score || 0).toString());
    setAdminNotes("");
  }

  async function submitCourseReview(action: "approved" | "rejected" | "resubmit") {
    if (!selectedCourseAttempt) return;
    setCourseSubmitting(true);
    try {
      const { error } = await supabase.rpc("admin_approve_assessment_v3" as any, {
        _attempt_id: selectedCourseAttempt.id,
        _marks_awarded: parseFloat(marksAwarded) || 0,
        _admin_notes: adminNotes,
        _action: action,
      });
      if (error) {
        toast.error(error.message);
      } else {
        const msg = action === "approved"
          ? "✅ Assessment approved — certificate generated!"
          : action === "resubmit"
          ? "📤 Resubmission requested."
          : "❌ Assessment rejected.";
        toast.success(msg);
        setSelectedCourseAttempt(null);
        loadCourseAssessments();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to submit review");
    } finally {
      setCourseSubmitting(false);
    }
  }

  // ── Mock Test layout helpers ──────────────────────────────────────────────
  const courseTestIds = new Set(courses.map(c => c.completion_test_id).filter(Boolean));
  const testToCourseMap = new Map(courses.map(c => [c.completion_test_id, c.title]));
  const mockAttempts = attempts.filter(a => !courseTestIds.has(a.test_id));
  const linkedCourseAttempts = attempts.filter(a => courseTestIds.has(a.test_id));

  function MockAttemptsTable({ list }: { list: Attempt[] }) {
    return (
      <div className="responsive-table-container rounded-xl border border-border bg-card">
        <Table className="min-w-[650px]">
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Test / Course</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 italic text-muted-foreground">
                  No submissions found in this queue.
                </TableCell>
              </TableRow>
            ) : list.map((a) => {
              const linkedCourse = testToCourseMap.get(a.test_id);
              return (
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
                      {linkedCourse ? (
                        <span className="text-xs font-bold text-primary">Course: {linkedCourse}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground uppercase">Mock: {a.tests?.test_type}</span>
                      )}
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
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Assessment Reviews</h1>
        <p className="text-muted-foreground">Review, grade, and finalize mock test submissions and course certification assessments.</p>
      </div>

      <Tabs defaultValue="mock-tests" className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="mock-tests" className="rounded-lg px-4 py-2 font-semibold">
            Mock Test Reviews ({mockAttempts.length + linkedCourseAttempts.length})
          </TabsTrigger>
          <TabsTrigger value="course-assessments" className="rounded-lg px-4 py-2 font-semibold">
            Course Assessments ({courseAttempts.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Mock Tests ── */}
        <TabsContent value="mock-tests">
          {mockLoading ? (
            <div className="flex min-h-[200px] items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground animate-pulse">Loading attempts...</span>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-lg font-bold mb-3">Standard Mock Tests</h2>
                <MockAttemptsTable list={mockAttempts} />
              </div>
              {linkedCourseAttempts.length > 0 && (
                <div>
                  <h2 className="font-display text-lg font-bold mb-3">Legacy Course Exam Submissions</h2>
                  <MockAttemptsTable list={linkedCourseAttempts} />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Course Assessments (V2 table) ── */}
        <TabsContent value="course-assessments">
          {courseLoading ? (
            <div className="flex min-h-[200px] items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground animate-pulse">Loading assessments...</span>
            </div>
          ) : (
            <div className="responsive-table-container rounded-xl border border-border bg-card">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseAttempts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Trophy className="h-10 w-10 opacity-20" />
                          <p className="text-sm font-medium italic">No course assessment submissions yet.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : courseAttempts.map((a) => {
                    const enrollment = a.course_enrollments_v2;
                    const prof = enrollment?.profiles;
                    const course = enrollment?.courses_v2;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{a.locked_full_name || prof?.full_name || "Unknown"}</span>
                            <span className="text-xs text-muted-foreground">{prof?.college || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium line-clamp-1">{course?.title || "—"}</span>
                            <span className="text-xs text-muted-foreground">{course?.category || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(a.started_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{statusBadge(a.status)}</TableCell>
                        <TableCell className="font-mono">{a.score ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {a.status !== "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openCourseReview(a)}
                              className="rounded-xl font-bold"
                            >
                              <ExternalLink className="mr-1.5 h-3 w-3" /> Review
                            </Button>
                          )}
                          {a.status === "approved" && (
                            <Badge className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Certificate Issued
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Mock Test Review Dialog ── */}
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

      {/* ── Course Assessment Review Dialog ── */}
      <Dialog open={!!selectedCourseAttempt} onOpenChange={(o) => !o && setSelectedCourseAttempt(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Course Assessment Review
            </DialogTitle>
          </DialogHeader>
          {selectedCourseAttempt && (
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              {/* Student + Course info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border p-4 bg-muted/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Student</p>
                  <p className="mt-1 font-semibold">{selectedCourseAttempt.locked_full_name}</p>
                  <p className="text-xs text-muted-foreground">DOB: {selectedCourseAttempt.locked_dob}</p>
                  <p className="text-xs text-muted-foreground">{selectedCourseAttempt.course_enrollments_v2?.profiles?.college || "—"}</p>
                </div>
                <div className="rounded-xl border border-border p-4 bg-muted/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Course</p>
                  <p className="mt-1 font-semibold">{selectedCourseAttempt.course_enrollments_v2?.courses_v2?.title || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    Category: {selectedCourseAttempt.course_enrollments_v2?.courses_v2?.category || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted: {new Date(selectedCourseAttempt.started_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Responses */}
              <div>
                <h3 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" /> Student Responses
                </h3>
                {Object.keys(selectedCourseAttempt.responses ?? {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No responses recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(selectedCourseAttempt.responses ?? {}).map(([qId, ans], i) => (
                      <div key={qId} className="rounded-2xl border border-border bg-card p-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                          Response {i + 1}
                        </p>
                        <p className="text-sm font-medium bg-muted/50 rounded-xl p-3 whitespace-pre-wrap">
                          {String(ans) || "No answer"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grading */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="font-display font-bold text-lg flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" /> Grading
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Marks Awarded</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={marksAwarded}
                      onChange={(e) => setMarksAwarded(e.target.value)}
                      placeholder="0–100"
                    />
                  </div>
                  <div>
                    <Label>Admin Notes (visible to student)</Label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Feedback for the student..."
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-4 border-t border-border gap-2">
            <Button variant="outline" onClick={() => setSelectedCourseAttempt(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={courseSubmitting}
              onClick={() => submitCourseReview("resubmit")}
              className="rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {courseSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Resubmission"}
            </Button>
            <Button
              variant="outline"
              disabled={courseSubmitting}
              onClick={() => submitCourseReview("rejected")}
              className="rounded-xl border-red-300 text-red-700 hover:bg-red-50"
            >
              {courseSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
            <Button
              disabled={courseSubmitting}
              onClick={() => submitCourseReview("approved")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
            >
              {courseSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Approve & Issue Certificate</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
