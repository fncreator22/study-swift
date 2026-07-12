import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, MessageSquare, Send, Clock, CheckCircle, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/support")({ component: SupportPage });

const PRE_WRITTEN_CATEGORIES = [
  "Delay in Token Request approval",
  "Unable to stream course videos",
  "Issue during exam submission",
  "Incorrect scoring or grading dispute",
  "Request to upgrade subscription tier",
  "Other custom inquiry"
];

function SupportPage() {
  const { user, isAdmin } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Ticket Form State
  const [category, setCategory] = useState(PRE_WRITTEN_CATEGORIES[0]);
  const [details, setDetails] = useState("");
  const [anonName, setAnonName] = useState("");
  const [anonEmail, setAnonEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Active Chat State
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const sendingReplyRef = useRef(false);

  // Mobile: track whether we're showing the chat panel
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  interface AnonCredential {
    id: string;
    token: string;
  }

  // Load ticket credentials from localStorage for anonymous users
  function getAnonCredentials(): AnonCredential[] {
    try {
      const raw = localStorage.getItem("anonymous_tickets");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item: any) => {
        if (typeof item === "string") {
          return { id: item, token: "" }; // Fallback format
        }
        return { id: item.id || "", token: item.token || "" };
      });
    } catch {
      return [];
    }
  }

  function saveAnonCredential(id: string, token: string) {
    const current = getAnonCredentials();
    localStorage.setItem("anonymous_tickets", JSON.stringify([...current, { id, token }]));
  }

  async function loadReports() {
    setLoading(true);
    try {
      const credentials = getAnonCredentials().filter(c => c.id && c.token);
      let anonData: any[] = [];
      if (credentials.length > 0) {
        const { data } = await supabase.rpc("get_anonymous_reports_bulk", { creds: credentials });
        anonData = data ?? [];
      }

      if (user) {
        const { data: regData } = await supabase
          .from("support_reports")
          .select("*")
          .eq("user_id", user.id);
        
        const combined = [...(regData ?? []), ...anonData];
        const unique = Array.from(new Map(combined.map(r => [r.id, r])).values());
        unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setReports(unique);
      } else {
        setReports(anonData);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [user]);

  // Messages load + anonymous polling
  useEffect(() => {
    if (!selectedReport) return;

    async function loadMessages() {
      const isOwnedTicket = user && selectedReport.user_id === user.id;
      if (isOwnedTicket) {
        const { data } = await supabase
          .from("support_messages")
          .select("*")
          .eq("report_id", selectedReport.id)
          .order("created_at", { ascending: true });
        setMessages(data ?? []);
      } else {
        const credentials = getAnonCredentials();
        const matchingCred = credentials.find(c => c.id === selectedReport.id);
        const token = matchingCred?.token || "";
        if (token) {
          const { data, error } = await supabase.rpc("get_anonymous_report_messages", {
            ticket_id: selectedReport.id,
            token: token
          });
          if (!error) setMessages(data ?? []);
        } else {
          setMessages([]);
        }
      }
    }

    loadMessages();
    const isOwnedTicket = user && selectedReport.user_id === user.id;
    if (!isOwnedTicket) {
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedReport, user]);

  // Realtime Messages for Authenticated Users
  useEffect(() => {
    if (!selectedReport || !user) return;

    const channel = supabase
      .channel(`chat_messages_${selectedReport.id}`)
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
  }, [selectedReport, user]);

  // Realtime Status Changes & Sidebar Updates for Authenticated Users
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`my_tickets_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_reports", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            setSelectedReport((current: any) => {
              if (current && current.id === payload.new.id) {
                return { ...current, status: payload.new.status };
              }
              return current;
            });
          }
          loadReports();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  function selectReport(r: any) {
    setSelectedReport(r);
    setMobileView("chat");
  }

  async function handleSubmitTicket(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!details.trim()) return toast.error("Please fill in complaint details.");

    let ticketEmail = user?.email || anonEmail;
    let ticketName = user?.user_metadata?.full_name || anonName;

    if (!ticketEmail.trim()) return toast.error("Email address is required.");
    if (!ticketName.trim()) return toast.error("Full name is required.");

    submittingRef.current = true;
    setSubmitting(true);

    try {
      if (user) {
        const { error } = await supabase
          .from("support_reports")
          .insert({
            user_id: user.id,
            email: ticketEmail,
            title: category,
            description: `Name: ${ticketName}\n\nDetails: ${details}`,
            status: "active"
          });
        if (error) toast.error(error.message);
        else { toast.success("Complaint filed successfully."); setDetails(""); loadReports(); }
      } else {
        const { data, error } = await supabase.rpc("create_anonymous_report", {
          p_email: ticketEmail,
          p_title: category,
          p_description: `Name: ${ticketName}\n\nDetails: ${details}`
        });
        if (error) toast.error(error.message);
        else {
          toast.success("Complaint filed successfully.");
          setDetails("");
          if (data && data.length > 0) saveAnonCredential(data[0].id, data[0].anonymous_token);
          loadReports();
        }
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !selectedReport) return;
    if (sendingReplyRef.current) return;

    sendingReplyRef.current = true;
    setSendingReply(true);

    try {
      const isOwnedTicket = user && selectedReport.user_id === user.id;
      if (isOwnedTicket) {
        const { error } = await supabase
          .from("support_messages")
          .insert({ report_id: selectedReport.id, sender_id: user.id, is_admin_sender: false, message: replyText.trim() });
        if (error) { toast.error(error.message); }
        else {
          setReplyText("");
          const { data } = await supabase.from("support_messages").select("*").eq("report_id", selectedReport.id).order("created_at", { ascending: true });
          setMessages(data ?? []);
        }
      } else {
        const credentials = getAnonCredentials();
        const token = credentials.find(c => c.id === selectedReport.id)?.token || "";
        if (!token) { toast.error("Unauthorized: Access token missing."); return; }
        const { error } = await supabase.rpc("send_anonymous_report_message", { ticket_id: selectedReport.id, token, message_text: replyText.trim() });
        if (error) { toast.error(error.message); }
        else {
          setReplyText("");
          const { data } = await supabase.rpc("get_anonymous_report_messages", { ticket_id: selectedReport.id, token });
          setMessages(data ?? []);
        }
      }
    } finally {
      sendingReplyRef.current = false;
      setSendingReply(false);
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

  // Shared Chat Panel JSX
  function ChatPanel({ compact = false }: { compact?: boolean }) {
    if (!selectedReport) return null;
    const p = compact ? "p-3" : "p-4";
    const msgP = compact ? "p-3" : "p-6";
    const maxW = compact ? "max-w-[90%]" : "max-w-[85%]";

    return (
      <>
        {/* Messages */}
        <div className={`flex-1 overflow-y-auto ${msgP} space-y-4 bg-muted/5 min-h-0`}>
          <div className={`flex flex-col gap-1 ${maxW} bg-muted/40 border p-4 rounded-2xl`}>
            <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Clock className="h-3 w-3" /> Report Submitted
            </p>
            <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{selectedReport.description}</p>
          </div>

          {messages.map((m) => {
            const isAdminMsg = m.is_admin_sender;
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-1 ${maxW} p-4 rounded-2xl ${
                  isAdminMsg
                    ? "bg-primary text-primary-foreground ml-auto rounded-tr-none shadow-md shadow-primary/10"
                    : "bg-card border mr-auto rounded-tl-none"
                }`}
              >
                <p className={`text-[10px] font-bold uppercase ${isAdminMsg ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                  {isAdminMsg ? "Admin Support" : "You"}
                </p>
                <p className="text-sm mt-1 break-words">{m.message}</p>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className={`${p} border-t border-border bg-card shrink-0`}>
          {['completed', 'ended'].includes(selectedReport.status) ? (
            <p className="text-xs text-muted-foreground text-center py-2 italic flex items-center justify-center gap-1">
              <CheckCircle className="h-4 w-4 text-success" /> This report has been closed. Chat is disabled.
            </p>
          ) : (
            <form onSubmit={handleSendReply} className="flex gap-2">
              <Input
                placeholder="Type your message..."
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
      </>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <Link to={isAdmin ? "/admin" : user ? "/dashboard" : "/"} className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to {isAdmin ? "Admin Panel" : user ? "Dashboard" : "Home"}
        </Link>
        <div className="text-right">
          <h1 className="font-display text-2xl font-bold">Help &amp; Support</h1>
          <p className="text-xs text-muted-foreground">Register complaints &amp; converse with admins.</p>
        </div>
      </div>

      {/* ── MOBILE CHAT VIEW (full-screen drill-in) ── */}
      {mobileView === "chat" && selectedReport && (
        <div className="md:hidden flex flex-col rounded-3xl border border-border shadow-soft overflow-hidden bg-card" style={{ height: "calc(100dvh - 9rem)" }}>
          {/* Mobile header with back button */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
            <button
              onClick={() => setMobileView("list")}
              className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground shrink-0"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{selectedReport.title}</p>
            </div>
            <Badge className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(selectedReport.status)}`}>
              {selectedReport.status}
            </Badge>
          </div>
          <ChatPanel compact />
        </div>
      )}

      {/* ── LIST + FORM (always visible on desktop; hidden on mobile when chat is open) ── */}
      <div className={`grid gap-8 md:grid-cols-12 ${mobileView === "chat" && selectedReport ? "hidden md:grid" : ""}`}>
        {/* Left: Form & Ticket List */}
        <div className="md:col-span-5 space-y-6">
          <Card className="rounded-3xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-primary" /> File a Complaint
              </CardTitle>
              <CardDescription>Select a category and detail your issue. The admin will respond shortly.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                {!user && (
                  <>
                    <div className="space-y-2">
                      <Label>Your Full Name</Label>
                      <Input placeholder="John Doe" value={anonName} onChange={e => setAnonName(e.target.value)} required disabled={submitting} />
                    </div>
                    <div className="space-y-2">
                      <Label>Your Email Address</Label>
                      <Input type="email" placeholder="john@example.com" value={anonEmail} onChange={e => setAnonEmail(e.target.value)} required disabled={submitting} />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Inquiry Category</Label>
                  <Select value={category} onValueChange={setCategory} disabled={submitting}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRE_WRITTEN_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description / Details</Label>
                  <Textarea rows={4} placeholder="Provide details about your query..." value={details} onChange={e => setDetails(e.target.value)} required disabled={submitting} />
                </div>
                <Button type="submit" disabled={submitting} className="w-full rounded-xl">
                  {submitting ? "Submitting..." : "Submit Complaint"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Filed Tickets List */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm text-muted-foreground uppercase tracking-wider">Your Filed Complaints</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading reports...</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No tickets filed yet.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectReport(r)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedReport?.id === r.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/40 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">{new Date(r.created_at).toLocaleDateString()}</span>
                      <Badge className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(r.status)}`}>{r.status}</Badge>
                    </div>
                    <p className="text-sm font-semibold mt-2 line-clamp-1 text-foreground">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 md:hidden">Tap to open chat →</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat Box (desktop only) */}
        <div className="md:col-span-7 hidden md:flex md:flex-col">
          {selectedReport ? (
            <Card className="rounded-3xl border border-border shadow-soft flex flex-col overflow-hidden flex-1" style={{ maxHeight: "min(580px, calc(100vh - 12rem))" }}>
              <CardHeader className="border-b border-border bg-muted/20 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg font-bold truncate">{selectedReport.title}</CardTitle>
                    <CardDescription className="line-clamp-1 mt-1 text-xs">
                      {selectedReport.description.split("\n\nDetails: ")[1] || selectedReport.description}
                    </CardDescription>
                  </div>
                  <Badge className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${getStatusColor(selectedReport.status)}`}>
                    {selectedReport.status}
                  </Badge>
                </div>
              </CardHeader>
              <ChatPanel />
            </Card>
          ) : (
            <div className="min-h-[400px] rounded-3xl border border-dashed border-border bg-muted/10 flex flex-col items-center justify-center text-center p-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg">No Ticket Selected</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-1">Select a filed complaint from the list to view the status, check progress, and chat with admins.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
