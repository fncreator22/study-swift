import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Upload, Film, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/videos/$courseId")({ component: VideosAdmin });

type Video = {
  id: string; title: string; description: string;
  video_url: string | null; storage_path: string | null;
  position: number; duration_sec: number;
};

function VideosAdmin() {
  const { courseId } = Route.useParams();
  const nav = useNavigate();
  const [course, setCourse] = useState<any>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "external">("upload");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [{ data: c }, { data: vs }] = await Promise.all([
      supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
      supabase.from("videos").select("*").eq("course_id", courseId).order("position"),
    ]);
    setCourse(c);
    setVideos((vs as any) ?? []);
  }
  useEffect(() => { load(); }, [courseId]);

  function reset() {
    setTitle(""); setDescription(""); setExternalUrl("");
    setFile(null); setProgress(0); setMode("upload");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    if (!title.trim()) return toast.error("Title required");
    setBusy(true);
    try {
      let storage_path: string | null = null;
      let video_url: string = "";
      if (mode === "upload") {
        if (!file) { setBusy(false); return toast.error("Choose a video file"); }
        const ext = file.name.split(".").pop() || "mp4";
        const path = `${courseId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("course-videos").upload(path, file, {
          contentType: file.type || "video/mp4",
        });
        if (upErr) throw upErr;
        storage_path = path;
      } else {
        if (!externalUrl.trim()) { setBusy(false); return toast.error("Paste a URL"); }
        video_url = externalUrl.trim();
      }
      const { error } = await supabase.from("videos").insert({
        course_id: courseId, title, description,
        storage_path, video_url, position: videos.length,
      });
      if (error) throw error;
      toast.success("Video added");
      setOpen(false); reset(); load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setBusy(false); setProgress(0); }
  }

  async function remove(v: Video) {
    if (!confirm("Delete this video?")) return;
    if (v.storage_path) {
      await supabase.storage.from("course-videos").remove([v.storage_path]);
    }
    const { error } = await supabase.from("videos").delete().eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => nav({ to: "/admin/courses" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Courses
      </button>
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Videos · {course?.title}</h1>
          <p className="text-sm text-muted-foreground">{videos.length} modules</p>
        </div>
        <Button onClick={() => { reset(); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add video</Button>
      </div>

      <div className="mt-8 space-y-3">
        {videos.length === 0 && <p className="text-sm text-muted-foreground">No videos yet.</p>}
        {videos.map((v, i) => (
          <div key={v.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary font-bold">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-semibold">{v.title}</p>
              <p className="truncate text-xs text-muted-foreground flex items-center gap-1">
                {v.storage_path ? <><Film className="h-3 w-3" /> Secure upload</> : <><LinkIcon className="h-3 w-3" /> External URL</>}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(v)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New video</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === "upload" ? "default" : "outline"} onClick={() => setMode("upload")}><Upload className="mr-2 h-3 w-3" /> Upload</Button>
              <Button type="button" size="sm" variant={mode === "external" ? "default" : "outline"} onClick={() => setMode("external")}><LinkIcon className="mr-2 h-3 w-3" /> External URL</Button>
            </div>
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            {mode === "upload" ? (
              <div>
                <Label>Video file</Label>
                <Input ref={fileRef} type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <p className="mt-1 text-xs text-muted-foreground">Stored privately. Students only stream via short-lived signed URLs.</p>
                {progress > 0 && <p className="mt-2 text-xs">Uploading: {progress}%</p>}
              </div>
            ) : (
              <div>
                <Label>YouTube / Vimeo URL</Label>
                <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." />
                <p className="mt-1 text-xs text-muted-foreground">External URLs are still gated by course access; the page won't render until the student is enrolled.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}Add video</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
