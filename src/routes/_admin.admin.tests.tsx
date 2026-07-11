import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ListChecks, FileText, ListOrdered } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/tests")({ component: TestsAdmin });

const empty = {
  title: "",
  description: "",
  price: 0,
  tier: "free",
  test_type: "mcq",
  duration_min: 30,
  total_marks: 0,
  word_limit: 500,
  instructions: "",
};

function TestsAdmin() {
  const [tests, setTests] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("none");
  const [open, setOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: ts }, { data: subs }] = await Promise.all([
      supabase.from("tests").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions" as any).select("id, name, test_ids"),
    ]);
    setTests(ts ?? []);
    setSubscriptions(subs ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startNew(type: "mcq" | "written") {
    setForm({ ...empty, test_type: type });
    setEditing(null);
    setSelectedPlanId("none");
    setChooserOpen(false);
    setOpen(true);
  }
  function startEdit(t: any) { 
    setForm({ ...empty, ...t }); 
    setEditing(t.id); 
    const plan = subscriptions.find(s => s.test_ids?.includes(t.id));
    setSelectedPlanId(plan ? plan.id : "none");
    setOpen(true); 
  }

  async function save() {
    const payload = {
      ...form,
      price: Number(form.price),
      duration_min: Number(form.duration_min),
      total_marks: Number(form.total_marks),
      word_limit: Number(form.word_limit) || 500,
    };
    
    const { data: testResult, error } = editing
      ? await supabase.from("tests").update(payload).eq("id", editing).select("id").single()
      : await supabase.from("tests").insert(payload).select("id").single();
      
    if (error) return toast.error(error.message);
    
    // Update subscription test mapping array
    const testId = editing || testResult.id;
    const oldPlan = subscriptions.find(s => s.test_ids?.includes(testId));
    if (oldPlan && oldPlan.id !== selectedPlanId) {
      const updatedIds = (oldPlan.test_ids || []).filter((id: string) => id !== testId);
      await supabase.from("subscriptions" as any).update({ test_ids: updatedIds }).eq("id", oldPlan.id);
    }
    if (selectedPlanId !== "none" && (!oldPlan || oldPlan.id !== selectedPlanId)) {
      const newPlan = subscriptions.find(s => s.id === selectedPlanId);
      if (newPlan) {
        const updatedIds = [...(newPlan.test_ids || []), testId];
        await supabase.from("subscriptions" as any).update({ test_ids: updatedIds }).eq("id", selectedPlanId);
      }
    }
    
    toast.success("Saved"); 
    setOpen(false); 
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this test? This will remove all associated questions and student attempts.")) return;
    try {
      const { error } = await supabase.from("tests").delete().eq("id", id);
      if (error) {
        console.error("Delete error:", error);
        return toast.error(`Failed to delete: ${error.message}`);
      }
      toast.success("Test deleted successfully");
      load();
    } catch (err: any) {
      toast.error("An unexpected error occurred during deletion");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Tests</h1>
        <Button onClick={() => setChooserOpen(true)}><Plus className="mr-2 h-4 w-4" /> New test</Button>
      </div>

      {loading ? (
        <div className="mt-20 flex justify-center"><p className="text-sm text-muted-foreground animate-pulse">Loading tests...</p></div>
      ) : tests.length === 0 ? (
        <div className="mt-20 text-center"><p className="text-sm text-muted-foreground">No tests found. Create one to get started.</p></div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tests.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">{t.tier}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                  {t.test_type === "written" ? "Written" : "MCQ"}
                </span>
              </div>
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
      )}

      {/* Type chooser */}
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Choose test type</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <button onClick={() => startNew("mcq")} className="rounded-2xl border border-border p-5 text-left hover:border-primary hover:bg-primary/5">
              <ListOrdered className="h-6 w-6 text-primary" />
              <p className="mt-2 font-display font-semibold">MCQ Test</p>
              <p className="text-xs text-muted-foreground">Multiple-choice, auto-graded.</p>
            </button>
            <button onClick={() => startNew("written")} className="rounded-2xl border border-border p-5 text-left hover:border-primary hover:bg-primary/5">
              <FileText className="h-6 w-6 text-primary" />
              <p className="mt-2 font-display font-semibold">Written Test</p>
              <p className="text-xs text-muted-foreground">Essay answers, admin-graded.</p>
            </button>
            <button onClick={() => startNew("hybrid" as any)} className="rounded-2xl border border-border p-5 text-left hover:border-primary hover:bg-primary/5">
              <ListChecks className="h-6 w-6 text-primary" />
              <p className="mt-2 font-display font-semibold">Hybrid Test</p>
              <p className="text-xs text-muted-foreground">Mix MCQ + written; admin publishes the final score.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "New"} {form.test_type === "written" ? "written" : "MCQ"} test
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Total marks</Label><Input type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })} /></div>
              {form.test_type === "written" && (
                <div><Label>Default word limit</Label><Input type="number" value={form.word_limit} onChange={(e) => setForm({ ...form, word_limit: e.target.value })} /></div>
              )}
            </div>
            <div><Label>Instructions</Label><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
