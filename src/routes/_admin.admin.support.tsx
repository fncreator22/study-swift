import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, LifeBuoy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/support")({ component: AdminSupport });

const STATUSES = ["open", "processing", "waiting", "resolved", "closed"];
const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-600",
  processing: "bg-amber-500/10 text-amber-600",
  waiting: "bg-purple-500/10 text-purple-600",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

function AdminSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState<any | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [reply, setReply] = useState("");

  async function load() {
    const { data } = await supabase
      .from("support_tickets" as any)
      .select("*, profiles!support_tickets_user_id_fkey(full_name,email,college)")
      .order("updated_at", { ascending: false });
    setTickets((data as any[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function openTicket(t: any) {
    setActive(t);
    const { data } = await supabase.from("ticket_replies" as any).select("*").eq("ticket_id", t.id).order("created_at");
    setReplies((data as any[]) ?? []);
  }

  async function sendReply() {
    if (!reply.trim() || !active || !user) return;
    const { error } = await supabase.from("ticket_replies" as any).insert({
      ticket_id: active.id, sender_id: user.id, message: reply.trim(), is_admin: true,
    });
    if (error) return toast.error(error.message);
    setReply("");
    openTicket(active);
    load();
  }

  async function changeStatus(status: string) {
    if (!active) return;
    const { error } = await supabase.from("support_tickets" as any).update({ status, updated_at: new Date().toISOString() }).eq("id", active.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    setActive({ ...active, status });
    load();
  }

  const visible = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  if (active) {
    return (
      <div className="mx-auto max-w-4xl">
        <button onClick={() => setActive(null)} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All tickets
        </button>
        <div className="mt-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono font-bold text-primary">{active.ticket_number}</p>
              <h1 className="mt-1 font-display text-xl font-bold">{active.subject || active.subcategory}</h1>
              <p className="text-xs text-muted-foreground">{active.category} · {active.subcategory}</p>
              <p className="mt-1 text-xs">From: <b>{active.profiles?.full_name || "User"}</b> · {active.profiles?.email}</p>
            </div>
            <Select value={active.status} onValueChange={changeStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <p className="mt-4 whitespace-pre-line rounded-2xl border border-border bg-muted/30 p-4 text-sm">{active.description}</p>
        </div>

        <div className="mt-6 space-y-3">
          {replies.map((r) => (
            <div key={r.id} className={`rounded-2xl border p-4 ${r.is_admin ? "border-primary/30 bg-primary/5 ml-8" : "border-border bg-card mr-8"}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{r.is_admin ? "Admin" : "User"}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-line text-sm">{r.message}</p>
            </div>
          ))}
        </div>

        {active.status !== "closed" && (
          <div className="mt-6 flex gap-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to user…" className="flex-1 rounded-2xl" />
            <Button onClick={sendReply} className="self-end rounded-xl"><Send className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground italic">User tickets & conversations.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-8 responsive-table-container rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-muted-foreground italic">
                <LifeBuoy className="mx-auto mb-3 h-8 w-8 opacity-30" />No tickets.
              </td></tr>
            )}
            {visible.map((t) => (
              <tr key={t.id} onClick={() => openTicket(t)} className="cursor-pointer transition-colors hover:bg-muted/30">
                <td className="px-4 py-3"><span className="font-mono text-xs text-primary">{t.ticket_number}</span><p className="mt-0.5 truncate font-bold">{t.subject || t.subcategory}</p></td>
                <td className="px-4 py-3">{t.profiles?.full_name || "—"}</td>
                <td className="px-4 py-3 text-xs">{t.category}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[t.status] || ""}`}>{t.status}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
