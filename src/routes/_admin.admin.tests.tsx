import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/tests")({ component: TestsAdmin });

const empty = { title: "", description: "", price: 0, tier: "free", duration_min: 30, total_marks: 0, instructions: "" };

function TestsAdmin() {
  const [tests, setTests] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("tests").select("*").order("created_at", { ascending: false });
    setTests(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function startNew() { setForm(empty); setEditing(null); setOpen(true); }
  function startEdit(t: any) { setForm(t); setEditing(t.id); setOpen(true); }

  async function save() {
    const payload = { ...form, price: Number(form.price), duration_min: Number(form.duration_min), total_marks: Number(form.total_marks) };
    const { error } = editing
      ? await supabase.from("tests").update(payload).eq("id", editing)
      : await supabase.from("tests").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this test?")) return;
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold">Tests</h1>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" /> New test</Button>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tests.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">{t.tier}</span>
              <span className="text-sm font-semibold">{t.tier === "free" ? "Free" : `₹${t.price}`}</span>
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold">{t.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
            <div className="mt-4 flex gap-2">
              <Link to="/admin/questions/$testId" params={{ testId: t.id }}><Button size="sm" variant="outline"><ListChecks className="mr-1 h-3 w-3" /> Questions</Button></Link>
              <Button size="sm" variant="ghost" onClick={() => startEdit(t)}><Pencil className="h-3 w-3" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit test" : "New test"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Tier</Label>
                <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} /></div>
            </div>
            <div><Label>Total marks</Label><Input type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })} /></div>
            <div><Label>Instructions</Label><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
