import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, BookOpen, ExternalLink, Send,
  Loader2, Trophy, AlertCircle, RefreshCw, XCircle, ShieldAlert, Award, FileText
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_admin/admin/course-reviews")({
  component: CourseReviewsDashboard,
});

type CourseAttempt = {
  id: string;
  status: string;
  score: number;
  started_at: string;
  completed_at: string | null;
  locked_full_name: string;
  locked_dob: string;
  responses: Record<string, string>;
  grading_details: Record<string, any>;
  confidence_score: number;
  course_enrollments_v2: {
    id: string;
    course_id: string;
    user_id: string;
    courses_v2: { id: string; title: string; category: string };
    profiles: { full_name: string; college?: string };
  };
};

type QuestionInfo = {
  id: string;
  question_text: string;
  question_type: string;
  options: any;
  correct_answers: any;
  weight: number;
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    submitted:     { label: "Submitted",     cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    under_review:  { label: "Under Review",  cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    approved:      { label: "Approved (Passed)", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    rejected:      { label: "Rejected (Failed)", cls: "bg-red-500/10 text-red-600 border-red-500/20" },
    resubmit:      { label: "Resubmit",      cls: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  };
  const d = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <Badge className={`border gap-1 font-semibold ${d.cls}`}>{d.label}</Badge>;
}

function CourseReviewsDashboard() {
  const [attempts, setAttempts] = useState<CourseAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<CourseAttempt | null>(null);
  const [questions, setQuestions] = useState<Record<string, QuestionInfo>>({});
  const [marksOverride, setMarksOverride] = useState("0");
  const [adminNotes, setAdminNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [learnerHistory, setLearnerHistory] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    let query = supabase
      .from("course_assessment_attempts_v2")
      .select(`
        id, status, score, started_at, completed_at,
        locked_full_name, locked_dob, responses, grading_details, confidence_score,
        course_enrollments_v2!inner(
          id, course_id, user_id,
          courses_v2!inner(id, title, category),
          profiles!inner(full_name, college)
        )
      `)
      .order("started_at", { ascending: false });

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query as any;

    if (error) {
      toast.error("Failed to load course attempts: " + error.message);
    } else {
      setAttempts((data ?? []) as CourseAttempt[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  async function openReviewModal(attempt: CourseAttempt) {
    setSelectedAttempt(attempt);
    setMarksOverride(attempt.score.toString());
    
    // Load admin notes from previous review if it exists
    const { data: reviewData } = await supabase
      .from("course_assessment_reviews_v2")
      .select("admin_notes")
      .eq("attempt_id", attempt.id)
      .maybeSingle();
    
    setAdminNotes(reviewData?.admin_notes || "");

    // Load questions for the course assessment
    const { data: qData } = await supabase
      .from("course_assessment_questions_v2")
      .select("id, question_text, question_type, options, correct_answers, weight")
      .eq("assessment_id", (
        await supabase
          .from("course_assessments_v2")
          .select("id")
          .eq("course_id", attempt.course_enrollments_v2.courses_v2.id)
          .single()
      ).data?.id || "");

    const qMap: Record<string, QuestionInfo> = {};
    (qData || []).forEach((q: any) => {
      qMap[q.id] = q;
    });
    setQuestions(qMap);

    // Load learner history
    const { data: history } = await supabase
      .from("course_enrollments_v2")
      .select(`
        id, enrolled_at, progress_percent,
        courses_v2(title)
      `)
      .eq("user_id", attempt.course_enrollments_v2.user_id);
    
    setLearnerHistory(history || []);
  }

  async function handleOverride(action: "approved" | "rejected" | "resubmit") {
    if (!selectedAttempt) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("admin_approve_assessment_v3" as any, {
        _attempt_id: selectedAttempt.id,
        _marks_awarded: parseFloat(marksOverride) || 0,
        _admin_notes: adminNotes,
        _action: action,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Successfully saved decision: ${action.toUpperCase()}`);
        setSelectedAttempt(null);
        loadData();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to submit decision override.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerateCertificate() {
    if (!selectedAttempt) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("course_certificates_v2").delete().eq("enrollment_id", selectedAttempt.course_enrollments_v2.id);
      if (error) throw error;

      const { data: certId, error: genError } = await supabase.rpc("admin_approve_assessment_v3" as any, {
        _attempt_id: selectedAttempt.id,
        _marks_awarded: selectedAttempt.score,
        _admin_notes: adminNotes || "Certificate regenerated by Administrator.",
        _action: "approved"
      });

      if (genError) throw genError;
      toast.success("Certificate successfully regenerated!");
    } catch (e: any) {
      toast.error("Failed to regenerate: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black text-gray-900 dark:text-white">Intelligent Assessment Queue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">View auto-graded written exams, similarity score metrics, and manage administrative approvals.</p>
        </div>
        <div className="flex gap-2">
          {["all", "under_review", "approved", "rejected", "resubmit"].map((st) => (
            <Button
              key={st}
              size="sm"
              variant={filterStatus === st ? "default" : "outline"}
              onClick={() => setFilterStatus(st)}
              className="rounded-xl text-xs font-semibold capitalize"
            >
              {st === "all" ? "All Attempts" : st.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center flex-col gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-gray-500 animate-pulse font-medium">Fetching assessments queue...</p>
        </div>
      ) : attempts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-16 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700 mb-4" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Queue Empty</h3>
          <p className="text-xs text-gray-500 mt-1">No course completion assessments found matching status "{filterStatus}".</p>
        </div>
      ) : (
        <div className="responsive-table-container rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-soft">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Student Details</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Final Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((att) => {
                const enr = att.course_enrollments_v2;
                return (
                  <TableRow key={att.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 dark:text-white">{att.locked_full_name}</span>
                        <span className="text-xs text-gray-500">{enr?.profiles?.college || "No College"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{enr?.courses_v2?.title}</span>
                        <span className="text-[10px] text-gray-500 uppercase font-semibold">{enr?.courses_v2?.category}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${att.confidence_score >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                            style={{ width: `${att.confidence_score || 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
                          {att.confidence_score ? `${att.confidence_score}%` : '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{att.score}%</span>
                    </TableCell>
                    <TableCell>{statusBadge(att.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openReviewModal(att)} className="rounded-xl font-semibold gap-1">
                        <ExternalLink className="h-3 w-3" /> Audit Review
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Audit Review Dialog */}
      <Dialog open={!!selectedAttempt} onOpenChange={(o) => !o && setSelectedAttempt(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Trophy className="h-5.5 w-5.5 text-amber-500 animate-bounce" />
              Automated Review Audit
            </DialogTitle>
            <DialogDescription>
              Audit similarity grading results for candidate {selectedAttempt?.locked_full_name}.
            </DialogDescription>
          </DialogHeader>

          {selectedAttempt && (
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              {/* Info grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Candidate Profile</p>
                  <p className="font-bold text-gray-900 dark:text-white mt-1">{selectedAttempt.locked_full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">DOB: {selectedAttempt.locked_dob}</p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assessment Target</p>
                  <p className="font-bold text-gray-900 dark:text-white mt-1">{selectedAttempt.course_enrollments_v2?.courses_v2?.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Category: {selectedAttempt.course_enrollments_v2?.courses_v2?.category}</p>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Evaluation Mode</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-bold border-purple-200">Similarity Matcher</Badge>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Confidence Factor: {selectedAttempt.confidence_score}%</p>
                </div>
              </div>

              {/* Answers Audit Section */}
              <div className="space-y-4">
                <h3 className="font-display font-bold text-base text-gray-900 dark:text-white flex items-center gap-1.5">
                  <BookOpen className="h-4.5 w-4.5 text-primary" /> Evaluation Audit details
                </h3>

                {Object.keys(selectedAttempt.responses || {}).map((qId, index) => {
                  const q = questions[qId];
                  const resp = selectedAttempt.responses[qId];
                  const grade = selectedAttempt.grading_details?.[qId];

                  return (
                    <div key={qId} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 shadow-soft">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Question {index + 1}</span>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white mt-0.5">{q?.question_text || "Question definition loaded"}</p>
                        </div>
                        <Badge variant="outline" className="font-mono shrink-0">Weight: {q?.weight || "1.00"}</Badge>
                      </div>

                      {/* Candidate response */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Learner Answer</span>
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3 text-sm italic font-mono text-gray-800 dark:text-gray-200">
                          {resp || "No answer submitted"}
                        </div>
                      </div>

                      {/* Reference answer / correct choices */}
                      {q?.question_type === "mcq" ? (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Correct Options</span>
                          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            Expected: {JSON.stringify(q?.correct_answers)}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Reference Key Answer</span>
                            <div className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/20 p-3 text-xs text-gray-700 dark:text-gray-300">
                              {q?.correct_answers?.reference || q?.correct_answers || "N/A"}
                            </div>
                          </div>
                          {q?.correct_answers?.keywords && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Required concepts:</span>
                              {(q?.correct_answers?.keywords as string[]).map((kw, i) => {
                                const found = grade?.evaluation?.found_keywords?.includes(kw);
                                return (
                                  <Badge
                                    key={i}
                                    variant="outline"
                                    className={`text-[9px] font-bold ${
                                      found 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                        : 'bg-red-50 text-red-700 border-red-200'
                                    }`}
                                  >
                                    {kw}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Grading details logs */}
                      {grade && (
                        <div className="bg-gray-50/70 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-100 dark:border-gray-800 text-xs space-y-1 font-mono">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Intelligent Grade Score:</span>
                            <span className="font-bold text-primary">{grade.score} / {grade.max_score}</span>
                          </div>
                          {grade.evaluation?.similarity_score !== undefined && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Semantic Similarity:</span>
                                <span>{grade.evaluation.similarity_score}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Jaccard word index:</span>
                                <span>{grade.evaluation.jaccard_similarity}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Keyword Coverage:</span>
                                <span>{grade.evaluation.keyword_match_pct}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Word Count:</span>
                                <span>{grade.evaluation.word_count || 0} words</span>
                              </div>
                            </>
                          )}
                          {grade.evaluation === "Correct" && (
                            <div className="text-emerald-600 font-bold">✅ Deterministic match check passed</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Candidate history */}
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2">Student Course History</h4>
                <div className="space-y-1.5 text-xs">
                  {learnerHistory.map((h, i) => (
                    <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0 dark:border-gray-800">
                      <span className="text-gray-800 dark:text-gray-200">{h.courses_v2?.title}</span>
                      <Badge variant="secondary" className="font-bold text-[10px]">{h.progress_percent}% complete</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Override and notes */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h3 className="font-display font-bold text-base text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Send className="h-4.5 w-4.5 text-primary" /> Grade Overriding
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Marks Override (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={marksOverride}
                      onChange={(e) => setMarksOverride(e.target.value)}
                      className="mt-1 font-mono font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Auditing Notes / Feedback comments</Label>
                    <Textarea
                      rows={3}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Explain override reason or add constructive advice for resubmissions..."
                      className="mt-1 resize-none text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-gray-100 dark:border-gray-800 gap-2">
            <Button variant="outline" onClick={() => setSelectedAttempt(null)} className="rounded-xl">Cancel</Button>
            {selectedAttempt?.status === "approved" && (
              <Button
                variant="outline"
                onClick={handleRegenerateCertificate}
                disabled={submitting}
                className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/20 font-bold gap-1.5"
              >
                <RefreshCw className="h-4 w-4" /> Regenerate Certificate
              </Button>
            )}
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => handleOverride("resubmit")}
              className="rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50 font-bold"
            >
              Request Resubmit
            </Button>
            <Button
              variant="outline"
              disabled={submitting}
              onClick={() => handleOverride("rejected")}
              className="rounded-xl border-red-300 text-red-700 hover:bg-red-50 font-bold"
            >
              Fail Candidate
            </Button>
            <Button
              disabled={submitting}
              onClick={() => handleOverride("approved")}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Override & Pass</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
