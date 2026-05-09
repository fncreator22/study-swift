import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/courses")({ component: CoursesAdmin });

const empty = { title: "", description: "", thumbnail_url: "", video_url: "" };

function CoursesAdmin() {
  const [videos, setVideos] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  async function load() {
    const { data } = await supabase.from("videos").select("*").order("created_at", { ascending: false });
    setVideos(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    const { error } = await supabase.from("videos").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Added"); setOpen(false); setForm(empty); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await supabase.from("videos").delete().eq("id", id);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Courses</h1>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add video</Button>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <div key={v.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-muted" />}
            <div className="p-5">
              <h3 className="font-display font-semibold">{v.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
              <Button size="sm" variant="ghost" className="mt-3" onClick={() => remove(v.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New video</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Thumbnail URL</Label><Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} /></div>
            <div><Label>Video URL (YouTube/Vimeo)</Label><Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
