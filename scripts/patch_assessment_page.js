import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.portal.$courseId.assessment.tsx");

let content = readFileSync(filePath, "utf-8");

// Add imports
content = content.replace(
  'import {\n  Clock, CheckCircle, ArrowLeft, ArrowRight, Trophy,\n  AlertCircle, Loader2, BookOpen, Shield, FileText, CheckCircle2\n} from "lucide-react";',
  'import {\n  Clock, CheckCircle, ArrowLeft, ArrowRight, Trophy,\n  AlertCircle, Loader2, BookOpen, Shield, FileText, CheckCircle2, XCircle\n} from "lucide-react";'
);

// Add lastAttemptInfo state
content = content.replace(
  '  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);',
  '  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);\n  const [lastAttemptInfo, setLastAttemptInfo] = useState<any>(null);\n  const [reviewFeedback, setReviewFeedback] = useState<string>("");'
);

// Replace the check-approved check with latest attempt check
const oldCheckApproved = `      // Check if already approved
      const { data: existingAttempt } = await supabase
        .from("course_assessment_attempts_v2")
        .select("id, status, score")
        .eq("enrollment_id", enrollment.id)
        .eq("status", "approved")
        .maybeSingle();

      if (existingAttempt) {
        setPhase("already_approved");
        setLoading(false);
        return;
      }`;

const newCheckApproved = `      // Check latest attempt status
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
      }`;

content = content.replace(oldCheckApproved, newCheckApproved);

// Insert failure feedback display inside phase === "pre" card
const targetInsertSpot = `          {/* Instructions */}
          <div className="rounded-2xl bg-amber-50 border-amber-200`;

const replacementWithFeedback = `          {/* Previous Attempt Failure / Resubmit Feedback */}
          {lastAttemptInfo && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 p-5 space-y-3 text-left">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                <XCircle className="h-4 w-4" /> Previous Attempt: {lastAttemptInfo.status === 'resubmit' ? 'Resubmission Requested' : 'Failed'}
              </div>
              <p className="text-sm">
                Your last score was <b className="font-mono text-red-700 dark:text-red-400">{lastAttemptInfo.score}%</b>. Passing threshold is <b>{assessment?.passing_score}%</b>.
              </p>
              {reviewFeedback && (
                <div className="text-xs text-red-700 dark:text-red-400 bg-red-100/50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-900/20 whitespace-pre-line font-mono">
                  <b>Constructive Feedback:</b>\n{reviewFeedback}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="rounded-2xl bg-amber-50 border-amber-200`;

content = content.replace(targetInsertSpot, replacementWithFeedback);

// Force reload on submit to trigger the state check
content = content.replace(
  '      setPhase("submitted");',
  '      setPhase("submitted");\n      load();'
);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched assessment page with retry/feedback logic!");
