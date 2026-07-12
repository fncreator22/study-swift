import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { getVideoSignedUrl } from "@/lib/video.functions";
import { reportBug } from "@/lib/bug.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayCircle, Lock, ArrowLeft, Clock, BookOpen, GraduationCap, MessageSquare, CheckCircle2, Trophy, Loader2, Award, Calendar, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { TokenRequestModal } from "@/components/TokenRequestModal";
import { CertificateModal } from "@/components/CertificateModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_student/courses/$courseId")({ component: CourseDetail });

type Course = {
  id: string; title: string; description: string; tier: string; price: number;
  thumbnail_url: string; difficulty: string; instructor_name: string; instructor_bio: string; category: string;
  completion_test_id: string | null;
};
type Video = {
  id: string; title: string; description: string;
  video_url: string | null; storage_path: string | null;
  text_content: string | null;
};
type Comment = { id: string; body: string; created_at: string; user_id: string };

function toEmbed(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${u.pathname.slice(1)}`;
    return url;
  } catch { return url; }
}

function CourseDetail() {
  const { courseId } = Route.useParams();
  const { user, tokens, refreshProfile } = useAuth();
  const signUrl = useServerFn(getVideoSignedUrl);
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const purchasingRef = useRef(false);

  // Certification & Progression states
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<any>(null);
  const [certificate, setCertificate] = useState<any>(null);
  const [completionAttempt, setCompletionAttempt] = useState<any>(null);
  const [resolvedTestId, setResolvedTestId] = useState<string | null>(null);
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certName, setCertName] = useState("");
  const [certDob, setCertDob] = useState("");
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [savingCertInfo, setSavingCertInfo] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    
    const { data: c } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
    if (!c) {
      setLoading(false);
      return;
    }
    setCourse(c as unknown as Course);

    // Get user profile details
    const { data: prof } = await supabase.from("profiles").select("full_name, date_of_birth").eq("id", user.id).maybeSingle();
    setUserProfile(prof);
    if (prof) {
      setCertName(prof.full_name || "");
      setCertDob(prof.date_of_birth || "");
    }

    const { data: p } = await supabase.from("purchases").select("id").eq("user_id", user.id).eq("course_id", courseId).maybeSingle();
    let access = !!p;
    if (!access) {
      const { data: sub } = await supabase.rpc("has_course_access" as any, { _user_id: user.id, _course_id: courseId });
      access = !!sub;
    }
    setHasAccess(access);

    // Load videos/modules
    const { data: vs } = await supabase.from("videos").select("id,title,description,video_url,storage_path,text_content").eq("course_id", courseId).order("position");
    const list = (vs ?? []) as Video[];
    setVideos(list);
    if (list.length) setActiveVideo(list[0]);

    // Load module progression
    const { data: prog } = await supabase.from("module_progress").select("video_id").eq("user_id", user.id);
    const completedSet = new Set((prog ?? []).map((p: any) => p.video_id));
    setCompletedModules(completedSet);

    // Fetch certification & attempt if test linked or fallback to matching test category
    let targetTestId = c.completion_test_id;
    if (!targetTestId) {
      // Query tests to find one matching this course category
      const { data: matchedTest } = await supabase.from("tests").select("id").eq("category", c.category).limit(1).maybeSingle();
      if (matchedTest) {
        targetTestId = matchedTest.id;
      } else {
        // Fallback to the first available test in the database
        const { data: firstTest } = await supabase.from("tests").select("id").limit(1).maybeSingle();
        if (firstTest) targetTestId = firstTest.id;
      }
    }
    setResolvedTestId(targetTestId);

    if (targetTestId) {
      const [{ data: cert }, { data: att }] = await Promise.all([
        supabase.from("certificates").select("*").eq("user_id", user.id).eq("course_id", courseId).maybeSingle(),
        supabase.from("test_attempts").select("id, score, total, is_reviewed").eq("user_id", user.id).eq("test_id", targetTestId).eq("is_reviewed", true).order("submitted_at", { ascending: false }).maybeSingle()
      ]);
      setCertificate(cert);
      setCompletionAttempt(att);
    }

    // Comments load
    const { data: cs } = await supabase.from("comments").select("*").eq("course_id", courseId).order("created_at", { ascending: false });
    setComments((cs as Comment[]) ?? []);
    const uIds = Array.from(new Set((cs ?? []).map((c: any) => c.user_id)));
    if (uIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", uIds);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { m[p.id] = p.full_name || "Student"; });
      setNames(m);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [user, courseId]);

  // Fetch signed URL whenever active video / access changes
  useEffect(() => {
    if (!hasAccess || !activeVideo) { 
      setSignedUrl(""); 
      setVideoError(null); 
      return; 
    }
    if (activeVideo.text_content && !activeVideo.video_url && !activeVideo.storage_path) {
      setSignedUrl("");
      setVideoError(null);
      return; // Text only module
    }
    setLoadingVideo(true);
    setVideoError(null);
    signUrl({ data: { videoId: activeVideo.id } })
      .then((r) => {
        setSignedUrl(r.url);
        if (!r.url) {
          throw new Error("Empty URL returned from signing provider");
        }
      })
      .catch(async (e: any) => {
        const errMsg = e.message || "Failed to load video source stream";
        setVideoError(errMsg);
        // Silently log bug to database for the admin!
        try {
          await reportBug({
            data: {
              error_message: `Video playback load failed on course: "${course?.title || courseId}", module: "${activeVideo.title}". Error: ${errMsg}`,
              route: window.location.pathname,
              user_id: user?.id
            }
          });
        } catch (reportErr) {
          console.error("Failed to report diagnostics to DB:", reportErr);
        }
      })
      .finally(() => setLoadingVideo(false));
  }, [hasAccess, activeVideo?.id, course?.title]);

  async function purchase() {
    if (purchasingRef.current) return;
    if (!user || !course) return;
    const tokenCost = course.price;

    if (tokens < tokenCost) {
      toast.error(`Insufficient tokens. This course requires ${tokenCost} tokens.`);
      setPurchaseOpen(true);
      return;
    }
    
    purchasingRef.current = true;
    setPurchasing(true);
    try {
      const { error } = await supabase.rpc("purchase_with_tokens" as any, { _test_id: null, _course_id: course.id });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Course unlocked successfully");
        setHasAccess(true);
        refreshProfile();
        load();
      }
    } finally {
      purchasingRef.current = false;
      setPurchasing(false);
    }
  }

  async function toggleModuleProgress(videoId: string) {
    if (!hasAccess) return;
    const isCompleted = completedModules.has(videoId);
    if (isCompleted) {
      const { error } = await supabase.from("module_progress").delete().eq("user_id", user?.id).eq("video_id", videoId);
      if (error) return toast.error(error.message);
      const updated = new Set(completedModules);
      updated.delete(videoId);
      setCompletedModules(updated);
    } else {
      const { error } = await supabase.from("module_progress").insert({ user_id: user?.id, video_id: videoId });
      if (error) return toast.error(error.message);
      const updated = new Set(completedModules);
      updated.add(videoId);
      setCompletedModules(updated);
    }
  }

  async function markCompletedAndNext() {
    if (!activeVideo) return;
    
    // Only insert progression row if not already marked completed
    if (!completedModules.has(activeVideo.id)) {
      const { error } = await supabase.from("module_progress").insert({ user_id: user?.id, video_id: activeVideo.id });
      if (error) return toast.error(error.message);
      const updated = new Set(completedModules);
      updated.add(activeVideo.id);
      setCompletedModules(updated);
    }
    
    const currentIndex = videos.findIndex(v => v.id === activeVideo.id);
    if (currentIndex < videos.length - 1) {
      setActiveVideo(videos[currentIndex + 1]);
    } else {
      toast.success("All modules completed! You can now start the Certification Exam.");
      load();
    }
  }

  async function handleStartExam() {
    if (!userProfile?.full_name || !userProfile?.date_of_birth) {
      setCertDialogOpen(true);
    } else {
      if (resolvedTestId) {
        navigate({ to: "/tests/$testId", params: { testId: resolvedTestId } });
      }
    }
  }

  async function saveCertificateDetails() {
    if (!certName.trim()) return toast.error("Please enter your official full name");
    if (!certDob) return toast.error("Please select your date of birth");

    setSavingCertInfo(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: certName.trim(), date_of_birth: certDob })
      .eq("id", user?.id);

    setSavingCertInfo(false);
    if (error) return toast.error(error.message);

    setCertDialogOpen(false);
    toast.success("Certification details registered. Redirecting to Exam...");
    if (resolvedTestId) {
      navigate({ to: "/tests/$testId", params: { testId: resolvedTestId } });
    }
  }

  async function postComment() {
    if (!body.trim() || !user) return;
    const { error } = await supabase.from("comments").insert({ course_id: courseId, user_id: user.id, body: body.trim() });
    if (error) return toast.error(error.message);
    setBody(""); load();
  }

  if (loading) return <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse">Loading course…</div>;
  if (!course) return <div className="p-8 text-center"><p className="text-muted-foreground">Course not found.</p><Link to="/courses" className="mt-4 inline-block text-primary font-bold">Back to courses</Link></div>;

  const isExternal = activeVideo && !activeVideo.storage_path && activeVideo.video_url;
  const isTextModule = activeVideo && activeVideo.text_content && !activeVideo.storage_path && !activeVideo.video_url;
  
  // Progression percentage
  const totalModules = videos.length;
  const completedCount = videos.filter(v => completedModules.has(v.id)).length;
  const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const allCompleted = progressPercent === 100 && totalModules > 0;

  // Skills learning items
  const skillsList = course.category === "Development" || course.title.toLowerCase().includes("programming") 
    ? ["Software Engineering", "Clean Code", "Implementation", "Debugging", "Data Structures"]
    : course.title.toLowerCase().includes("docker") || course.title.toLowerCase().includes("kubernetes")
    ? ["DevOps", "Containerization", "Cloud Architecture", "System Deployments", "Scaling"]
    : ["Mastery", "Core Fundamentals", "Industry Best Practices", "Advanced Theory", "Problem Solving"];

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Browse courses
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {hasAccess && activeVideo ? (
            <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
              <div className="aspect-video w-full relative bg-black">
                {videoError ? (
                  <div className="h-full w-full bg-slate-950 p-8 flex flex-col items-center justify-center text-center text-white space-y-4">
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20">
                      <AlertCircle className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-sm tracking-tight">Unable to load media content</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                        We encountered an issue loading this module's media content. The diagnostics have been reported to the administration team.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Link to="/courses">
                        <Button size="sm" variant="outline" className="border-slate-800 text-slate-300 hover:bg-slate-900 rounded-xl h-8 text-xs font-bold px-3">
                          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Go Back
                        </Button>
                      </Link>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          const v = activeVideo;
                          setActiveVideo(null);
                          setTimeout(() => setActiveVideo(v), 50);
                        }} 
                        className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl h-8 text-xs px-3"
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  </div>
                ) : loadingVideo || (!signedUrl && !isTextModule) ? (
                  <div className="grid h-full w-full place-items-center text-white">
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <span className="text-xs text-slate-400 block font-medium">Loading content stream...</span>
                    </div>
                  </div>
                ) : isTextModule ? (
                  <div className="h-full w-full bg-[#fcfbfa] p-8 overflow-y-auto text-slate-800 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
                        <BookOpen className="h-4 w-4" /> Reading Section
                      </div>
                      <h2 className="font-serif text-2xl font-bold text-[#1e293b]">{activeVideo.title}</h2>
                      <div className="w-12 h-0.5 bg-primary mt-2"></div>
                      <p className="whitespace-pre-line text-slate-700 leading-relaxed font-sans text-sm md:text-base pt-4">
                        {activeVideo.text_content}
                      </p>
                    </div>
                    <div className="text-[10px] text-muted-foreground italic border-t border-slate-100 pt-4 mt-6">
                      Read the section completely then click the mark completed button.
                    </div>
                  </div>
                ) : isExternal ? (
                  <iframe src={toEmbed(signedUrl)} className="h-full w-full" allowFullScreen title={activeVideo.title} />
                ) : signedUrl ? (
                  <video
                    src={signedUrl}
                    controls
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    className="h-full w-full bg-black"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-muted-foreground text-sm">No video source specified.</div>
                )}
              </div>
              <div className="bg-card p-6 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <h1 className="font-display text-2xl font-bold">{activeVideo.title}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">{activeVideo.description}</p>
                </div>
                {hasAccess && (
                  <Button 
                    onClick={markCompletedAndNext}
                    className="rounded-xl shrink-0 font-bold bg-primary text-primary-foreground hover:bg-primary/95 flex items-center gap-2"
                  >
                    {completedModules.has(activeVideo.id) ? "Next Module" : "Mark Completed & Next"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative w-full overflow-hidden rounded-3xl border border-border bg-muted/50 min-h-[340px] md:aspect-video">
              {course.thumbnail_url && <img src={course.thumbnail_url} className="h-full w-full object-cover blur-sm opacity-50" />}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-background shadow-xl"><Lock className="h-8 w-8 text-primary" /></div>
                <h2 className="mt-6 font-display text-2xl font-bold">This content is locked</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">Enroll in this course to gain full access to all video modules and community discussion.</p>
                {!hasAccess && (
                  <Button 
                    size="lg" 
                    onClick={purchase} 
                    disabled={purchasing}
                    className="mt-8 h-14 rounded-2xl px-10 text-base shadow-lg shadow-primary/20"
                  >
                    {purchasing ? "Unlocking..." : `Unlock for ${course.price} Tokens`}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Core description details */}
          <div className="mt-10 space-y-4">
            <h2 className="font-display text-2xl font-bold">About this course</h2>
            <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{course.description}</p>
            
            {/* Skills Gain badges */}
            <div className="mt-6 pt-4 border-t border-border/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Skills you will gain</h3>
              <div className="flex flex-wrap gap-2">
                {skillsList.map((sk) => (
                  <span key={sk} className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-bold">
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Curriculum Section (Syllabus) */}
          <div className="mt-10 border-t border-border pt-10">
            <h2 className="font-display text-2xl font-bold mb-6">Course Curriculum</h2>
            <div className="space-y-3">
              {videos.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Syllabus modules are currently being added. Check back soon!</p>
              ) : (
                videos.map((v, i) => (
                  <button 
                    key={v.id} 
                    onClick={() => {
                      if (hasAccess) {
                        setActiveVideo(v);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      } else {
                        toast.error("Please enroll to access this module");
                      }
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${!hasAccess ? 'opacity-65 cursor-not-allowed bg-muted/40 border-border' : 'bg-card border-border hover:border-primary/20 hover:bg-primary/5'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold">Module {i + 1}</div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{v.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{v.description || "Module description details."}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-slate-500">
                        {v.text_content ? "Reading" : "Video"}
                      </span>
                      {!hasAccess && <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Instructor profile description */}
          <div className="mt-10 border-t border-border pt-10 grid gap-6 sm:grid-cols-2">
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap className="h-6 w-6" /></div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Publisher / Instructor</p>
                <p className="font-bold text-base mt-0.5">{course.instructor_name || 'Expert Educator'}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">{course.instructor_bio || 'Experienced engineering educator specializing in high scale platform development.'}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent-foreground"><BookOpen className="h-6 w-6" /></div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Course difficulty</p>
                <p className="font-bold text-base mt-0.5">{course.difficulty}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-normal">Designed for engineers aiming to master dynamic problem solving patterns.</p>
              </div>
            </div>
          </div>

          {/* Community Discussion Section */}
          <div className="mt-12 border-t border-border pt-10">
            <div className="flex items-center gap-2 mb-6"><MessageSquare className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Community Discussion</h2></div>
            {hasAccess ? (
              <div className="flex flex-col gap-4">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you think of this module?" className="rounded-2xl min-h-[100px]" />
                <Button onClick={postComment} className="self-end rounded-xl px-8">Post comment</Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground font-medium">Join the course to participate in the discussion.</p>
              </div>
            )}
            <div className="mt-8 space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{names[c.user_id] ?? "Student"}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar details */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
              <div>
                <h3 className="font-display font-bold">Course Progression</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{completedCount} of {totalModules} completed</p>
              </div>
              <span className="text-lg font-black text-primary">{progressPercent}%</span>
            </div>

            {/* Progression Bar */}
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden mb-6">
              <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
            </div>

            <div className="space-y-2">
              {videos.map((v, i) => {
                const isCompleted = completedModules.has(v.id);
                return (
                  <button 
                    key={v.id} 
                    disabled={!hasAccess} 
                    onClick={() => setActiveVideo(v)}
                    className={`w-full flex items-center gap-3 text-left p-3 rounded-2xl transition-all ${activeVideo?.id === v.id ? "bg-primary/5 border border-primary/20 font-semibold" : "hover:text-primary"} ${!hasAccess && 'opacity-60 grayscale cursor-not-allowed'}`}
                  >
                    {/* Circle status indicator instead of checkbox */}
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-mono font-bold ${activeVideo?.id === v.id ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted'}`}>{i + 1}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-bold leading-tight">Module {i + 1}: {v.title}</p>
                      <p className="mt-0.5 truncate text-[9px] text-muted-foreground flex items-center gap-1">
                        {v.text_content ? <><BookOpen className="h-2.5 w-2.5" /> Reading Module</> : <><PlayCircle className="h-2.5 w-2.5" /> Video Module</>}
                      </p>
                    </div>
                    {!hasAccess && <Lock className="h-3 w-3 text-muted-foreground/60" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Certification Card / Coursera Demo Preview Box */}
          {resolvedTestId && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center space-y-4">
                <Trophy className="mx-auto h-8 w-8 text-primary" />
                <h4 className="font-display font-bold">Professional Certification</h4>
                
                {!hasAccess ? (
                  <p className="text-xs text-muted-foreground">Unlock this course to gain certificate access.</p>
                ) : !allCompleted ? (
                  <p className="text-xs text-muted-foreground">
                    Complete all {totalModules} modules (currently at {progressPercent}%) to unlock the certification exam.
                  </p>
                ) : certificate ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-emerald-500/10 p-3 border border-emerald-500/20 text-emerald-700 text-xs font-semibold">
                      🎉 Certified! Score: {completionAttempt ? Math.round((completionAttempt.score / completionAttempt.total) * 100) : 100}%
                    </div>
                    <Button onClick={() => setCertModalOpen(true)} className="w-full rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2">
                      <Award className="h-4 w-4" /> View Certificate
                    </Button>
                  </div>
                ) : completionAttempt ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Exam submitted successfully! Score: {Math.round((completionAttempt.score / completionAttempt.total) * 100)}%. Certificate will be issued upon final grading.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      You have finished all course modules. Pass the certification exam to generate your official certificate.
                    </p>
                    <Button onClick={handleStartExam} className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10">
                      <PlayCircle className="h-4 w-4" /> Start Certification Exam
                    </Button>
                  </div>
                )}
              </div>

              {/* Gold border Coursera style certificate preview box */}
              {!certificate && (
                <div className="rounded-3xl border-2 border-double border-slate-300 bg-[#faf8f5] p-6 text-center space-y-4 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <span className="text-[7px] font-black text-slate-800 tracking-wider">EXAMLY ACADEMY</span>
                    <span className="text-[7px] font-bold text-slate-400">DEMO PREVIEW</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-serif text-xs font-bold text-slate-700 uppercase tracking-tighter">Course Certificate</h4>
                    <div className="w-12 h-0.5 bg-amber-400 mx-auto"></div>
                  </div>

                  <div className="space-y-1 py-1">
                    <p className="text-[8px] italic text-slate-400">presented to</p>
                    <p className="font-serif text-xs font-bold text-slate-800 border-b border-dashed border-slate-300 pb-1 max-w-[120px] mx-auto">
                      {userProfile?.full_name || "[Your Name]"}
                    </p>
                  </div>

                  <p className="text-[8px] font-bold text-[#1d4ed8] line-clamp-1">{course.title}</p>

                  <div className="flex justify-between items-end text-[6px] text-slate-400">
                    <div className="text-left scale-90">
                      <p className="font-serif italic font-bold">Jules White</p>
                      <div className="w-10 h-px bg-slate-200"></div>
                      <p>Dean of Computer Science</p>
                    </div>
                    {/* Double-ring stamp visual */}
                    <div className="w-8 h-8 rounded-full border-2 border-double border-slate-300 bg-white flex items-center justify-center">
                      <span className="text-[4px] font-bold text-slate-400">STAMP</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Verification details modal for certificates */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Certificate Registration
            </DialogTitle>
            <DialogDescription>
              Please review and write your official credentials. These details will be printed on your final stamp-authorized certificate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="cert-name">Official Full Name</Label>
              <Input 
                id="cert-name" 
                value={certName} 
                onChange={(e) => setCertName(e.target.value)} 
                placeholder="e.g. John Doe" 
              />
              <p className="text-[10px] text-muted-foreground">Use uppercase initials as needed. First name and Last name.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-dob">Date of Birth</Label>
              <Input 
                id="cert-dob" 
                type="date" 
                value={certDob} 
                onChange={(e) => setCertDob(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveCertificateDetails} disabled={savingCertInfo}>
              {savingCertInfo ? "Saving..." : "Confirm & Proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TokenRequestModal open={purchaseOpen} onOpenChange={setPurchaseOpen} />
      {certificate && (
        <CertificateModal open={certModalOpen} onOpenChange={setCertModalOpen} certificate={certificate} />
      )}
    </div>
  );
}
