import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Clock, CheckCircle, ArrowLeft, ArrowRight, Trophy,
  AlertCircle, Loader2, BookOpen, Shield, FileText, CheckCircle2, XCircle
} from "lucide-react";

export const Route = createFileRoute("/_student/portal/$courseId/assessment")({
  component: CourseAssessment,
});

type Question = {
  id: string;
  question_text: string;
  question_type: "mcq" | "written" | "hybrid";
  options: { label: string; value: string }[];
  order_index: number;
};

type AssessmentMeta = {
  id: string;
  passing_score: number;
  time_limit_min: number;
};

type ExamPhase = "pre" | "exam" | "submitted" | "already_approved";

function CourseAssessment() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<{ title: string } | null>(null);
  const [assessment, setAssessment] = useState<AssessmentMeta | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lockedName, setLockedName] = useState("");
  const [lockedDob, setLockedDob] = useState("");
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [lastAttemptInfo, setLastAttemptInfo] = useState<any>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string>("");

  // Exam state
  const [phase, setPhase] = useState<ExamPhase>("pre");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoSubmitted = useRef(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      // Load course info
      const { data: c } = await supabase
        .from("courses_v2")
        .select("title")
        .eq("id", courseId)
        .maybeSingle();
      setCourse(c ?? { title: "Course Assessment" });

      // Load enrollment
      const { data: enrollment } = await supabase
        .from("course_enrollments_v2")
        .select("id, progress_percent")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (!enrollment) {
        toast.error("You are not enrolled in this course.");
        navigate({ to: `/courses/${courseId}` });
        return;
      }
      setEnrollmentId(enrollment.id);

      // Check declaration exists
      const { data: decl } = await supabase
        .from("pre_assessment_declarations_v2")
        .select("id")
        .eq("enrollment_id", enrollment.id)
        .maybeSingle();

      if (!decl) {
        navigate({ to: `/portal/${courseId}/complete` });
        return;
      }

      // Check latest attempt status
      const { data: attempts } = await supabase
        .from("course_assessment_attempts_v2")
        .select("id, status, score, grading_details")
        .eq("enrollment_id", enrollment.id)
        .order("started_at", { ascending: false });

      const latestAttempt = attempts?.[0];

      if (latestAttempt) {
        if (latestAttempt.status === "approved") {
          setPhase("already_approved");
          setLoading(false);
          return;
        } else if (latestAttempt.status === "under_review" || latestAttempt.status === "submitted") {
          setPhase("submitted");
      load();
          setLoading(false);
          return;
        } else if (latestAttempt.status === "rejected" || latestAttempt.status === "resubmit") {
          setLastAttemptInfo({
            id: latestAttempt.id,
            score: latestAttempt.score,
            status: latestAttempt.status
          });

          // Fetch admin notes review feedback
          const { data: review } = await supabase
            .from("course_assessment_reviews_v2")
            .select("admin_notes")
            .eq("attempt_id", latestAttempt.id)
            .maybeSingle();
          if (review?.admin_notes) {
            setReviewFeedback(review.admin_notes);
          }
        }
      }

      // Load profile name & DOB (locked from completion gate)
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, date_of_birth")
        .eq("id", user.id)
        .maybeSingle();
      setLockedName(prof?.full_name ?? "");
      setLockedDob(prof?.date_of_birth ?? "");

      // Load assessment metadata
      const { data: asm } = await supabase
        .from("course_assessments_v2")
        .select("id, passing_score, time_limit_min")
        .eq("course_id", courseId)
        .maybeSingle();

      if (!asm) {
        // No formal assessment configured — show info
        setAssessment(null);
        setLoading(false);
        return;
      }
      setAssessment(asm);

      // Load questions
      const { data: qs } = await supabase
        .from("course_assessment_questions_v2")
        .select("id, question_text, question_type, options, order_index")
        .eq("assessment_id", asm.id)
        .order("order_index");

      const mapped: Question[] = (qs ?? []).map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: Array.isArray(q.options) ? q.options : [],
        order_index: q.order_index,
      }));
      setQuestions(mapped);
      setTimeRemaining(asm.time_limit_min * 60);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user, courseId]);

  // Timer
  useEffect(() => {
    if (phase !== "exam" || timeRemaining <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!hasAutoSubmitted.current) {
            hasAutoSubmitted.current = true;
            handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  async function handleSubmit() {
    if (submitting || !user || !enrollmentId) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const { error } = await supabase.rpc("submit_course_assessment_v3" as any, {
        _course_id: courseId,
        _locked_name: lockedName,
        _locked_dob: lockedDob,
        _responses: answers,
      });

      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }

      setPhase("submitted");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit assessment");
      setSubmitting(false);
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isTimeLow = timeRemaining > 0 && timeRemaining < 120;
  const answeredCount = Object.values(answers).filter(v => v.trim()).length;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center flex-col gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Loading assessment...</p>
      </div>
    );
  }

  // ── Already Approved ──────────────────────────────────────────────────────
  if (phase === "already_approved") {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <Trophy className="h-10 w-10 text-emerald-600" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-black text-emerald-700">Assessment Approved!</h1>
          <p className="text-muted-foreground mt-2">Your assessment has been reviewed and approved. Your certificate has been issued.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link to="/profile">
            <Button className="rounded-xl font-bold gap-2">
              <Trophy className="h-4 w-4" /> View Certificate
            </Button>
          </Link>
          <Link to="/courses">
            <Button variant="outline" className="rounded-xl">Browse More Courses</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Submitted ─────────────────────────────────────────────────────────────
  if (phase === "submitted") {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-black">Assessment Submitted!</h1>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
            Your assessment is now in the admin review queue. You will be notified once your result is available. 
            This typically takes 1–3 business days.
          </p>
        </div>
        <div className="rounded-2xl bg-muted/50 border border-border p-5 text-left space-y-2 max-w-sm mx-auto">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Submission Details</p>
          <p className="text-sm"><span className="text-muted-foreground">Course:</span> <span className="font-medium">{course?.title}</span></p>
          <p className="text-sm"><span className="text-muted-foreground">Name:</span> <span className="font-medium">{lockedName}</span></p>
          <p className="text-sm"><span className="text-muted-foreground">Questions answered:</span> <span className="font-medium">{answeredCount} of {questions.length}</span></p>
          <p className="text-sm"><span className="text-muted-foreground">Status:</span> <span className="font-medium text-amber-600">Pending Review</span></p>
        </div>
        <Link to="/dashboard">
          <Button variant="outline" className="rounded-xl">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // ── No Assessment Configured ───────────────────────────────────────────────
  if (!assessment || questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <AlertCircle className="h-8 w-8 text-amber-600" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-black">No Assessment Configured</h1>
          <p className="text-muted-foreground mt-2">
            The administrator has not configured an assessment for this course yet. Please check back later or contact support.
          </p>
        </div>
        <Link to={`/portal/${courseId}`}>
          <Button variant="outline" className="rounded-xl gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Course
          </Button>
        </Link>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === questions.length - 1;

  // ── Pre-exam Screen ────────────────────────────────────────────────────────
  if (phase === "pre") {
    return (
      <div className="mx-auto max-w-2xl py-10 space-y-6">
        <Link to={`/portal/${courseId}/complete`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-black">{course?.title}</h1>
            <p className="text-muted-foreground text-sm">Final Course Assessment</p>
          </div>

          {/* Assessment Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Questions", value: questions.length.toString(), icon: FileText },
              { label: "Time Limit", value: `${assessment.time_limit_min} min`, icon: Clock },
              { label: "Pass Mark", value: `${assessment.passing_score}%`, icon: CheckCircle2 },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl bg-muted/40 border border-border p-4 text-center">
                <Icon className="h-5 w-5 text-primary mx-auto mb-1.5" />
                <p className="text-lg font-black font-display">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Candidate info */}
          <div className="rounded-2xl bg-muted/30 border border-border p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Shield className="h-4 w-4" /> Candidate Information
            </div>
            <p className="text-sm"><span className="text-muted-foreground">Name:</span> <span className="font-semibold">{lockedName}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Date of Birth:</span> <span className="font-semibold">{lockedDob}</span></p>
            <p className="text-[10px] text-muted-foreground italic mt-1">
              🔒 These credentials are locked and will be printed on your certificate.
            </p>
          </div>

          {/* Instructions */}
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">⚠️ Instructions</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>Once started, the timer cannot be paused.</li>
              <li>All answers are saved automatically as you type.</li>
              <li>MCQ answers are final once you move to the next question.</li>
              <li>The exam will auto-submit when the time runs out.</li>
              <li>You may navigate between questions using Previous/Next.</li>
            </ul>
          </div>

          <Button
            className="w-full h-13 rounded-2xl font-bold text-base bg-primary text-primary-foreground hover:bg-primary/95"
            onClick={() => setPhase("exam")}
          >
            Start Assessment →
          </Button>
        </div>
      </div>
    );
  }

  // ── Active Exam ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl py-6 space-y-4">
      {/* Top bar */}
      <div className="rounded-2xl border border-border bg-card shadow-soft flex items-center justify-between px-6 py-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground font-medium line-clamp-1">{course?.title}</p>
          <p className="font-display text-sm font-bold">Question {currentIdx + 1} of {questions.length}</p>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-sm border ${
          isTimeLow
            ? "bg-red-50 border-red-300 text-red-700 animate-pulse"
            : "bg-slate-950 border-slate-800 text-white"
        }`}>
          <Clock className="h-4 w-4" />
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Question pager dots */}
      <div className="flex flex-wrap gap-1.5 px-1">
        {questions.map((q, i) => {
          const hasAns = !!(answers[q.id]?.trim());
          const isCurrent = i === currentIdx;
          return (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              title={`Question ${i + 1}`}
              className={`h-8 w-8 rounded-lg border text-xs font-bold transition-all ${
                isCurrent
                  ? "bg-primary border-primary text-primary-foreground shadow-md"
                  : hasAns
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Question card */}
      <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-soft space-y-6 min-h-[360px]">
        <div>
          <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-3 ${
            currentQ.question_type === "mcq" ? "bg-blue-100 text-blue-700" :
            currentQ.question_type === "written" ? "bg-purple-100 text-purple-700" :
            "bg-amber-100 text-amber-700"
          }`}>
            {currentQ.question_type === "mcq" ? "Multiple Choice" : currentQ.question_type === "written" ? "Written Answer" : "Hybrid"}
          </span>
          <h2 className="font-display text-lg md:text-xl font-semibold leading-snug">
            {currentQ.question_text}
          </h2>
        </div>

        {/* MCQ options */}
        {currentQ.question_type === "mcq" && currentQ.options.length > 0 && (
          <div className="space-y-3">
            {currentQ.options.map((opt: any, idx: number) => {
              const optVal = typeof opt === "object" ? (opt.value ?? opt.label ?? String(idx)) : String(opt);
              const optLabel = typeof opt === "object" ? (opt.label ?? opt.value ?? String(idx)) : String(opt);
              const isSelected = answers[currentQ.id] === optVal;
              const letters = ["A", "B", "C", "D", "E"];
              return (
                <button
                  key={idx}
                  onClick={() => setAnswers(prev => ({ ...prev, [currentQ.id]: optVal }))}
                  className={`w-full flex items-center gap-4 rounded-2xl border px-5 py-4 text-left text-sm transition-all active:scale-[0.99] ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                      : "border-border bg-background hover:border-primary/30 hover:bg-muted/30"
                  }`}
                >
                  <span className={`h-8 w-8 shrink-0 rounded-lg border text-xs font-bold grid place-items-center transition-colors ${
                    isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground"
                  }`}>
                    {letters[idx] || idx + 1}
                  </span>
                  <span className="font-medium leading-tight">{optLabel}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* MCQ options when stored as A/B/C/D strings */}
        {currentQ.question_type === "mcq" && currentQ.options.length === 0 && (
          <p className="text-sm text-muted-foreground italic">This question has no options configured. Please contact the administrator.</p>
        )}

        {/* Written / Hybrid */}
        {(currentQ.question_type === "written" || currentQ.question_type === "hybrid") && (
          <div className="space-y-2">
            <Textarea
              value={answers[currentQ.id] ?? ""}
              onChange={e => setAnswers(prev => ({ ...prev, [currentQ.id]: e.target.value }))}
              placeholder="Write your answer here..."
              className="min-h-[200px] rounded-2xl resize-y text-sm bg-muted/30 focus:bg-card"
            />
            <p className="text-xs text-muted-foreground text-right">
              {(answers[currentQ.id]?.trim().split(/\s+/).filter(Boolean).length ?? 0)} words
            </p>
          </div>
        )}
      </div>

      {/* Navigation + Submit */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
          disabled={isFirst}
          className="rounded-2xl font-bold gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>

        <div className="text-xs text-muted-foreground font-medium">
          {answeredCount} / {questions.length} answered
        </div>

        {isLast ? (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 min-w-[160px]"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              <><CheckCircle className="h-4 w-4" /> Submit Assessment</>
            )}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
            className="rounded-2xl font-bold gap-1"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Danger: submit early */}
      {phase === "exam" && !isLast && (
        <div className="text-center">
          <button
            onClick={() => {
              if (confirm(`Submit now? You have answered ${answeredCount} of ${questions.length} questions. Unanswered questions will be left blank.`)) {
                handleSubmit();
              }
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive"
          >
            Submit early
          </button>
        </div>
      )}
    </div>
  );
}
