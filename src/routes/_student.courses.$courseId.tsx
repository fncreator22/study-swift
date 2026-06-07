import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { getVideoSignedUrl } from "@/lib/video.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PlayCircle, Lock, ArrowLeft, Clock, BookOpen, GraduationCap, MessageSquare, CheckCircle2, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_student/courses/$courseId")({ component: CourseDetail });

type Course = {
  id: string; title: string; description: string; tier: string; price: number;
  thumbnail_url: string; difficulty: string; instructor_name: string; instructor_bio: string; category: string;
};
type Video = {
  id: string; title: string; description: string;
  video_url: string | null; storage_path: string | null;
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
  const { user } = useAuth();
  const signUrl = useServerFn(getVideoSignedUrl);

  const [course, setCourse] = useState<Course | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    
    const { data: c } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
    if (!c) {
      setLoading(false);
      return;
    }
    setCourse(c as unknown as Course);

    if (c.tier === "free") setHasAccess(true);
    else {
      const { data: p } = await supabase.from("purchases").select("id").eq("user_id", user.id).eq("course_id", courseId).maybeSingle();
      let access = !!p;
      if (!access) {
        const { data: sub } = await supabase.rpc("has_course_access" as any, { _user_id: user.id, _course_id: courseId });
        access = !!sub;
      }
      setHasAccess(access);
    }

    const { data: vs } = await supabase.from("videos").select("id,title,description,video_url,storage_path").eq("course_id", courseId).order("position");
    const list = (vs ?? []) as Video[];
    setVideos(list);
    if (list.length) setActiveVideo(list[0]);

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
    if (!hasAccess || !activeVideo) { setSignedUrl(""); return; }
    setLoadingVideo(true);
    signUrl({ data: { videoId: activeVideo.id } })
      .then((r) => setSignedUrl(r.url))
      .catch((e: any) => toast.error(e.message || "Failed to load video"))
      .finally(() => setLoadingVideo(false));
  }, [hasAccess, activeVideo?.id]);

  async function purchase() {
    if (!user || !course) return;
    const { error } = await supabase.rpc("purchase_with_tokens" as any, { _test_id: null, _course_id: course.id });
    if (error) return toast.error(error.message);
    toast.success("Course unlocked successfully");
    setHasAccess(true);
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

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <Link to="/courses" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Browse courses
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {hasAccess && activeVideo ? (
            <div className="overflow-hidden rounded-3xl border border-border bg-black shadow-2xl">
              <div className="aspect-video w-full relative">
                {loadingVideo ? (
                  <div className="grid h-full w-full place-items-center text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>
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
                ) : null}
              </div>
              <div className="bg-card p-6">
                <h1 className="font-display text-2xl font-bold">{activeVideo.title}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{activeVideo.description}</p>
              </div>
            </div>
          ) : (
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-border bg-muted/50">
              {course.thumbnail_url && <img src={course.thumbnail_url} className="h-full w-full object-cover blur-sm opacity-50" />}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-background shadow-xl"><Lock className="h-8 w-8 text-primary" /></div>
                <h2 className="mt-6 font-display text-2xl font-bold">This content is locked</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">Enroll in this course to gain full access to all video modules and community discussion.</p>
                {!hasAccess && <Button size="lg" onClick={purchase} className="mt-8 h-14 rounded-2xl px-10 text-base shadow-lg shadow-primary/20">Purchase for ₹{course.price}</Button>}
              </div>
            </div>
          )}

          <div className="mt-10">
            <h2 className="font-display text-2xl font-bold">About this course</h2>
            <p className="mt-4 whitespace-pre-line text-muted-foreground leading-relaxed">{course.description}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap className="h-5 w-5" /></div>
                <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Instructor</p><p className="font-bold">{course.instructor_name || 'Expert Educator'}</p></div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent-foreground"><BookOpen className="h-5 w-5" /></div>
                <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Difficulty</p><p className="font-bold">{course.difficulty}</p></div>
              </div>
            </div>
          </div>

          <div className="mt-12">
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

        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-display font-bold">Course Content</h3>
            <p className="mt-1 text-xs text-muted-foreground">{videos.length} video modules</p>
            <div className="mt-6 space-y-2">
              {videos.map((v, i) => (
                <button key={v.id} disabled={!hasAccess} onClick={() => setActiveVideo(v)}
                  className={`flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-all ${activeVideo?.id === v.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-muted"} ${!hasAccess && 'opacity-60 grayscale cursor-not-allowed'}`}>
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-xs font-bold ${activeVideo?.id === v.id ? 'border-primary-foreground/30 bg-primary-foreground/10' : 'border-border bg-muted'}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-bold leading-tight">{v.title}</p>
                    <p className={`mt-0.5 truncate text-[10px] font-medium ${activeVideo?.id === v.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>Module {i + 1}</p>
                  </div>
                  {!hasAccess && <Lock className="h-3 w-3" />}
                  {hasAccess && activeVideo?.id === v.id && <CheckCircle2 className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center">
            <Trophy className="mx-auto h-8 w-8 text-primary" />
            <h4 className="mt-4 font-display font-bold">Certificate of Completion</h4>
            <p className="mt-2 text-xs text-muted-foreground">Unlock this course to earn a shareable certificate upon completion.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
