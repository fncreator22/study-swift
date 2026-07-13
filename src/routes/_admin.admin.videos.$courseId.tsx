import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Film, Link as LinkIcon, Loader2, Plus, Trash2, Pencil, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/videos/$courseId")({
  component: VideosAdmin,
});

type Video = {
  id: string;
  title: string;
  description: string;
  video_url: string;
  storage_path: string | null;
  text_content: string | null;
  position: number;
};

function VideosAdmin() {
  const { courseId } = Route.useParams();
  const nav = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "external" | "text">("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [{ data: c }, { data: modules }] = await Promise.all([
      supabase.from("courses_v2").select("title").eq("id", courseId).maybeSingle(),
      supabase.from("course_modules_v2").select("id").eq("course_id", courseId)
    ]);
    setCourse(c);
    const moduleIds = (modules ?? []).map((m: any) => m.id);
    const { data: vs } = moduleIds.length > 0
      ? await supabase.from("course_lessons_v2").select("id, title, video_url, video_provider, text_content, order_index").in("module_id", moduleIds).order("order_index")
      : { data: [] };

    const mapped = (vs ?? []).map((v: any) => ({
      id: v.id,
      title: v.title,
      description: v.text_content ? "Reading module" : "Video module",
      video_url: v.video_url,
      position: v.order_index,
      text_content: v.text_content,
      storage_path: v.video_provider === "s3" ? v.video_url : null
    }));
    setVideos(mapped);
  }
  useEffect(() => { load(); }, [courseId]);

  function reset() {
    setTitle(""); setDescription(""); setExternalUrl(""); setTextContent("");
    setFile(null); setProgress(0); setMode("upload");
    setEditingVideo(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function openEditForm(v: Video) {
    setEditingVideo(v);
    setTitle(v.title || "");
    setDescription(v.description || "");
    if (v.text_content) {
      setMode("text");
      setTextContent(v.text_content);
    } else {
      setMode(v.video_url ? "external" : "upload");
      if (v.video_url) setExternalUrl(v.video_url);
    }
    setOpen(true);
  }

  async function save() {
    if (!title.trim()) return toast.error("Please enter a title");
    setBusy(true);
    try {
      let storage_path = editingVideo?.storage_path || null;
      let video_url = externalUrl.trim();

      if (mode === "upload" && file) {
        const path = `${courseId}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("course-videos").upload(path, file, {
          onUploadProgress: (p) => setProgress(Math.round((p.loaded / p.total) * 100))
        });
        if (uploadErr) throw uploadErr;
        storage_path = path;
        video_url = path;
      }

      // Get or create default course module in V2
      let { data: defaultMod } = await supabase.from("course_modules_v2").select("id").eq("course_id", courseId).order("order_index").limit(1).maybeSingle();
      if (!defaultMod) {
        const { data: newMod, error: modErr } = await supabase.from("course_modules_v2").insert({
          course_id: courseId,
          title: "Course Content",
          description: "Main curriculum modules.",
          order_index: 1
        }).select("id").single();
        if (modErr) throw modErr;
        defaultMod = newMod;
      }

      const rowPayload = {
        title,
        content_type: mode === "text" ? "text" : "video",
        video_url: mode === "text" ? null : video_url,
        video_provider: mode === "text" ? null : (mode === "external" ? "youtube" : "s3"),
        text_content: mode === "text" ? text_content : ""
      };

      if (editingVideo) {
        const { error } = await supabase.from("course_lessons_v2").update(rowPayload).eq("id", editingVideo.id);
        if (error) throw error;
        toast.success("Module updated");
      } else {
        const { error } = await supabase.from("course_lessons_v2").insert({
          module_id: defaultMod.id,
          ...rowPayload,
          order_index: videos.length + 1
        });
        if (error) throw error;
        toast.success("Module added");
      }
      setOpen(false); reset(); load();
    } catch (e: any) {
      toast.error(e.message || "Operation failed");
    } finally { setBusy(false); setProgress(0); }
  }

  async function remove(v: Video) {
    if (!confirm("Delete this module?")) return;
    if (v.storage_path) {
      await supabase.storage.from("course-videos").remove([v.storage_path]);
    }
    const { error } = await supabase.from("course_lessons_v2").delete().eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => nav({ to: "/admin/courses" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3 w-3" /> Back to courses
      </button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Modules & Content · {course?.title}</h1>
          <p className="text-sm text-muted-foreground">{videos.length} modules</p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add module</Button>
      </div>

      <div className="mt-8 space-y-3">
        {videos.length === 0 && <p className="text-sm text-muted-foreground">No modules yet.</p>}
        {videos.map((v, i) => (
          <div key={v.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary font-bold">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-semibold">{v.title}</p>
              <p className="truncate text-xs text-muted-foreground flex items-center gap-1">
                {v.text_content ? (
                  <><BookOpen className="h-3 w-3 text-emerald-500" /> Text module</>
                ) : v.storage_path ? (
                  <><Film className="h-3 w-3 text-blue-500" /> Secure video upload</>
                ) : (
                  <><LinkIcon className="h-3 w-3 text-indigo-500" /> {v.video_url || "No URL specified"}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => openEditForm(v)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(v)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingVideo ? "Edit module" : "New module"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === "upload" ? "default" : "outline"} onClick={() => setMode("upload")}><Film className="mr-2 h-3 w-3" /> Upload Video</Button>
              <Button type="button" size="sm" variant={mode === "external" ? "default" : "outline"} onClick={() => setMode("external")}><LinkIcon className="mr-2 h-3 w-3" /> External Video URL</Button>
              <Button type="button" size="sm" variant={mode === "text" ? "default" : "outline"} onClick={() => setMode("text")}><BookOpen className="mr-2 h-3 w-3" /> Text Content</Button>
            </div>
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            {mode === "upload" && (
              <div>
                <Label>Video file</Label>
                <Input ref={fileRef} type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <p className="mt-1 text-xs text-muted-foreground">Stored privately. Students stream via signed URLs.</p>
                {progress > 0 && <p className="mt-2 text-xs">Uploading: {progress}%</p>}
              </div>
            )}
            {mode === "external" && (
              <div>
                <Label>YouTube / Vimeo URL</Label>
                <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}
            {mode === "text" && (
              <div>
                <Label>Markdown / Plain Text Content</Label>
                <Textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="Write details or curriculum content here..." rows={8} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}{editingVideo ? "Save changes" : "Add module"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
