import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { TokenRequestModal } from "@/components/TokenRequestModal";
import { toast } from "sonner";
import {
  ArrowLeft,
  Star,
  Users,
  Clock,
  Globe,
  Award,
  Lock,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  FileText,
  GraduationCap,
  CheckCircle,
  Loader2,
  BookOpen,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/_student/courses/$courseId")({
  component: CourseDetail,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  overview: string | null;
  outcomes: string[] | null;
  skills_learned: string[] | null;
  instructor_name: string | null;
  instructor_bio: string | null;
  university_partner: string | null;
  duration_hours: number | null;
  difficulty_level: string | null;
  language: string | null;
  pricing_tokens: number | null;
  tier: string | null;
  completion_test_id: string | null;
  faqs: { question: string; answer: string }[] | null;
  enrollment_count: number | null;
  avg_rating: number | null;
  thumbnail_url: string | null;
  created_at: string;
  last_updated: string | null;
};

type Module = {
  id: string;
  title: string;
  order_index: number;
  lessons: Lesson[];
};

type Lesson = {
  id: string;
  title: string;
  content_type: string | null;
  order_index: number;
};

type Review = {
  id: string;
  full_name: string | null;
  satisfaction_score: number | null;
  content_rating: number | null;
  open_response: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function LessonIcon({ type }: { type: string | null }) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("video")) return <PlayCircle className="h-4 w-4 text-blue-500" />;
  if (t.includes("text") || t.includes("article")) return <FileText className="h-4 w-4 text-emerald-500" />;
  return <BookOpen className="h-4 w-4 text-amber-500" />;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function ratingLabel(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <Skeleton className="h-5 w-32 rounded-full" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-4">
          <Skeleton className="h-8 w-3/4 rounded-xl" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-10 w-48 rounded-2xl mt-4" />
          <div className="grid grid-cols-5 gap-1 mt-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-3xl mt-4" />
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-[500px] w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Star Rating Bar ──────────────────────────────────────────────────────────

function RatingBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-6 text-right font-semibold text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-muted-foreground">{pct}%</span>
    </div>
  );
}

// ─── Demo Certificate ─────────────────────────────────────────────────────────

