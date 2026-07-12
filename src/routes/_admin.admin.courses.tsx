import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, PlayCircle, Film, Pencil, Trash2, Trophy } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/courses")({ component: AdminCourses });

const empty = {
  title: "", category: "Professional", description: "",
  tier: "free", price: 0, difficulty: "Beginner",
  thumbnail_url: "", instructor_name: "", instructor_bio: "",
  completion_test_id: null
};

function AdminCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("none");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    const [{ data: cs }, { data: subs }, { data: ts }] = await Promise.all([
      supabase.from("courses").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions" as any).select("id, name, course_ids"),
      supabase.from("tests").select("id, title, test_type").order("title"),
    ]);
    setCourses(cs ?? []);
    setSubscriptions(subs ?? []);
    setTests(ts ?? []);
  }
  useEffect(() => { load(); }, []);

  function startEdit(c: any) {
    setForm({
      ...empty,
      ...c,
      completion_test_id: c.completion_test_id || "none"
    });
    setEditing(c.id);
    const plan = subscriptions.find(s => s.course_ids?.includes(c.id));
    setSelectedPlanId(plan ? plan.id : "none");
    setOpen(true);
  }

  async function save() {
    const completionTestId = form.completion_test_id === "none" ? null : form.completion_test_id;
    const payload = { 
      title: form.title,
      category: form.category,
      description: form.description,
      tier: form.tier,
      price: Number(form.price),
      difficulty: form.difficulty,
      thumbnail_url: form.thumbnail_url,
      instructor_name: form.instructor_name,
      instructor_bio: form.instructor_bio,
      completion_test_id: completionTestId
    };

    const { data: courseResult, error } = editing 
      ? await supabase.from("courses").update(payload).eq("id", editing).select("id").single()
      : await supabase.from("courses").insert(payload).select("id").single();
    
    if (error) return toast.error(error.message);

    // Update subscription course mapping array
    const courseId = editing || courseResult.id;
    const oldPlan = subscriptions.find(s => s.course_ids?.includes(courseId));
    if (oldPlan && oldPlan.id !== selectedPlanId) {
      const updatedIds = (oldPlan.course_ids || []).filter((id: string) => id !== courseId);
      await supabase.from("subscriptions" as any).update({ course_ids: updatedIds }).eq("id", oldPlan.id);
    }
    if (selectedPlanId !== "none" && (!oldPlan || oldPlan.id !== selectedPlanId)) {
      const newPlan = subscriptions.find(s => s.id === selectedPlanId);
      if (newPlan) {
        const updatedIds = [...(newPlan.course_ids || []), courseId];
        await supabase.from("subscriptions" as any).update({ course_ids: updatedIds }).eq("id", selectedPlanId);
      }
    }

    toast.success(editing ? "Updated" : "Added"); 
    setOpen(false); 
    setForm(empty); 
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this course and all associated data?")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Courses</h1>
        <Button onClick={() => { setForm(empty); setEditing(null); setSelectedPlanId("none"); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Add course</Button>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="relative aspect-video w-full bg-muted">
              {c.thumbnail_url ? <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary/20"><PlayCircle className="h-10 w-10" /></div>}
              <div className="absolute top-2 left-2">
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase backdrop-blur">{c.tier}</span>
              </div>
            </div>
            <div className="p-5">
              <h3 className="font-display font-semibold line-clamp-1">{c.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
              {c.completion_test_id && (
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  <Trophy className="h-3 w-3" /> Certification Exam Linked
                </div>
              )}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-bold">{c.tier === 'free' ? 'Free' : `${c.price} Tokens`}</span>
                <div className="flex gap-1">
                  <Link to="/admin/videos/$courseId" params={{ courseId: c.id }}>
                    <Button size="sm" variant="outline"><Film className="mr-1 h-3 w-3" /> Modules</Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Course" : "New Course"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Price (in Tokens)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Access Subscription Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Individual Token purchase / Free)</SelectItem>
                  {subscriptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Linked Certification Test Select Box */}
            <div className="space-y-2">
              <Label>Linked Certification Exam</Label>
              <Select 
                value={form.completion_test_id || "none"} 
                onValueChange={(v) => setForm({ ...form, completion_test_id: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (No certificate issued for this course)</SelectItem>
                  {tests.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.title} ({t.test_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Students must score marks in this exam after 100% course modules completion to receive their certificate.</p>
            </div>

            <div className="space-y-2"><Label>Thumbnail URL</Label><Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Instructor Name</Label><Input value={form.instructor_name} onChange={(e) => setForm({ ...form, instructor_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Instructor Bio</Label><Input value={form.instructor_bio} onChange={(e) => setForm({ ...form, instructor_bio: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full">{editing ? "Update" : "Create"} Course</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
