import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Send, Clock, CheckCircle, Search, Filter, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/support")({ component: AdminSupport });

function AdminSupport() {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected Ticket State
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Mobile: track which panel is visible
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  async function loadReports() {
    setLoading(true);
    let query = supabase.from("support_reports").select("*, profiles(full_name, college, tokens, blocked)");
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query.order("created_at", { ascending: false });
    setReports(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  // Realtime Messages for Selected Ticket
  useEffect(() => {
    if (!selectedReport) return;

    async function loadMessages() {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("report_id", selectedReport.id)
        .order("created_at", { ascending: true });
      setMessages(data ?? []);
    }

    loadMessages();

    const channel = supabase
      .channel(`admin_chat_messages_${selectedReport.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `report_id=eq.${selectedReport.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedReport]);

  // Realtime Ticket Listing Status / Inbox updates
  useEffect(() => {
    const channel = supabase
      .channel("admin_tickets_list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_reports" },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setSelectedReport((current: any) => {
              if (current && current.id === payload.new.id) return { ...current, status: payload.new.status };
              return current;
            });
          }
          loadReports();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !selectedReport) return;

    setSendingReply(true);
    const { error } = await supabase.from("support_messages").insert({
      report_id: selectedReport.id,
      sender_id: user?.id || null,
      is_admin_sender: true,
      message: replyText.trim()
    });
    setSendingReply(false);

    if (error) {
      toast.error(error.message);
    } else {
      setReplyText("");
      const { data } = await supabase.from("support_messages").select("*").eq("report_id", selectedReport.id).order("created_at", { ascending: true });
      setMessages(data ?? []);
    }
  }

  async function handleUpdateStatus(status: string) {
    if (!selectedReport) return;
    const { error } = await supabase.from("support_reports").update({ status }).eq("id", selectedReport.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Ticket status marked as ${status}`);
      setSelectedReport({ ...selectedReport, status });
      loadReports();
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "active": return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      case "ongoing": return "bg-orange-500/10 text-orange-500 border border-orange-500/20";
      case "processing": return "bg-purple-500/10 text-purple-500 border border-purple-500/20";
      case "completed": return "bg-success/10 text-success border border-success/20";
      case "ended": return "bg-muted text-muted-foreground border border-border";
      default: return "bg-secondary text-secondary-foreground";
    }
  }

  const filteredReports = reports.filter(r => {
    const text = searchTerm.toLowerCase();
    const name = r.profiles?.full_name?.toLowerCase() || "";
    const email = r.email.toLowerCase();
    const title = r.title.toLowerCase();
    return name.includes(text) || email.includes(text) || title.includes(text);
  });

  function openTicket(r: any) {
    setSelectedReport(r);
    setMobileView("chat");
  }

  // Shared chat messages + composer (used in both mobile and desktop views)
  function ChatMessages() {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-muted/5 min-h-0">
        <div className="flex flex-col gap-1 max-w-[90%] md:max-w-[85%] bg-muted/40 border p-4 rounded-2xl">
          <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
            <Clock className="h-3 w-3" /> Complaint description
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{selectedReport?.description}</p>
        </div>
        {messages.map((m) => {
          const isAdminMsg = m.is_admin_sender;
          return (
            <div
              key={m.id}
              className={`flex flex-col gap-1 max-w-[90%] md:max-w-[85%] p-4 rounded-2xl ${
                isAdminMsg ? "bg-card border ml-auto rounded-tr-none" : "bg-primary text-primary-foreground mr-auto rounded-tl-none shadow-md shadow-primary/10"
              }`}
            >
              <p className={`text-[10px] font-bold uppercase ${isAdminMsg ? 'text-muted-foreground' : 'text-primary-foreground/75'}`}>
                {isAdminMsg ? "You (Admin)" : (selectedReport?.profiles?.full_name || "User")}
              </p>
              <p className="text-sm mt-1 break-words">{m.message}</p>
            </div>
          );
        })}
      </div>
    );
  }

  function ChatComposer() {
    return (
      <div className="p-3 md:p-4 border-t border-border bg-card shrink-0">
        {selectedReport && ['completed', 'ended'].includes(selectedReport.status) ? (
          <p className="text-xs text-muted-foreground text-center py-2 italic flex items-center justify-center gap-1">
            <CheckCircle className="h-4 w-4 text-success" /> This ticket is marked closed. Re-open status to chat.
          </p>
        ) : (
          <form onSubmit={handleSendReply} className="flex gap-2">
            <Input
              placeholder="Type admin response here..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              disabled={sendingReply}
              className="flex-1 min-w-0"
            />
            <Button type="submit" disabled={sendingReply || !replyText.trim()} className="rounded-xl px-4 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="font-display text-2xl font-bold">Complaints &amp; Reports</h1>
        <p className="text-sm text-muted-foreground italic">Manage user feedback, technical complaints, and support requests.</p>
      </div>

      {/* ── MOBILE CHAT VIEW ── */}
      {mobileView === "chat" && selectedReport && (
        <div className="md:hidden flex flex-col rounded-3xl border border-border shadow-soft overflow-hidden bg-card" style={{ height: "calc(100dvh - 9rem)" }}>
          {/* Mobile Chat Header */}
          <div className="shrink-0 border-b border-border bg-muted/20">
            {/* Top row: back + title + badge */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
              <button
                onClick={() => setMobileView("list")}
                className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground shrink-0"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{selectedReport.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {selectedReport.profiles?.full_name || "Anonymous"} · {selectedReport.email}
                </p>
              </div>
              <Badge className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(selectedReport.status)}`}>
                {selectedReport.status}
              </Badge>
            </div>
            {/* Status change row */}
            <div className="px-4 pb-3">
              <Select value={selectedReport.status} onValueChange={handleUpdateStatus}>
                <SelectTrigger className="rounded-xl font-bold uppercase text-[10px] h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ChatMessages />
          <ChatComposer />
        </div>
      )}

      {/* ── SPLIT PANE (desktop) / LIST (mobile when chat not open) ── */}
      <div className={`grid gap-8 md:grid-cols-12 ${mobileView === "chat" && selectedReport ? "hidden md:grid" : ""}`}>
        {/* Left: Ticket Directory */}
        <div className="md:col-span-5 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user or email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
            <div className="w-[130px] shrink-0">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl">
                  <Filter className="h-3.5 w-3.5 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground animate-pulse text-center py-10">Loading tickets...</p>
            ) : filteredReports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 italic">No tickets match criteria.</p>
            ) : (
              filteredReports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openTicket(r)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedReport?.id === r.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/40 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase truncate max-w-[60%]">{r.profiles?.full_name || "Anonymous User"}</span>
                    <Badge className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(r.status)}`}>{r.status}</Badge>
                  </div>
                  <p className="text-sm font-semibold mt-2 line-clamp-1 text-foreground">{r.title}</p>
                  <div className="flex items-center justify-between mt-3 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                    <span className="truncate max-w-[60%]">{r.email}</span>
                    <span className="shrink-0">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 md:hidden">Tap to open chat →</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Chat Box (desktop) */}
        <div className="md:col-span-7 hidden md:flex md:flex-col">
          {selectedReport ? (
            <Card className="rounded-3xl border border-border shadow-soft flex flex-col overflow-hidden flex-1" style={{ maxHeight: "min(580px, calc(100vh - 12rem))" }}>
              <CardHeader className="border-b border-border bg-muted/20 shrink-0">
                <div className="flex items-start gap-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg font-bold truncate">{selectedReport.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      User: <b>{selectedReport.profiles?.full_name || "Anonymous"}</b> ({selectedReport.email})
                    </CardDescription>
                  </div>
                  <div className="w-[140px] shrink-0">
                    <Select value={selectedReport.status} onValueChange={handleUpdateStatus}>
                      <SelectTrigger className="rounded-xl font-bold uppercase text-[10px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="ongoing">Ongoing</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="ended">Ended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <ChatMessages />
              <ChatComposer />
            </Card>
          ) : (
            <div className="min-h-[400px] rounded-3xl border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center text-center p-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg">No Complaint Selected</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">Select a filed complaint from the left panel to review its details, modify status, and send chat responses.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