function DemoCertificate({ courseTitle }: { courseTitle: string }) {
  return (
    <div className="relative rounded-2xl border-2 border-double border-amber-200/60 bg-gradient-to-br from-[#faf8f2] to-[#f5f0e8] p-5 text-center overflow-hidden shadow-inner">
      {/* Watermark */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        aria-hidden
      >
        <span
          className="font-black uppercase text-slate-300/40 rotate-[-30deg] whitespace-nowrap"
          style={{ fontSize: "clamp(18px, 3vw, 32px)", letterSpacing: "0.25em" }}
        >
          DEMO
        </span>
      </div>

      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-[7px] font-black text-[#1e3a8a] tracking-widest uppercase">
          EXAMLY ACADEMY
        </span>
        <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
          DEMO PREVIEW
        </span>
      </div>

      {/* Title */}
      <div className="space-y-1 mb-3">
        <p className="font-serif text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Certificate of Completion
        </p>
        <div className="w-10 h-px bg-amber-400/60 mx-auto" />
      </div>

      {/* Recipient */}
      <p className="text-[6px] text-slate-400 italic mb-0.5">presented to</p>
      <p className="font-serif text-[13px] font-bold text-[#1e3a8a] mb-3">
        John Student
      </p>

      {/* Course */}
      <p className="text-[5.5px] text-slate-400 leading-none mb-1">
        for successfully completing
      </p>
      <p className="font-bold text-[8px] text-[#1e3a8a] leading-snug line-clamp-2 mx-auto max-w-[160px]">
        {courseTitle}
      </p>

      {/* Footer */}
      <div className="flex items-end justify-between mt-4 pt-3 border-t border-amber-200/50">
        <div className="text-left">
          <div className="w-10 h-px bg-slate-300 mb-0.5" />
          <p className="text-[5px] text-slate-400">Programme Director</p>
        </div>
        <div className="h-6 w-6 rounded-full border border-amber-300 bg-white flex items-center justify-center">
          <Award className="h-3 w-3 text-amber-400" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function CourseDetail() {
  const { courseId } = Route.useParams();
  const { user, tokens, refreshProfile } = useAuth();
  const nav = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState("about");

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user, courseId]);

  async function loadAll() {
    setLoading(true);
    try {
      await Promise.all([loadCourse(), loadCurriculum(), loadReviews(), checkEnrollment()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCourse() {
    const { data } = await supabase
      .from("courses_v2")
      .select(
        "id, title, subtitle, description, overview, outcomes, skills_learned, instructor_name, instructor_bio, university_partner, duration_hours, difficulty_level, language, pricing_tokens, tier, completion_test_id, faqs, enrollment_count, avg_rating, thumbnail_url, created_at, last_updated"
      )
      .eq("id", courseId)
      .maybeSingle();
    if (data) setCourse(data as unknown as Course);
  }

  async function loadCurriculum() {
    const { data: mods } = await supabase
      .from("course_modules_v2")
      .select("id, title, order_index")
      .eq("course_id", courseId)
      .order("order_index");

    if (!mods || mods.length === 0) {
      setModules([]);
      return;
    }

    const modIds = mods.map((m: any) => m.id);
    const { data: lessons } = await supabase
      .from("course_lessons_v2")
      .select("id, title, content_type, order_index, module_id")
      .in("module_id", modIds)
      .order("order_index");

    const lessonMap: Record<string, Lesson[]> = {};
    for (const l of lessons ?? []) {
      const mid = (l as any).module_id;
      if (!lessonMap[mid]) lessonMap[mid] = [];
      lessonMap[mid].push(l as Lesson);
    }

    const shaped = mods.map((m: any) => ({
      id: m.id,
      title: m.title,
      order_index: m.order_index,
      lessons: lessonMap[m.id] ?? [],
    }));
    setModules(shaped);

    // Auto-expand first module
    if (mods.length > 0) setExpandedModules(new Set([mods[0].id]));
  }

  async function loadReviews() {
    const { data } = await supabase
      .from("course_feedback_v2")
      .select(
        "id, satisfaction_score, content_rating, open_response, created_at, course_enrollments_v2!inner(course_id, profiles(full_name))"
      )
      .eq("course_enrollments_v2.course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data) return;

    const shaped: Review[] = (data as any[]).map((r) => ({
      id: r.id,
      full_name: r.course_enrollments_v2?.profiles?.full_name ?? null,
      satisfaction_score: r.satisfaction_score,
      content_rating: r.content_rating,
      open_response: r.open_response,
      created_at: r.created_at,
    }));
    setReviews(shaped);
  }

  async function checkEnrollment() {
    if (!user) return;
    const { data } = await supabase
      .from("course_enrollments_v2")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();
    setIsEnrolled(!!data);
  }

  // ── Enrollment via RPC only ────────────────────────────────────────────────

  async function handleEnrollOrContinue() {
    if (!user || !course) return;

    if (isEnrolled) {
      nav({ to: `/portal/${courseId}` });
      return;
    }

    setEnrolling(true);
    try {
      const { data, error } = await supabase.rpc("enroll_in_course_v3" as any, {
        _course_id: courseId,
      });

      if (error) {
        toast.error(error.message || "Enrollment failed. Please try again.");
        if (
          error.message?.toLowerCase().includes("insufficient tokens") ||
          error.message?.toLowerCase().includes("token")
        ) {
          setTokenModalOpen(true);
        }
        return;
      }

      const result = data as any;
      const status =
        typeof result === "object" && result !== null ? result.status : String(result ?? "");

      if (status === "already_enrolled") {
        setIsEnrolled(true);
        nav({ to: `/portal/${courseId}` });
        return;
      }

      await refreshProfile();
      toast.success("Successfully enrolled! Welcome to the course. 🎉");
      setIsEnrolled(true);
      nav({ to: `/portal/${courseId}` });
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setEnrolling(false);
    }
  }

  // ── Accordion toggles ──────────────────────────────────────────────────────

  function toggleModule(id: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFaq(i: number) {
    setExpandedFaqs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);
  const isFree =
    !course?.tier || course.tier === "free" || (course?.pricing_tokens ?? 0) === 0;
  const priceTokens = course?.pricing_tokens ?? 0;
  const avgRating = course?.avg_rating ?? 4.8;
  const enrollCount = course?.enrollment_count ?? 0;

  const enrollButtonLabel = enrolling
    ? undefined
    : isEnrolled
    ? "Continue Learning →"
    : isFree
    ? "Enroll for Free"
    : `Enroll · ${priceTokens} Tokens`;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />;

  if (!course) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center text-center p-8">
        <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-4">
          <Shield className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-bold">Course Not Found</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          The course you're looking for doesn't exist or has been archived.
        </p>
        <Link to="/courses" className="mt-6">
          <Button variant="outline" className="rounded-xl gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-16">
      {/* ── Back Link ── */}
      <div className="py-4">
        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
      </div>

      {/* ── Hero Banner ── */}
      <div className="relative w-full rounded-3xl overflow-hidden min-h-[280px] md:min-h-[340px] flex items-end mb-8">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#3730a3]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        <div className="relative z-10 p-6 md:p-10 w-full">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {course.difficulty_level && (
              <span className="rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 backdrop-blur-sm">
                {course.difficulty_level}
              </span>
            )}
            {course.language && (
              <span className="rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 backdrop-blur-sm flex items-center gap-1">
                <Globe className="h-2.5 w-2.5" /> {course.language}
              </span>
            )}
            {course.university_partner && (
              <span className="rounded-full bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] text-[10px] font-black uppercase tracking-widest px-3 py-1 backdrop-blur-sm flex items-center gap-1">
                <GraduationCap className="h-2.5 w-2.5" /> {course.university_partner}
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl md:text-4xl font-black text-white leading-tight max-w-3xl">
            {course.title}
          </h1>
          {course.subtitle && (
            <p className="mt-2 text-sm md:text-base text-white/80 italic max-w-2xl">
              {course.subtitle}
            </p>
          )}

          {/* Stats row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-white/80 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <StarRow rating={avgRating} />
              <span className="text-amber-400 font-bold">{avgRating.toFixed(1)}</span>
              {enrollCount > 0 && (
                <span className="text-white/60">({ratingLabel(enrollCount)} reviews)</span>
              )}
            </span>
            {enrollCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {ratingLabel(enrollCount)} enrolled
              </span>
            )}
            {course.duration_hours != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {course.duration_hours} hrs
              </span>
            )}
            {course.last_updated && (
              <span className="text-white/60">
                Last updated: {formatDate(course.last_updated)}
              </span>
            )}
          </div>

          {/* Hero CTA */}
          <div className="mt-5">
            <Button
              onClick={handleEnrollOrContinue}
              disabled={enrolling}
              className="h-11 px-8 rounded-2xl font-bold text-sm bg-[#d4af37] hover:bg-[#c9a227] text-slate-900 shadow-lg shadow-[#d4af37]/30 transition-all hover:scale-105"
            >
              {enrolling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                enrollButtonLabel
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-8 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-5 rounded-2xl bg-muted/50 p-1 h-auto mb-6">
              {(["about", "curriculum", "instructor", "reviews", "faq"] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="rounded-xl text-xs font-bold uppercase tracking-wider py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-[#1e3a8a] capitalize"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ═══ ABOUT TAB ════════════════════════════════════════════════ */}
            <TabsContent value="about" className="space-y-6 focus-visible:outline-none">
              {/* Skills Chips */}
              {course.skills_learned && course.skills_learned.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <Star className="h-4 w-4 text-[#d4af37]" /> Skills You'll Gain
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {course.skills_learned.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-xs font-semibold"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* What You'll Learn */}
              {course.outcomes && course.outcomes.length > 0 && (
                <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
                  <h2 className="font-display text-lg font-bold">What You'll Learn</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {course.outcomes.map((out, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-normal">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{out}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {course.description && (
                <div className="space-y-3">
                  <h2 className="font-display text-lg font-bold">Course Description</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {course.description}
                  </p>
                </div>
              )}

              {/* Overview */}
              {course.overview && (
                <div className="space-y-3">
                  <h2 className="font-display text-lg font-bold">Program Overview</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {course.overview}
                  </p>
                </div>
              )}

              {/* University Partner */}
              {course.university_partner && (
                <div className="flex items-center gap-4 rounded-2xl border border-[#d4af37]/30 bg-[#d4af37]/5 p-5">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-[#d4af37]/20 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-[#d4af37]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Academic Partner
                    </p>
                    <p className="font-bold text-base mt-0.5">{course.university_partner}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This course is offered in partnership with {course.university_partner}.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ═══ CURRICULUM TAB ══════════════════════════════════════════ */}
            <TabsContent value="curriculum" className="space-y-4 focus-visible:outline-none">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="font-semibold">{modules.length} modules</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="font-semibold">{totalLessons} lessons</span>
                {course.duration_hours != null && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span className="font-semibold flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {course.duration_hours} total hours
                    </span>
                  </>
                )}
              </div>

              {modules.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground italic text-sm">
                  Curriculum is being prepared. Check back soon.
                </div>
              ) : (
                <div className="space-y-2">
                  {modules.map((mod) => {
                    const open = expandedModules.has(mod.id);
                    return (
                      <div
                        key={mod.id}
                        className="rounded-2xl border border-border bg-card overflow-hidden"
                      >
                        <button
                          onClick={() => toggleModule(mod.id)}
                          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">
                              {mod.order_index + 1}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{mod.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {mod.lessons.length} {mod.lessons.length === 1 ? "lesson" : "lessons"}
                              </p>
                            </div>
                          </div>
                          {open ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </button>

                        {open && mod.lessons.length > 0 && (
                          <div className="border-t border-border divide-y divide-border/50">
                            {mod.lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between px-5 py-3 bg-muted/20 opacity-80 cursor-not-allowed"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <LessonIcon type={lesson.content_type} />
                                  <span className="text-sm font-medium text-foreground/80 truncate">
                                    {lesson.title}
                                  </span>
                                  {lesson.content_type && (
                                    <span className="hidden sm:inline shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                      {lesson.content_type}
                                    </span>
                                  )}
                                </div>
                                <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 ml-3" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ═══ INSTRUCTOR TAB ══════════════════════════════════════════ */}
            <TabsContent value="instructor" className="space-y-6 focus-visible:outline-none">
              <div className="rounded-3xl border border-border bg-card p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#1e3a8a] to-[#3730a3] flex items-center justify-center text-white font-display text-2xl font-black select-none shrink-0">
                    {(course.instructor_name ?? "E").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold">
                      {course.instructor_name ?? "Expert Educator"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5" /> Course Instructor
                      {course.university_partner && (
                        <>
                          {" · "}
                          <span className="text-[#d4af37] font-semibold">{course.university_partner}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="h-px w-full bg-border" />

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {course.instructor_bio ??
                    "An experienced educator and subject-matter expert dedicated to delivering high-quality, practical learning experiences. Focused on bridging theory with real-world application to help students succeed in their careers."}
                </p>

                <div className="grid grid-cols-3 gap-4 pt-2">
                  {[
                    { label: "Avg Rating", value: `${avgRating.toFixed(1)} ★` },
                    { label: "Students", value: ratingLabel(enrollCount) },
                    { label: "Courses", value: "1+" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-muted/40 p-3 text-center">
                      <p className="font-bold text-sm">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ═══ REVIEWS TAB ══════════════════════════════════════════════ */}
            <TabsContent value="reviews" className="space-y-6 focus-visible:outline-none">
              <div className="rounded-3xl border border-border bg-card p-6 flex gap-8 flex-wrap">
                <div className="text-center shrink-0">
                  <p className="font-display text-5xl font-black text-[#1e3a8a]">
                    {avgRating.toFixed(1)}
                  </p>
                  <StarRow rating={avgRating} />
                  <p className="text-xs text-muted-foreground mt-1">Course Rating</p>
                </div>
                <div className="flex-1 min-w-[140px] space-y-2 justify-center flex flex-col">
                  <RatingBar label="5" pct={72} />
                  <RatingBar label="4" pct={18} />
                  <RatingBar label="3" pct={7} />
                  <RatingBar label="2" pct={2} />
                  <RatingBar label="1" pct={1} />
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground italic text-sm">
                  No reviews yet. Be the first to complete and review this course!
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => {
                    const score = r.content_rating ?? r.satisfaction_score ?? 5;
                    return (
                      <div key={r.id} className="rounded-2xl border border-border bg-card p-5 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                              {(r.full_name ?? "S").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">
                                {r.full_name ?? "Anonymous Student"}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDate(r.created_at)}
                              </p>
                            </div>
                          </div>
                          <StarRow rating={score} />
                        </div>
                        {r.open_response && (
                          <p className="text-sm text-muted-foreground leading-relaxed pl-12">
                            {r.open_response}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ═══ FAQ TAB ══════════════════════════════════════════════════ */}
            <TabsContent value="faq" className="space-y-3 focus-visible:outline-none">
              {!course.faqs || course.faqs.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-12 text-center text-muted-foreground italic text-sm">
                  No FAQs have been added for this course yet. Contact support for questions.
                </div>
              ) : (
                course.faqs.map((faq, i) => {
                  const open = expandedFaqs.has(i);
                  return (
                    <div
                      key={i}
                      className="rounded-2xl border border-border bg-card overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFaq(i)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className="font-semibold text-sm pr-4">{faq.question}</span>
                        {open ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                      {open && (
                        <div className="border-t border-border px-5 py-4 bg-muted/10">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ── RIGHT STICKY PANEL ── */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className="rounded-3xl border border-border bg-card shadow-lg overflow-hidden">
              {/* Thumbnail */}
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full aspect-video object-cover"
                />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#3730a3] flex items-center justify-center">
                  <BookOpen className="h-16 w-16 text-white/20" />
                </div>
              )}

              <div className="p-5 space-y-5">
                {/* Price */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                    Enrollment Cost
                  </p>
                  {isFree ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-emerald-500">FREE</span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px]">
                        Open Access
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl font-black">{priceTokens}</span>
                      <span className="text-sm font-semibold text-muted-foreground">Tokens</span>
                      {course.tier && course.tier !== "free" && (
                        <Badge className="text-[9px] capitalize bg-[#1e3a8a]/10 text-[#1e3a8a] border-[#1e3a8a]/20">
                          {course.tier}
                        </Badge>
                      )}
                    </div>
                  )}
                  {!isFree && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Your balance:{" "}
                      <span className="font-bold text-foreground">{tokens} tokens</span>
                    </p>
                  )}
                </div>

                {/* CTA Button */}
                <Button
                  onClick={handleEnrollOrContinue}
                  disabled={enrolling}
                  className={`w-full h-12 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] ${
                    isEnrolled
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-[#1e3a8a] hover:bg-[#1e40af] text-white"
                  }`}
                >
                  {enrolling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    enrollButtonLabel
                  )}
                </Button>

                {/* Course Stats */}
                <div className="border-t border-border pt-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Course Info
                  </p>
                  {[
                    {
                      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
                      label: "Duration",
                      value: course.duration_hours
                        ? `${course.duration_hours} hours`
                        : "Self-paced",
                    },
                    {
                      icon: <BookOpen className="h-4 w-4 text-muted-foreground" />,
                      label: "Difficulty",
                      value: course.difficulty_level ?? "All Levels",
                    },
                    {
                      icon: <Globe className="h-4 w-4 text-muted-foreground" />,
                      label: "Language",
                      value: course.language ?? "English",
                    },
                    {
                      icon: <Award className="h-4 w-4 text-muted-foreground" />,
                      label: "Certificate",
                      value: course.completion_test_id
                        ? "Yes, upon completion"
                        : "Completion award",
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-3">
                      <div className="shrink-0">{stat.icon}</div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                        <p className="text-xs font-semibold">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Demo Certificate */}
                <div className="border-t border-border pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Certificate Preview
                  </p>
                  <DemoCertificate courseTitle={course.title} />
                  <p className="text-[9px] text-muted-foreground text-center mt-2 italic">
                    Sample only · Not downloadable
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Request Modal */}
      <TokenRequestModal open={tokenModalOpen} onOpenChange={setTokenModalOpen} />
    </div>
  );
}
