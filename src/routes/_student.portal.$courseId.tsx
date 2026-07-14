import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  FileText,
  MessageSquare,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  ArrowLeft,
  Trophy,
  Clock,
  Plus,
  FileArchive,
  File,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_student/portal/$courseId")({
  component: LearningPortal,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  title: string;
};

type Module = {
  id: string;
  title: string;
  order_index: number;
  lessons: Lesson[];
  expanded: boolean;
};

type Lesson = {
  id: string;
  title: string;
  video_url: string | null;
  text_content: string | null;
  content_type: string | null;
  order_index: number;
  module_id: string;
};

type Enrollment = {
  id: string;
  progress_percent: number;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  user_name: string;
};

type Resource = {
  id: string;
  title: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEmbed(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/shorts/"))
      return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v"))
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be")
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("vimeo.com"))
      return `https://player.vimeo.com/video/${u.pathname.slice(1)}`;
    return url;
  } catch {
    return url;
  }
}

function isEmbeddable(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("youtube.com") ||
      u.hostname === "youtu.be" ||
      u.hostname.includes("vimeo.com")
    );
  } catch {
    return false;
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function lessonTypeIcon(lesson: Lesson) {
  if (lesson.video_url) return <PlayCircle className="h-3.5 w-3.5 shrink-0" />;
  if (lesson.text_content) return <FileText className="h-3.5 w-3.5 shrink-0" />;
  return <File className="h-3.5 w-3.5 shrink-0" />;
}

function resourceIcon(fileType: string | null) {
  const t = (fileType ?? "").toLowerCase();
  if (t.includes("pdf")) return <FileText className="h-5 w-5 text-red-400" />;
  if (t.includes("zip") || t.includes("rar"))
    return <FileArchive className="h-5 w-5 text-yellow-400" />;
  return <File className="h-5 w-5 text-blue-400" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

function LearningPortal() {
  const { courseId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core data
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [resources, setResources] = useState<Resource[]>([]);

  // Active lesson state
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  // Notes
  const [noteText, setNoteText] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const noteSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Discussion
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Progress
  const [progressPercent, setProgressPercent] = useState(0);
  const syncingRef = useRef(false);

  // UI
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"materials" | "notes" | "discussion">(
    "materials"
  );

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    loadPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, courseId]);

  async function loadPortal() {
    setLoading(true);

    // 1. Enrollment check
    const { data: enr } = await supabase
      .from("course_enrollments_v2")
      .select("id, progress_percent")
      .eq("user_id", user!.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!enr) {
      toast.error("You are not enrolled in this course.");
      navigate({ to: `/courses/${courseId}` });
      return;
    }
    setEnrollment(enr as Enrollment);
    setProgressPercent(enr.progress_percent ?? 0);

    // 2. Course info
    const { data: c } = await supabase
      .from("courses_v2")
      .select("id, title")
      .eq("id", courseId)
      .maybeSingle();
    if (c) setCourse(c as Course);

    // 3. Modules
    const { data: mods } = await supabase
      .from("course_modules_v2")
      .select("id, title, order_index")
      .eq("course_id", courseId)
      .order("order_index");

    // 4. Lessons
    const modIds = (mods ?? []).map((m: any) => m.id);
    const { data: lessons } = modIds.length
      ? await supabase
          .from("course_lessons_v2")
          .select("id, title, video_url, text_content, content_type, order_index, module_id")
          .in("module_id", modIds)
          .order("order_index")
      : { data: [] };

    // 5. Progress
    const { data: prog } = await supabase
      .from("course_progress_v2")
      .select("lesson_id")
      .eq("enrollment_id", enr.id);
    const completed = new Set<string>((prog ?? []).map((p: any) => p.lesson_id));
    setCompletedLessons(completed);

    // 6. Assemble module tree — all modules start expanded
    const lessonList: Lesson[] = (lessons ?? []) as Lesson[];
    const moduleTree: Module[] = (mods ?? []).map((m: any) => ({
      id: m.id,
      title: m.title,
      order_index: m.order_index,
      lessons: lessonList.filter((l) => l.module_id === m.id),
      expanded: true,
    }));
    setModules(moduleTree);

    // Auto-select first lesson
    const firstLesson = lessonList[0] ?? null;
    if (firstLesson) {
      setActiveLesson(firstLesson);
      loadNote(enr.id, firstLesson.id);
      loadComments(firstLesson.id);
    }

    // 7. Resources
    const { data: res } = await supabase
      .from("learning_resources_v2")
      .select("id, title, file_url, file_type, file_size_bytes")
      .eq("course_id", courseId)
      .order("title");
    setResources((res ?? []) as Resource[]);

    setLoading(false);
  }

  // ── Note loading / saving ─────────────────────────────────────────────────

  async function loadNote(enrollmentId: string, lessonId: string) {
    const { data } = await supabase
      .from("personal_notes_v2")
      .select("note_text")
      .eq("enrollment_id", enrollmentId)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    setNoteText(data?.note_text ?? "");
    setLastSaved(null);
  }

  const saveNote = useCallback(
    async (lessonId: string, text: string) => {
      if (!enrollment) return;
      const { error } = await supabase.from("personal_notes_v2").upsert(
        {
          enrollment_id: enrollment.id,
          lesson_id: lessonId,
          note_text: text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "enrollment_id,lesson_id" }
      );
      if (!error) setLastSaved(new Date());
    },
    [enrollment]
  );

  function handleNoteChange(text: string) {
    setNoteText(text);
    if (noteSaveRef.current) clearTimeout(noteSaveRef.current);
    if (!activeLesson) return;
    noteSaveRef.current = setTimeout(() => {
      saveNote(activeLesson.id, text);
    }, 1500);
  }

  function handleNoteBlur() {
    if (noteSaveRef.current) clearTimeout(noteSaveRef.current);
    if (activeLesson) saveNote(activeLesson.id, noteText);
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  async function loadComments(lessonId: string) {
    const { data: cs } = await supabase
      .from("lesson_comments_v2")
      .select("id, body, created_at, user_id")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false });

    if (!cs?.length) {
      setComments([]);
      return;
    }

    const uIds = Array.from(new Set(cs.map((c: any) => c.user_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uIds);
    const nameMap: Record<string, string> = {};
    (profs ?? []).forEach((p: any) => {
      nameMap[p.id] = p.full_name || "Student";
    });

    setComments(
      cs.map((c: any) => ({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        user_id: c.user_id,
        user_name: nameMap[c.user_id] ?? "Student",
      }))
    );
  }

  async function postComment() {
    if (!commentText.trim() || !activeLesson || !user) return;
    setPostingComment(true);
    const { error } = await supabase.from("lesson_comments_v2").insert({
      lesson_id: activeLesson.id,
      user_id: user.id,
      body: commentText.trim(),
    });
    setPostingComment(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCommentText("");
    loadComments(activeLesson.id);
  }

  // ── Progress toggle ───────────────────────────────────────────────────────

  async function toggleProgress(lessonId: string) {
    if (!enrollment || syncingRef.current) return;
    syncingRef.current = true;

    const isComplete = completedLessons.has(lessonId);
    let nextSet: Set<string>;

    if (isComplete) {
      const { error } = await supabase
        .from("course_progress_v2")
        .delete()
        .eq("enrollment_id", enrollment.id)
        .eq("lesson_id", lessonId);
      if (error) {
        toast.error(error.message);
        syncingRef.current = false;
        return;
      }
      nextSet = new Set(completedLessons);
      nextSet.delete(lessonId);
    } else {
      const { error } = await supabase
        .from("course_progress_v2")
        .insert({ enrollment_id: enrollment.id, lesson_id: lessonId });
      if (error) {
        toast.error(error.message);
        syncingRef.current = false;
        return;
      }
      nextSet = new Set(completedLessons);
      nextSet.add(lessonId);
    }

    setCompletedLessons(nextSet);

    // Refresh progress_percent from DB
    const { data: fresh } = await supabase
      .from("course_enrollments_v2")
      .select("progress_percent")
      .eq("id", enrollment.id)
      .maybeSingle();
    if (fresh) setProgressPercent(fresh.progress_percent ?? 0);

    syncingRef.current = false;
  }

  // ── Lesson switch ─────────────────────────────────────────────────────────

  function selectLesson(lesson: Lesson) {
    if (lesson.id === activeLesson?.id) return;
    setActiveLesson(lesson);
    setNoteText("");
    setLastSaved(null);
    setComments([]);
    if (enrollment) {
      loadNote(enrollment.id, lesson.id);
      loadComments(lesson.id);
    }
    setActiveTab("materials");
  }

  // ── Toggle module expand ──────────────────────────────────────────────────

  function toggleModule(moduleId: string) {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, expanded: !m.expanded } : m))
    );
  }

  // ── All lessons flat list ─────────────────────────────────────────────────

  const allLessons = modules.flatMap((m) => m.lessons);
  const totalLessons = allLessons.length;

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground font-medium">Loading course…</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Course not found.</p>
        <Link to="/courses" className="mt-4 inline-block text-primary font-bold">
          Back to courses
        </Link>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background overflow-hidden">
      {/* ── Top bar ── */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-2.5 flex items-center gap-4 flex-wrap">
        <Link
          to="/courses"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Courses
        </Link>
        <span className="text-muted-foreground/40 text-xs hidden sm:block">›</span>
        <span className="text-xs font-semibold text-foreground truncate max-w-[200px] hidden sm:block">
          {course.title}
        </span>

        <div className="flex items-center gap-3 ml-auto">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
              {progressPercent}% Complete
            </span>
          </div>

          {progressPercent >= 95 && (
            <Link to={`/portal/${courseId}/complete`}>
              <Button
                size="sm"
                className="h-7 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5"
              >
                <Trophy className="h-3.5 w-3.5" />
                Complete Course
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── 95%+ Completion Banner ── */}
      {progressPercent >= 95 && (
        <div className="shrink-0 bg-emerald-600 text-white px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm">🎉 Course Complete!</p>
            <p className="text-xs opacity-90">
              Ready to get certified? Complete your feedback and take the final assessment.
            </p>
          </div>
          <Link to={`/portal/${courseId}/complete`}>
            <Button className="bg-white text-emerald-700 hover:bg-white/90 font-bold text-xs h-8 px-3 rounded-xl shrink-0">
              Get Certified →
            </Button>
          </Link>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ════ LEFT SIDEBAR ════ */}
        <aside className="w-[280px] shrink-0 flex flex-col bg-gray-950 border-r border-white/5 overflow-hidden">
          {/* Sidebar header */}
          <div className="shrink-0 px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Course Modules
            </h2>
            <span className="text-[10px] font-medium text-slate-500">
              {completedLessons.size}/{totalLessons}
            </span>
          </div>

          {/* Scrollable lesson tree */}
          <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
            {modules.length === 0 && (
              <p className="px-4 py-6 text-xs text-slate-500 text-center">
                No lessons available yet.
              </p>
            )}

            {modules.map((mod) => (
              <div key={mod.id}>
                {/* Module header */}
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors group"
                >
                  {mod.expanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  )}
                  <span className="text-xs font-bold text-slate-300 truncate flex-1 leading-tight">
                    {mod.title}
                  </span>
                  <span className="text-[9px] text-slate-600 shrink-0">
                    {mod.lessons.filter((l) => completedLessons.has(l.id)).length}/
                    {mod.lessons.length}
                  </span>
                </button>

                {/* Lesson list */}
                {mod.expanded && (
                  <div className="space-y-px pb-1">
                    {mod.lessons.map((lesson) => {
                      const isActive = activeLesson?.id === lesson.id;
                      const isDone = completedLessons.has(lesson.id);
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => selectLesson(lesson)}
                          className={`w-full flex items-center gap-2.5 pl-6 pr-3 py-2 text-left transition-all ${
                            isActive
                              ? "bg-blue-600/20 border-l-2 border-blue-500"
                              : "border-l-2 border-transparent hover:bg-white/5 hover:border-white/10"
                          }`}
                        >
                          {/* Completion icon */}
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          ) : (
                            <Circle
                              className={`h-4 w-4 shrink-0 ${
                                isActive ? "text-blue-400" : "text-slate-600"
                              }`}
                            />
                          )}

                          {/* Type icon */}
                          <span
                            className={`shrink-0 ${
                              isActive ? "text-blue-400" : "text-slate-500"
                            }`}
                          >
                            {lessonTypeIcon(lesson)}
                          </span>

                          {/* Title */}
                          <span
                            className={`text-xs truncate leading-tight ${
                              isActive
                                ? "text-blue-300 font-semibold"
                                : isDone
                                ? "text-slate-400"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            {lesson.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* ════ RIGHT CONTENT ════ */}
        <main className="flex-1 overflow-y-auto bg-background">
          {activeLesson ? (
            <div className="flex flex-col h-full">
              {/* Lesson title */}
              <div className="px-6 pt-5 pb-3 shrink-0">
                <h2 className="text-xl font-bold text-foreground leading-tight">
                  {activeLesson.title}
                </h2>
              </div>

              {/* ── Video / Content area ── */}
              <div className="px-6 shrink-0">
                {activeLesson.video_url ? (
                  isEmbeddable(activeLesson.video_url) ? (
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-border shadow-xl">
                      <iframe
                        src={toEmbed(activeLesson.video_url)}
                        className="h-full w-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        title={activeLesson.title}
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black border border-border shadow-xl">
                      <video
                        src={activeLesson.video_url}
                        controls
                        className="h-full w-full bg-black"
                        title={activeLesson.title}
                      />
                    </div>
                  )
                ) : activeLesson.text_content ? (
                  <div className="w-full rounded-2xl border border-border bg-card p-6 prose prose-sm dark:prose-invert max-w-none">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-500 mb-4">
                      <BookOpen className="h-4 w-4" />
                      Reading Section
                    </div>
                    <p className="whitespace-pre-line text-foreground leading-relaxed text-sm">
                      {activeLesson.text_content}
                    </p>
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-2xl border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center text-center">
                    <PlayCircle className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">
                      No content available for this lesson.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Mark Complete button ── */}
              <div className="px-6 pt-4 pb-2 shrink-0 flex items-center justify-end">
                <Button
                  onClick={() => toggleProgress(activeLesson.id)}
                  variant={completedLessons.has(activeLesson.id) ? "outline" : "default"}
                  size="sm"
                  className={`rounded-xl h-8 px-4 text-xs font-bold gap-2 transition-all ${
                    completedLessons.has(activeLesson.id)
                      ? "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                      : ""
                  }`}
                >
                  {completedLessons.has(activeLesson.id) ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Completed
                    </>
                  ) : (
                    <>
                      <Circle className="h-3.5 w-3.5" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              </div>

              {/* ── Tab bar ── */}
              <div className="px-6 shrink-0">
                <div className="flex border-b border-border gap-1">
                  {(
                    [
                      { id: "materials", label: "Reading Materials", icon: BookOpen },
                      { id: "notes", label: "My Notes", icon: Clock },
                      { id: "discussion", label: "Discussion", icon: MessageSquare },
                    ] as const
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px ${
                        activeTab === id
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Tab panels ── */}
              <div className="flex-1 px-6 py-5 overflow-y-auto">
                {/* ── READING MATERIALS ── */}
                {activeTab === "materials" && (
                  <div className="space-y-3">
                    {resources.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                        <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground font-medium">
                          No materials available for this course.
                        </p>
                      </div>
                    ) : (
                      resources.map((res) => (
                        <div
                          key={res.id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/30 transition-colors"
                        >
                          {resourceIcon(res.file_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {res.title}
                            </p>
                            {res.file_size_bytes && (
                              <p className="text-[11px] text-muted-foreground">
                                {formatBytes(res.file_size_bytes)}
                              </p>
                            )}
                          </div>
                          <a
                            href={res.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs font-bold rounded-lg gap-1.5"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── NOTES ── */}
                {activeTab === "notes" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground font-medium">
                        Personal notes for: <span className="text-foreground font-semibold">{activeLesson.title}</span>
                      </p>
                      {lastSaved && (
                        <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={noteText}
                      onChange={(e) => handleNoteChange(e.target.value)}
                      onBlur={handleNoteBlur}
                      placeholder="Write your notes for this lesson..."
                      className="min-h-[240px] rounded-2xl bg-muted/40 focus:bg-card text-sm resize-none transition-colors"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Notes auto-save as you type. They are private to you.
                    </p>
                  </div>
                )}

                {/* ── DISCUSSION ── */}
                {activeTab === "discussion" && (
                  <div className="space-y-5">
                    {/* Post new comment */}
                    <div className="space-y-2">
                      <Textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Share your thoughts or ask a question about this lesson..."
                        className="min-h-[90px] rounded-2xl bg-muted/40 text-sm resize-none"
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={postComment}
                          disabled={postingComment || !commentText.trim()}
                          size="sm"
                          className="rounded-xl h-8 px-4 text-xs font-bold gap-1.5"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {postingComment ? "Posting…" : "Post Comment"}
                        </Button>
                      </div>
                    </div>

                    {/* Comments list */}
                    {comments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                        <MessageSquare className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground font-medium">
                          No comments yet. Be the first to start the discussion!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {comments.map((c) => {
                          const initials = c.user_name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase();
                          return (
                            <div
                              key={c.id}
                              className="flex gap-3 rounded-2xl border border-border bg-card p-4"
                            >
                              {/* Avatar */}
                              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20">
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-sm font-semibold text-foreground">
                                    {c.user_name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(c.created_at).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {c.body}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* No lessons empty state */
            <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-bold mb-2">No lessons available</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                You're enrolled! Content for this course hasn't been uploaded yet. Check
                back soon.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
