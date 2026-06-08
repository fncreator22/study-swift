import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LifeBuoy, Plus, MessageCircle, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_student/support")({ component: Support });

const CATEGORIES: Record<string, string[]> = {
  "Login issue": ["Cannot log in", "Forgot password", "Account locked", "Other"],
  "Test issue": ["Test won't start", "Test crashed mid-attempt", "Wrong score", "Question error", "Other"],
  "Course issue": ["Video won't play", "Access denied after purchase", "Quality issue", "Other"],
  "Payment issue": ["Payment failed", "Charged twice", "Refund request", "Other"],
  "Token issue": ["Tokens not credited", "Wrong deduction", "Top-up failed", "Other"],
  "Subscription issue": ["Plan not active", "Renewal failed", "Upgrade/downgrade", "Other"],
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600",
  processing: "bg-amber-500/10 text-amber-600",
  waiting: "bg-purple-500/10 text-purple-600",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({ category: "", subcategory: "", subject: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setTickets((data as any[]) ?? []);
  }
  useEffect(() => { load(); }, [user]);

  async function openTicket(t: any) {
    setActive(t);
    const { data } = await supabase.from("ticket_replies" as any).select("*").eq("ticket_id", t.id).order("created_at");
    setReplies((data as any[]) ?? []);
  }

  async function sendReply() {
    if (!reply.trim() || !active || !user) return;
    const { error } = await supabase.from("ticket_replies" as any).insert({
      ticket_id: active.id, sender_id: user.id, message: reply.trim(), is_admin: false,
    });
    if (error) return toast.error(error.message);
    setReply("");
    openTicket(active);
    load();
  }

  async function submit() {
    if (!user) return;
    if (!form.category || !form.subcategory || !form.description.trim()) {
      return toast.error("Please complete all fields");
    }
    setSubmitting(true);
    const { data, error } = await supabase.from("support_tickets" as any).insert({
      user_id: user.id,
      category: form.category,
      subcategory: form.subcategory,
      subject: form.subject || form.subcategory,
      description: form.description.trim(),
    }).select().single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Ticket created · ${(data as any).ticket_number}`);
    setOpen(false);
    setForm({ category: "", subcategory: "", subject: "", description: "" });
    load();
  }

  if (active) {
    return (
      <div className="mx-auto max-w-3xl">
        <button onClick={() => setActive(null)} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All tickets
        </button>
        <div className="mt-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{active.ticket_number}</p>
              <h1 className="mt-1 font-display text-xl font-bold">{active.subject || active.subcategory}</h1>
              <p className="text-xs text-muted-foreground">{active.category} · {active.subcategory}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${STATUS_STYLES[active.status] || ""}`}>{active.status}</span>
          </div>
          <p className="mt-4 whitespace-pre-line rounded-2xl border border-border bg-muted/30 p-4 text-sm">{active.description}</p>
        </div>

        <div className="mt-6 space-y-3">
          {replies.map((r) => (
            <div key={r.id} className={`rounded-2xl border p-4 ${r.is_admin ? "border-primary/30 bg-primary/5 ml-8" : "border-border bg-card mr-8"}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{r.is_admin ? "Admin" : "You"}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-line text-sm">{r.message}</p>
            </div>
          ))}
        </div>

        {active.status !== "closed" && (
          <div className="mt-6 flex gap-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" className="flex-1 rounded-2xl" />
            <Button onClick={sendReply} className="self-end rounded-xl"><Send className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground italic">Get help from our team — open a ticket and track replies.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl"><Plus className="mr-1 h-4 w-4" /> New ticket</Button>
      </div>

      <div className="mt-8 space-y-3">
        {tickets.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border p-16 text-center">
            <LifeBuoy className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground italic">No tickets yet. Click <b>New ticket</b> to contact us.</p>
          </div>
        )}
        {tickets.map((t) => (
          <button key={t.id} onClick={() => openTicket(t)} className="block w-full rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-primary">{t.ticket_number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${STATUS_STYLES[t.status] || ""}`}>{t.status}</span>
                </div>
                <p className="mt-1 truncate font-bold">{t.subject || t.subcategory}</p>
                <p className="text-xs text-muted-foreground">{t.category} · {t.subcategory}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(t.updated_at).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Contact admin</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, subcategory: "" })}>
                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(CATEGORIES).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.category && (
              <div className="grid gap-2">
                <Label>Related problem</Label>
                <Select value={form.subcategory} onValueChange={(v) => setForm({ ...form, subcategory: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a problem" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES[form.category].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Subject (optional)</Label>
              <Input value={form.subject} maxLength={120} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue in detail" className="min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit ticket"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
