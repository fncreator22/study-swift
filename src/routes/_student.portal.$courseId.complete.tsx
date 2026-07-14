import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star, Lock, CheckCircle2, ArrowRight, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_student/portal/$courseId/complete")({ component: CompletionGate });

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                star <= (hovered || value)
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300 dark:text-gray-600"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Course Feedback" },
    { num: 2, label: "Identity Confirmation" },
    { num: 3, label: "Declaration" },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 ${
                currentStep === s.num
                  ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900 scale-110"
                  : currentStep > s.num
                  ? "bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-400"
                  : "bg-white border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-600"
              }`}
            >
              {currentStep > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${currentStep === s.num ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-colors duration-300 ${currentStep > s.num ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function CompletionGate() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 � Feedback
  const [overallRating, setOverallRating] = useState(0);
  const [contentRating, setContentRating] = useState(0);
  const [instructorRating, setInstructorRating] = useState(0);
  const [platformRating, setPlatformRating] = useState(0);
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [openResponse, setOpenResponse] = useState("");

  // Step 2 � Identity
  const [profileName, setProfileName] = useState("");
  const [identityLocked, setIdentityLocked] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [dobInput, setDobInput] = useState("");

  // Step 3 � Declaration
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(false);
  const [checkbox3, setCheckbox3] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: enrollment } = await supabase
        .from("course_enrollments_v2")
        .select("id, progress_pct")
        .eq("course_id", courseId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!enrollment || (enrollment.progress_pct ?? 0) < 95) {
        navigate({ to: "/portal/$courseId", params: { courseId } });
        return;
      }
      setEnrollmentId(enrollment.id);

      const { data: feedback } = await supabase
        .from("course_feedback_v2")
        .select("id")
        .eq("enrollment_id", enrollment.id)
        .maybeSingle();
      const hasFeedback = !!feedback;

      const { data: declaration } = await supabase
        .from("pre_assessment_declarations_v2")
        .select("id")
        .eq("enrollment_id", enrollment.id)
        .maybeSingle();

      if (hasFeedback && !!declaration) {
        navigate({ to: "/portal/$courseId/assessment", params: { courseId } });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, date_of_birth")
        .eq("id", user.id)
        .maybeSingle();

      const locked = !!(profile?.full_name && profile?.date_of_birth);
      setIdentityLocked(locked);
      setProfileName(profile?.full_name ?? "");
      setNameInput(profile?.full_name ?? "");
      setDobInput(profile?.date_of_birth ?? "");

      if (hasFeedback) setStep(2);
      setLoading(false);
    })();
  }, [user, courseId]);

  async function submitFeedback() {
    if (!enrollmentId) return;
    if (!overallRating || !contentRating || !instructorRating || !platformRating) {
      toast.error("Please rate all four categories before continuing.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("course_feedback_v2").insert({
      enrollment_id: enrollmentId,
      satisfaction_score: overallRating,
      content_rating: contentRating,
      instructor_rating: instructorRating,
      usability_rating: platformRating,
      strengths: strengths || null,
      weaknesses: weaknesses || null,
      improvements: suggestions || null,
      open_response: openResponse || null,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success("Feedback submitted! Thank you.");
    setStep(2);
    setSubmitting(false);
  }

  async function confirmIdentity() {
    if (!user) return;
    const finalName = identityLocked ? profileName : nameInput.trim();
    const finalDob = identityLocked ? dobInput : dobInput.trim();
    if (!finalName || !finalDob) {
      toast.error("Please enter your full name and date of birth.");
      return;
    }
    setSubmitting(true);
    if (!identityLocked) {
      const { error } = await supabase.from("profiles").update({ full_name: finalName, date_of_birth: finalDob }).eq("id", user.id);
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      setIdentityLocked(true);
      setProfileName(finalName);
    }
    setStep(3);
    setSubmitting(false);
  }

  async function submitDeclaration() {
    if (!enrollmentId) return;
    if (!checkbox1 || !checkbox2 || !checkbox3) {
      toast.error("Please confirm all three checkboxes to proceed.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("pre_assessment_declarations_v2").insert({
      enrollment_id: enrollmentId,
      ip_address: "web",
      browser_agent: navigator.userAgent,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success("Declaration recorded. Proceeding to assessment...");
    navigate({ to: "/portal/$courseId/assessment", params: { courseId } });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
          <p className="text-sm text-gray-500 font-medium animate-pulse">Preparing your completion gate...</p>
        </div>
      </div>
    );
  }

  const lockedName = identityLocked ? profileName : nameInput.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full mb-4 tracking-wide uppercase">
            <CheckCircle2 className="h-3.5 w-3.5" /> Course Completion Gate
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Almost There!</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">Complete these steps to unlock your assessment and earn your certificate.</p>
        </div>

        <StepIndicator currentStep={step} />

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 p-6 sm:p-8">

          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Course Feedback</h2>
                <p className="text-sm text-gray-500 mt-1">Your honest feedback helps us improve. All fields marked with * are required.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30">
                <StarRating value={overallRating} onChange={setOverallRating} label="Overall Satisfaction *" />
                <StarRating value={contentRating} onChange={setContentRating} label="Content Quality *" />
                <StarRating value={instructorRating} onChange={setInstructorRating} label="Instructor Rating *" />
                <StarRating value={platformRating} onChange={setPlatformRating} label="Platform Usability *" />
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">What did you enjoy most? (Strengths)</Label>
                  <Textarea className="mt-1.5 resize-none" rows={3} placeholder="Share what worked well for you..." value={strengths} onChange={(e) => setStrengths(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Areas for improvement (Weaknesses)</Label>
                  <Textarea className="mt-1.5 resize-none" rows={3} placeholder="What could be better?" value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Suggestions for improvement</Label>
                  <Textarea className="mt-1.5 resize-none" rows={3} placeholder="Any specific suggestions?" value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Any other thoughts?</Label>
                  <Textarea className="mt-1.5 resize-none" rows={3} placeholder="Open response..." value={openResponse} onChange={(e) => setOpenResponse(e.target.value)} />
                </div>
              </div>
              <Button onClick={submitFeedback} disabled={submitting} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-11 rounded-xl">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Feedback & Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Identity Confirmation</h2>
                <p className="text-sm text-gray-500 mt-1">Confirm your official credentials for your certificate.</p>
              </div>
              <div className="rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                  Warning: The name and date of birth you provide will be permanently printed on your certificate and <strong>cannot be changed after submission.</strong>
                </p>
              </div>
              {identityLocked && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3">
                  <Lock className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Your credentials are locked for certification.</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Full Name (as on official ID)
                    {identityLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                  </Label>
                  <Input className="mt-1.5" placeholder="Your official full name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} disabled={identityLocked} />
                </div>
                <div>
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    Date of Birth
                    {identityLocked && <Lock className="h-3.5 w-3.5 text-gray-400" />}
                  </Label>
                  <Input className="mt-1.5" type="date" value={dobInput} onChange={(e) => setDobInput(e.target.value)} disabled={identityLocked} />
                </div>
              </div>
              <Button onClick={confirmIdentity} disabled={submitting} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-11 rounded-xl">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm & Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-3">
                  <ShieldCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Academic Integrity Declaration</h2>
                <p className="text-sm text-gray-500 mt-1">Please read carefully and confirm below.</p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-line">{`I, ${lockedName || "[Your Name]"}, hereby declare that:\n\n1. The work I am about to submit is entirely my own and has not been copied from any other source.\n2. I have completed this course in its entirety and understand all the material covered.\n3. I understand that providing false information may result in certificate invalidation or account suspension.\n4. I authorize Examly LMS to issue a certificate bearing my name and credentials as provided.`}</p>
              </div>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={checkbox1} onChange={(e) => setCheckbox1(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    I confirm my name and date of birth are authentic and accurate.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={checkbox2} onChange={(e) => setCheckbox2(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    I accept the certification terms and conditions and the academic integrity policy.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={checkbox3} onChange={(e) => setCheckbox3(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    I agree to follow the exam instructions, will not cheat or use unauthorized aids, and understand that violation is punishable under academic policy.
                  </span>
                </label>
              </div>
              <Button
                onClick={submitDeclaration}
                disabled={submitting || !checkbox1 || !checkbox2 || !checkbox3}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold h-12 rounded-xl text-base shadow-lg shadow-emerald-200 dark:shadow-emerald-900 transition-all"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Start the Test →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
