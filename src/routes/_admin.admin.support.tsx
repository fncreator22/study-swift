import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  MessageSquare, Send, Clock, CheckCircle, Search, Filter, 
  ChevronLeft, BarChart3, Database, Sparkles, BookOpen, Settings,
  AlertTriangle, Check, User, Plus, Trash2, ArrowUpRight, HelpCircle,
  Download, Upload, Heart, RefreshCw, X, ShieldAlert
} from "lucide-react";
import { 
  KBArticle, AIRule, tokenize, matchKBArticle, matchAIRules 
} from "@/lib/support-assistant";

export const Route = createFileRoute("/_admin/admin/support")({ component: AdminSupportV2 });

const SUPPORT_CATEGORIES = [
  "Login Issues", "Registration", "Password Reset", "Account", "Profile",
  "Subscription", "Tokens", "Payments", "Marketplace", "Courses",
  "Course Progress", "Course Assessment", "Mock Test", "Certificates",
  "Leaderboard", "Technical Issues", "Bugs", "Feature Request", "Security", "Other"
];

function AdminSupportV2() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"inbox" | "analytics" | "kb" | "rules" | "learning">("inbox");
  const [reports, setReports] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // guest, registered, assigned_to_me
  
  // Selected ticket chat state
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Selected ticket details (Student history context)
  const [studentPurchases, setStudentPurchases] = useState<any[]>([]);
  const [studentCertificates, setStudentCertificates] = useState<any[]>([]);
  const [studentPreviousTicketsCount, setStudentPreviousTicketsCount] = useState(0);

  // KB State
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([]);
  const [kbSearchTerm, setKbSearchTerm] = useState("");
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [isKbModalOpen, setIsKbModalOpen] = useState(false);
  const [kbForm, setKbForm] = useState({
    title: "", category: "Login Issues", keywords: "", trigger_phrases: "",
    confidence_weight: 1.0, suggested_response: "", troubleshooting_steps: "", status: "active" as "active" | "inactive"
  });

  // AI Rules State
  const [aiRules, setAiRules] = useState<AIRule[]>([]);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    rule_name: "", trigger_type: "keyword" as "keyword" | "category" | "fallback" | "decision_tree",
    keywords: "", category: "Login Issues", response_text: "", action_type: "respond" as "respond" | "escalate" | "ask_followup",
    confidence_score: 1.0, status: "active" as "active" | "inactive"
  });

  // Sandbox State
  const [sandboxQuery, setSandboxQuery] = useState("");
  const [sandboxResults, setSandboxResults] = useState<any>(null);

  // Learning Suggestions State
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Load All Tickets & Admins
  async function loadInitialData() {
    setLoading(true);
    try {
      // 1. Fetch tickets with profile info
      const { data: reps, error } = await supabase
        .from("support_reports")
        .select("*, profiles:profiles!support_reports_user_id_fkey(full_name, college, tokens, blocked, membership_status)")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[LoadInitialData] Error fetching reports:", error.message, error.details, error.hint);
      }
      setReports(reps ?? []);

      // 2. Fetch all administrators from profiles (e.g. has role admin)
      // Since we don't have a direct role query without RLS functions, we fetch profiles.
      // For this prototype, we'll let admins be assigned to other admins (or anyone).
      const { data: profs } = await supabase.from("profiles").select("id, full_name");
      setAdmins(profs ?? []);
    } catch (err: any) {
      toast.error("Failed to load dashboard data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load KB Articles
  async function loadKbArticles() {
    const { data } = await supabase.from("support_kb_articles").select("*").order("created_at", { ascending: false });
    setKbArticles(data ?? []);
  }

  // Load AI Rules
  async function loadAiRules() {
    const { data } = await supabase.from("support_ai_rules").select("*").order("created_at", { ascending: false });
    setAiRules(data ?? []);
  }

  // Load AI Learning Suggestions
  async function loadSuggestions() {
    const { data } = await supabase.from("support_ai_learning_suggestions").select("*").order("created_at", { ascending: false });
    setSuggestions(data ?? []);
  }

  useEffect(() => {
    loadInitialData();
    loadKbArticles();
    loadAiRules();
    loadSuggestions();
  }, []);

  // Poll learning engine suggestions generation
  async function runLearningEngine() {
    // Collect escalated or unresolved support tickets
    const openTickets = reports.filter(r => r.status !== 'Closed' && r.status !== 'Resolved');
    if (openTickets.length < 2) {
      return toast.info("Not enough ticket data to generate suggestions. Requires at least 2 open tickets.");
    }

    // Tokenize ticket descriptions
    const wordCounts: Record<string, number> = {};
    openTickets.forEach(t => {
      const tokens = tokenize(t.description);
      tokens.forEach(tok => {
        if (tok.length > 3) {
          wordCounts[tok] = (wordCounts[tok] || 0) + 1;
        }
      });
    });

    // Find keywords appearing >= 2 times that are NOT currently in KB keywords
    const currentKeywords = new Set(kbArticles.flatMap(a => a.keywords || []).map(k => k.toLowerCase()));
    const candidates = Object.entries(wordCounts)
      .filter(([word, count]) => count >= 2 && !currentKeywords.has(word))
      .sort((a, b) => b[1] - a[1]);

    if (candidates.length === 0) {
      return toast.info("Learning engine run complete. No new keyword trends identified.");
    }

    let createdCount = 0;
    for (const [word, count] of candidates.slice(0, 3)) {
      // Check if suggestion already exists
      const isDuplicate = suggestions.some(s => s.status === 'pending' && s.suggested_content?.keywords?.includes(word));
      if (isDuplicate) continue;

      const proposedTitle = `How to resolve issues relating to '${word}'`;
      const proposedResponse = `We have noticed frequent inquiries regarding '${word}'. This solution is currently being compiled by our admin team. Please try troubleshooting basic settings or contact support.`;
      
      const { error } = await supabase.from("support_ai_learning_suggestions").insert({
        type: "new_article",
        source_data: { word, count, occurrences: count },
        suggested_content: {
          title: proposedTitle,
          category: "Technical Issues",
          keywords: [word],
          trigger_phrases: [word, `${word} issue`, `cannot ${word}`],
          confidence_weight: 0.8,
          suggested_response: proposedResponse
        },
        status: "pending"
      });

      if (!error) createdCount++;
    }

    if (createdCount > 0) {
      toast.success(`Learning engine identified ${createdCount} new topic suggestions!`);
      loadSuggestions();
    } else {
      toast.info("Learning engine run complete. No new suggestions needed.");
    }
  }

  // Poll/Subscribe Selected Ticket Messages
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

    async function loadStudentContext() {
      if (!selectedReport.user_id) {
        setStudentPurchases([]);
        setStudentCertificates([]);
        setStudentPreviousTicketsCount(0);
        return;
      }

      // Fetch user's packages
      const { data: purch } = await supabase
        .from("purchases")
        .select("id, courses(title), tests(title)")
        .eq("user_id", selectedReport.user_id);
      setStudentPurchases(purch ?? []);

      // Fetch user's certificates
      const { data: certs } = await supabase
        .from("certificates")
        .select("id, courses(title)")
        .eq("user_id", selectedReport.user_id);
      setStudentCertificates(certs ?? []);

      // Fetch user's previous tickets count
      const { count } = await supabase
        .from("support_reports")
        .select("*", { count: "exact", head: true })
        .eq("user_id", selectedReport.user_id);
      setStudentPreviousTicketsCount(count ? count - 1 : 0);
    }

    loadMessages();
    loadStudentContext();

    const channel = supabase
      .channel(`admin_chat_thread_${selectedReport.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `report_id=eq.${selectedReport.id}` },
        (payload) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedReport]);

  // Reply to ticket
  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !selectedReport) return;

    setSendingReply(true);
    try {
      const { error } = await supabase.from("support_messages").insert({
        report_id: selectedReport.id,
        sender_id: user?.id || null,
        is_admin_sender: true,
        message: replyText.trim()
      });

      if (error) throw error;
      setReplyText("");
      
      // Update ticket status to Waiting for User if Open
      if (selectedReport.status === 'Open') {
        await handleUpdateStatus('Waiting for User');
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingReply(false);
    }
  }

  // Update Ticket Status
  async function handleUpdateStatus(status: string) {
    if (!selectedReport) return;
    try {
      const updatePayload: any = { status };
      if (status === 'Resolved' || status === 'Closed') {
        // Compute resolution time if resolved
        const createdTime = new Date(selectedReport.created_at).getTime();
        const now = Date.now();
        updatePayload.resolution_time = Math.round((now - createdTime) / 1000); // seconds
      }

      const { error } = await supabase.from("support_reports").update(updatePayload).eq("id", selectedReport.id);
      if (error) throw error;

      setSelectedReport(prev => ({ ...prev, ...updatePayload }));
      loadInitialData();
      toast.success(`Ticket status updated to ${status}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  }

  // Assign Ticket Admin
  async function handleAssignAdmin(adminId: string) {
    if (!selectedReport) return;
    try {
      const { error } = await supabase.from("support_reports").update({ 
        assigned_to: adminId || null,
        status: adminId ? 'Assigned' : 'Open'
      }).eq("id", selectedReport.id);

      if (error) throw error;
      setSelectedReport(prev => ({ ...prev, assigned_to: adminId, status: adminId ? 'Assigned' : 'Open' }));
      loadInitialData();
      toast.success("Ticket assignment updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to assign admin");
    }
  }

  // Update Ticket Priority
  async function handleUpdatePriority(prio: string) {
    if (!selectedReport) return;
    try {
      const { error } = await supabase.from("support_reports").update({ priority: prio }).eq("id", selectedReport.id);
      if (error) throw error;
      setSelectedReport(prev => ({ ...prev, priority: prio }));
      loadInitialData();
      toast.success("Priority updated to " + prio);
    } catch (err: any) {
      toast.error("Failed to update priority: " + err.message);
    }
  }

  // Merge ticket duplicates
  async function handleMergeTicket(targetId: string) {
    if (!selectedReport || !targetId) return;
    try {
      // Append historical description to target ticket
      const { data: target } = await supabase.from("support_reports").select("*").eq("id", targetId).maybeSingle();
      if (!target) return toast.error("Target ticket not found");

      const newDesc = `${target.description}\n\n[Merged Ticket ${selectedReport.id.slice(0,8)} Description]:\n${selectedReport.description}`;
      await supabase.from("support_reports").update({ description: newDesc }).eq("id", targetId);

      // Move messages from selected to target
      await supabase.from("support_messages").update({ report_id: targetId }).eq("report_id", selectedReport.id);

      // Close/Resolve current ticket
      await supabase.from("support_reports").update({ status: "Closed", archived: true }).eq("id", selectedReport.id);

      setSelectedReport(null);
      loadInitialData();
      toast.success("Tickets merged successfully!");
    } catch (err: any) {
      toast.error("Merge failed: " + err.message);
    }
  }

  // Archive Ticket
  async function handleArchiveTicket(arch: boolean) {
    if (!selectedReport) return;
    try {
      const { error } = await supabase.from("support_reports").update({ archived: arch }).eq("id", selectedReport.id);
      if (error) throw error;
      setSelectedReport(prev => ({ ...prev, archived: arch }));
      loadInitialData();
      toast.success(arch ? "Ticket archived" : "Ticket unarchived");
    } catch (err: any) {
      toast.error("Failed to archive: " + err.message);
    }
  }

  // Delete Ticket
  async function handleDeleteTicket() {
    if (!selectedReport) return;
    if (!confirm("Are you sure you want to permanently delete this archived ticket?")) return;

    try {
      const { error } = await supabase.from("support_reports").delete().eq("id", selectedReport.id);
      if (error) throw error;
      setSelectedReport(null);
      loadInitialData();
      toast.success("Ticket permanently deleted");
    } catch (err: any) {
      toast.error("Deletion failed: " + err.message);
    }
  }

  // KB article submit
  async function handleKbSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kbForm.title || !kbForm.suggested_response) {
      return toast.error("Please fill in Title and Response fields.");
    }

    try {
      const kw = kbForm.keywords.split(",").map(k => k.trim()).filter(Boolean);
      const tp = kbForm.trigger_phrases.split(",").map(t => t.trim()).filter(Boolean);
      
      const payload = {
        title: kbForm.title,
        category: kbForm.category,
        keywords: kw,
        trigger_phrases: tp,
        confidence_weight: Number(kbForm.confidence_weight),
        suggested_response: kbForm.suggested_response,
        troubleshooting_steps: kbForm.troubleshooting_steps,
        status: kbForm.status
      };

      if (editingArticle) {
        const { error } = await supabase.from("support_kb_articles").update(payload).eq("id", editingArticle.id);
        if (error) throw error;
        toast.success("KB article updated successfully!");
      } else {
        const { error } = await supabase.from("support_kb_articles").insert(payload);
        if (error) throw error;
        toast.success("KB article created successfully!");
      }

      setIsKbModalOpen(false);
      setEditingArticle(null);
      loadKbArticles();
    } catch (err: any) {
      toast.error(err.message || "Failed to save article");
    }
  }

  // KB Article Import / Export
  function exportKbArticles() {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(kbArticles, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `examly_support_kb_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Knowledge Base articles exported successfully.");
  }

  async function handleImportKb(e: React.ChangeEvent<HTMLInputElement>) {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!Array.isArray(parsed)) throw new Error("JSON file must be an array of articles.");
          
          let importCount = 0;
          for (const item of parsed) {
            const { error } = await supabase.from("support_kb_articles").insert({
              title: item.title,
              category: item.category || "Other",
              keywords: item.keywords || [],
              trigger_phrases: item.trigger_phrases || [],
              confidence_weight: Number(item.confidence_weight || 1.0),
              suggested_response: item.suggested_response,
              troubleshooting_steps: item.troubleshooting_steps || "",
              status: item.status || "active"
            });
            if (!error) importCount++;
          }
          toast.success(`Successfully imported ${importCount} articles!`);
          loadKbArticles();
        } catch (err: any) {
          toast.error("Import failed: " + err.message);
        }
      };
    }
  }

  // AI Rule submit
  async function handleRuleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleForm.rule_name || !ruleForm.response_text) {
      return toast.error("Fill in rule name and response text.");
    }

    try {
      const kw = ruleForm.keywords.split(",").map(k => k.trim()).filter(Boolean);
      const payload = {
        rule_name: ruleForm.rule_name,
        trigger_type: ruleForm.trigger_type,
        conditions: { keywords: kw, category: ruleForm.category },
        response_text: ruleForm.response_text,
        action_type: ruleForm.action_type,
        confidence_score: Number(ruleForm.confidence_score),
        status: ruleForm.status
      };

      if (editingRule) {
        const { error } = await supabase.from("support_ai_rules").update(payload).eq("id", editingRule.id);
        if (error) throw error;
        toast.success("AI rule updated successfully!");
      } else {
        const { error } = await supabase.from("support_ai_rules").insert(payload);
        if (error) throw error;
        toast.success("AI rule created successfully!");
      }

      setIsRuleModalOpen(false);
      setEditingRule(null);
      loadAiRules();
    } catch (err: any) {
      toast.error(err.message || "Failed to save rule");
    }
  }

  // Testing Sandbox Console
  async function runSandboxTest() {
    if (!sandboxQuery.trim()) return;

    const { rule, response } = await matchAIRules(sandboxQuery);
    const { article, score } = await matchKBArticle(sandboxQuery);

    setSandboxResults({
      matchedRule: rule,
      ruleResponse: response,
      matchedArticle: article,
      articleScore: score,
      chosenAction: rule ? rule.action_type : (article && score >= 0.3 ? 'respond' : 'fallback'),
      finalResponse: rule ? response : (article && score >= 0.3 ? article.suggested_response : "Fallback response: Transfer user to agent.")
    });
  }

  // Approve learning suggestion
  async function handleApproveSuggestion(sug: any) {
    try {
      const payload = sug.suggested_content;
      // Add proposed article to KB
      const { error } = await supabase.from("support_kb_articles").insert({
        title: payload.title,
        category: payload.category,
        keywords: payload.keywords,
        trigger_phrases: payload.trigger_phrases,
        confidence_weight: payload.confidence_weight,
        suggested_response: payload.suggested_response,
        troubleshooting_steps: payload.troubleshooting_steps || "",
        status: "active"
      });

      if (error) throw error;

      // Update suggestion status to approved
      await supabase.from("support_ai_learning_suggestions").update({ status: "approved", resolved_at: new Date() }).eq("id", sug.id);
      
      toast.success("Learning suggestion approved and article created!");
      loadKbArticles();
      loadSuggestions();
    } catch (err: any) {
      toast.error("Approval failed: " + err.message);
    }
  }

  // Reject learning suggestion
  async function handleRejectSuggestion(id: string) {
    try {
      await supabase.from("support_ai_learning_suggestions").update({ status: "rejected", resolved_at: new Date() }).eq("id", id);
      toast.success("Suggestion rejected.");
      loadSuggestions();
    } catch (err: any) {
      toast.error("Failed to reject suggestion: " + err.message);
    }
  }

  // Filter inbox tickets list
  const filteredReports = reports.filter(r => {
    const text = searchTerm.toLowerCase();
    const matchesSearch = r.title.toLowerCase().includes(text) || r.email.toLowerCase().includes(text) || r.id.toLowerCase().includes(text);
    if (!matchesSearch) return false;

    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;

    if (typeFilter === "guest" && r.user_id !== null) return false;
    if (typeFilter === "registered" && r.user_id === null) return false;
    if (typeFilter === "assigned_to_me" && r.assigned_to !== user?.id) return false;

    return true;
  });

  // Calculate Metrics for Analytics Tab
  const totalTickets = reports.length;
  const openTickets = reports.filter(r => ['Open', 'Assigned', 'In Review', 'In Progress', 'Waiting for User'].includes(r.status)).length;
  const closedTickets = reports.filter(r => ['Closed', 'Rejected'].includes(r.status)).length;
  const resolvedTicketsCount = reports.filter(r => r.status === 'Resolved').length;

  const ticketsCreatedToday = reports.filter(r => {
    const date = new Date(r.created_at);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }).length;

  const totalResolutionTime = reports
    .filter(r => r.resolution_time)
    .reduce((acc, r) => acc + Number(r.resolution_time), 0);

  const avgResolutionTime = resolvedTicketsCount > 0 
    ? Math.round(totalResolutionTime / resolvedTicketsCount) 
    : 0; // seconds

  const ratedTickets = reports.filter(r => r.satisfaction_rating);
  const totalSatisfaction = ratedTickets.reduce((acc, r) => acc + Number(r.satisfaction_rating), 0);
  const avgSatisfaction = ratedTickets.length > 0 
    ? (totalSatisfaction / ratedTickets.length).toFixed(1) 
    : "N/A";

  const totalConversations = reports.filter(r => r.assistant_attempted).length;
  const assistantResolved = reports.filter(r => r.assistant_resolved).length;
  const assistantAccuracy = totalConversations > 0 
    ? Math.round((assistantResolved / totalConversations) * 100) 
    : 0;

  function getStatusBadge(status: string) {
    switch (status) {
      case "Open": return <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full font-bold text-[9px] uppercase px-2">Open</Badge>;
      case "In Progress": return <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full font-bold text-[9px] uppercase px-2">In Progress</Badge>;
      case "In Review": return <Badge className="bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-full font-bold text-[9px] uppercase px-2">In Review</Badge>;
      case "Waiting for User": return <Badge className="bg-pink-500/10 text-pink-500 border border-pink-500/20 rounded-full font-bold text-[9px] uppercase px-2">Waiting for User</Badge>;
      case "Assigned": return <Badge className="bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-full font-bold text-[9px] uppercase px-2">Assigned</Badge>;
      case "Resolved": return <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full font-bold text-[9px] uppercase px-2">Resolved</Badge>;
      case "Closed": return <Badge className="bg-neutral-500/10 text-neutral-500 border border-neutral-500/20 rounded-full font-bold text-[9px] uppercase px-2">Closed</Badge>;
      case "Rejected": return <Badge className="bg-destructive/10 text-destructive border border-destructive/20 rounded-full font-bold text-[9px] uppercase px-2">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-black text-foreground">Support Control Center</h1>
          <p className="text-xs text-muted-foreground mt-1">Manage ticket queues, review AI configurations, sandbox test queries, and audit suggestions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="xs" onClick={() => loadInitialData()} className="rounded-xl font-bold bg-muted hover:bg-muted/70 text-foreground">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reload
          </Button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border mb-6">
        {[
          { id: "inbox", label: "Ticket Inbox", icon: MessageSquare },
          { id: "analytics", label: "Analytics Dashboard", icon: BarChart3 },
          { id: "kb", label: "Knowledge Base", icon: BookOpen },
          { id: "rules", label: "AI Config & Sandbox", icon: Sparkles },
          { id: "learning", label: "Learning Engine Suggestions", icon: Database }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === t.id 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: INBOX ── */}
      {activeTab === "inbox" && (
        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Left: list directory */}
          <div className="lg:col-span-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search user, email, or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 rounded-xl h-9 text-xs" />
                </div>
              </div>
              <div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 rounded-xl text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Assigned">Assigned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="In Review">In Review</SelectItem>
                    <SelectItem value="Waiting for User">Waiting for User</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-8 rounded-xl text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 rounded-xl text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="guest">Guest Tickets</SelectItem>
                    <SelectItem value="registered">Registered</SelectItem>
                    <SelectItem value="assigned_to_me">Assigned to Me</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <p className="text-xs text-muted-foreground animate-pulse text-center py-12">Syncing support registry...</p>
            ) : filteredReports.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-12 bg-muted/10 border border-dashed rounded-2xl">No tickets found matching criteria.</p>
            ) : (
              <div className="space-y-2">
                {filteredReports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReport(r)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedReport?.id === r.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/40 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase truncate max-w-[120px]">{r.profiles?.full_name || "Guest Visitor"}</span>
                        {r.user_id ? (
                          <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Student</span>
                        ) : (
                          <span className="bg-orange-500/10 text-orange-600 border border-orange-500/20 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Guest</span>
                        )}
                        {r.archived && (
                          <span className="bg-neutral-500/10 text-neutral-600 border border-neutral-500/20 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Archived</span>
                        )}
                      </div>
                      {getStatusBadge(r.status)}
                    </div>
                    <p className="text-xs font-semibold mt-2 line-clamp-1 text-foreground">{r.title}</p>
                    <div className="flex items-center justify-between mt-2.5 border-t border-border/50 pt-2 text-[9px] text-muted-foreground">
                      <span className="truncate max-w-[65%]">{r.email}</span>
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Selected Ticket Detail & Chat thread */}
          <div className="lg:col-span-7">
            {selectedReport ? (
              <div className="grid gap-6">
                <Card className="rounded-3xl border border-border shadow-soft flex flex-col overflow-hidden h-[500px] bg-card">
                  <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between p-4 shrink-0">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-bold truncate text-foreground">{selectedReport.title}</CardTitle>
                      <CardDescription className="text-[10px] mt-0.5">
                        ID: <b>{selectedReport.id}</b> · Cat: <b>{selectedReport.category}</b>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={selectedReport.priority} onValueChange={handleUpdatePriority}>
                        <SelectTrigger className="h-7 text-[9px] font-bold w-24 rounded-lg capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={selectedReport.status} onValueChange={handleUpdateStatus}>
                        <SelectTrigger className="h-7 text-[9px] font-bold w-32 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="Assigned">Assigned</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="In Review">In Review</SelectItem>
                          <SelectItem value="Waiting for User">Waiting for User</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                          <SelectItem value="Rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>

                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5 min-h-0">
                    <div className="flex flex-col gap-1 max-w-[85%] bg-muted/40 border p-3 rounded-2xl">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Initial Complaint Description
                      </p>
                      <p className="text-xs text-foreground whitespace-pre-wrap mt-1">{selectedReport.description}</p>
                      
                      {selectedReport.phone && <p className="text-[10px] mt-1 text-muted-foreground">Phone: <b>{selectedReport.phone}</b></p>}
                      {selectedReport.country && <p className="text-[10px] text-muted-foreground">Country: <b>{selectedReport.country}</b></p>}

                      {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                        <div className="mt-3 border-t border-border pt-2 space-y-1">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Attachments:</p>
                          {selectedReport.attachments.map((file: any, idx: number) => (
                            <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-primary hover:underline truncate">
                              📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {messages.map((m) => {
                      const isAdminMsg = m.is_admin_sender;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col gap-1 max-w-[85%] p-3 rounded-2xl ${
                            isAdminMsg
                              ? "bg-card border ml-auto rounded-tr-none"
                              : "bg-primary text-primary-foreground mr-auto rounded-tl-none shadow-md"
                          }`}
                        >
                          <p className={`text-[8px] font-bold uppercase ${isAdminMsg ? 'text-muted-foreground' : 'text-primary-foreground/75'}`}>
                            {isAdminMsg ? "You (Admin)" : (selectedReport.profiles?.full_name || "User")}
                          </p>
                          <p className="text-xs mt-1 break-words">{m.message}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chat composer */}
                  <div className="p-3 border-t border-border bg-card shrink-0">
                    <form onSubmit={handleSendReply} className="flex gap-2">
                      <Input
                        placeholder="Type response to user..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        disabled={sendingReply}
                        className="flex-1 min-w-0 rounded-xl"
                      />
                      <Button type="submit" disabled={sendingReply || !replyText.trim()} className="rounded-xl px-4 shrink-0 font-bold bg-primary text-primary-foreground">
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </Card>

                {/* Ticket Context Metadata (Details Sidebar) */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Student Context Card */}
                  <Card className="rounded-3xl border border-border shadow-soft bg-card overflow-hidden">
                    <CardHeader className="bg-muted/10 p-4 border-b border-border">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Student Profile context</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      {selectedReport.user_id ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Full Name:</span>
                            <span className="font-semibold text-foreground">{selectedReport.profiles?.full_name || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subscription tier:</span>
                            <Badge variant="outline" className="uppercase font-bold text-[9px] bg-primary/5 text-primary border-primary/20">{selectedReport.profiles?.membership_status || "Free"}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">College:</span>
                            <span className="font-semibold text-foreground">{selectedReport.profiles?.college || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tokens:</span>
                            <span className="font-bold text-foreground">{selectedReport.profiles?.tokens || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Previous tickets:</span>
                            <span className="font-bold text-foreground">{studentPreviousTicketsCount}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground italic text-center py-4">Guest users do not have a registered profile card.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Student Courses & Certificates */}
                  <Card className="rounded-3xl border border-border shadow-soft bg-card overflow-hidden">
                    <CardHeader className="bg-muted/10 p-4 border-b border-border">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Courses &amp; Certificates</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-[11px] max-h-36 overflow-y-auto">
                      {selectedReport.user_id ? (
                        <>
                          {studentPurchases.length > 0 && (
                            <div>
                              <p className="font-bold text-foreground uppercase text-[9px] text-muted-foreground mb-1">Purchases:</p>
                              {studentPurchases.map((p, i) => (
                                <div key={i} className="truncate">• {p.courses?.title || p.tests?.title || "Item"}</div>
                              ))}
                            </div>
                          )}
                          {studentCertificates.length > 0 && (
                            <div className="border-t pt-2 mt-2">
                              <p className="font-bold text-foreground uppercase text-[9px] text-muted-foreground mb-1">Certificates:</p>
                              {studentCertificates.map((c, i) => (
                                <div key={i} className="truncate">🎓 {c.courses?.title}</div>
                              ))}
                            </div>
                          )}
                          {studentPurchases.length === 0 && studentCertificates.length === 0 && (
                            <p className="text-muted-foreground italic text-center py-2">No active purchases or certificates.</p>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground italic text-center py-4">Context unavailable for guests.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Admin controls action bar */}
                  <Card className="col-span-2 rounded-3xl border border-border bg-card p-4 space-y-4 shadow-soft">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      {/* Assignment */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Assign Admin:</span>
                        <Select 
                          value={selectedReport.assigned_to || "unassigned"} 
                          onValueChange={(val) => handleAssignAdmin(val === "unassigned" ? "" : val)}
                        >
                          <SelectTrigger className="h-8 text-[10px] w-40 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {admins.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name || a.id}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Merge option */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Merge into:</span>
                        <Select onValueChange={handleMergeTicket}>
                          <SelectTrigger className="h-8 text-[10px] w-44 rounded-xl"><SelectValue placeholder="Select target ticket..." /></SelectTrigger>
                          <SelectContent>
                            {reports.filter(r => r.id !== selectedReport.id && r.status !== 'Closed').map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.title.slice(0, 20)} ({r.id.slice(0, 8)})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Archive controls */}
                      <div className="flex gap-2">
                        {selectedReport.archived ? (
                          <>
                            <Button size="xs" variant="outline" onClick={() => handleArchiveTicket(false)} className="rounded-xl text-[10px]">Unarchive</Button>
                            <Button size="xs" variant="destructive" onClick={handleDeleteTicket} className="rounded-xl text-[10px]"><Trash2 className="h-3 w-3 mr-1" /> Delete Ticket</Button>
                          </>
                        ) : (
                          <Button size="xs" variant="outline" onClick={() => handleArchiveTicket(true)} className="rounded-xl text-[10px]">Archive Ticket</Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="min-h-[400px] border border-dashed border-border rounded-3xl bg-muted/10 flex flex-col items-center justify-center text-center p-8">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg">No Ticket Selected</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">Select a filed complaint from the left panel to review details, inspect user history, and converse.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: ANALYTICS ── */}
      {activeTab === "analytics" && (
        <div className="space-y-8 animate-in fade-in-50">
          {/* KPI widgets */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Tickets", val: totalTickets, desc: "Lifetime complaints count" },
              { label: "Created Today", val: ticketsCreatedToday, desc: "New issues filed" },
              { label: "Open Tickets", val: openTickets, desc: "Assigned & unresolved queue" },
              { label: "Assistant Accuracy", val: `${assistantAccuracy}%`, desc: `${assistantResolved} of ${totalConversations} resolved` },
              { label: "Average Satisfaction", val: `${avgSatisfaction} ★`, desc: `Feedback from users` }
            ].map((stat, i) => (
              <Card key={i} className="rounded-2xl border border-border p-4 bg-card shadow-soft text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{stat.label}</p>
                <p className="font-display text-2xl font-black text-primary mt-2">{stat.val}</p>
                <p className="text-[9px] text-muted-foreground mt-1 truncate">{stat.desc}</p>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Workload */}
            <Card className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
              <CardHeader className="bg-muted/10 border-b border-border">
                <CardTitle className="text-sm font-bold text-foreground">Administrator Workload Distribution</CardTitle>
                <CardDescription>Number of open tickets currently assigned to support representatives.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {admins.map(admin => {
                  const adminOpenCount = reports.filter(r => r.assigned_to === admin.id && r.status !== 'Closed' && r.status !== 'Resolved').length;
                  return (
                    <div key={admin.id} className="space-y-1.5 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>{admin.full_name || admin.id}</span>
                        <span>{adminOpenCount} Tickets</span>
                      </div>
                      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (adminOpenCount / Math.max(1, openTickets)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-amber-600">Unassigned Queue</span>
                    <span className="font-bold text-amber-600">{reports.filter(r => !r.assigned_to && r.status !== 'Closed' && r.status !== 'Resolved').length} Tickets</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full transition-all" 
                      style={{ width: `${(reports.filter(r => !r.assigned_to && r.status !== 'Closed' && r.status !== 'Resolved').length / Math.max(1, openTickets)) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Analysis */}
            <Card className="rounded-3xl border border-border bg-card shadow-soft overflow-hidden">
              <CardHeader className="bg-muted/10 border-b border-border">
                <CardTitle className="text-sm font-bold text-foreground">Frequently Filed Categories</CardTitle>
                <CardDescription>Aggregation of complaints classified by product/subsystem categories.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 max-h-80 overflow-y-auto space-y-3 text-xs">
                {SUPPORT_CATEGORIES.map(cat => {
                  const count = reports.filter(r => r.category && r.category.includes(cat)).length;
                  if (count === 0) return null;
                  return (
                    <div key={cat} className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="font-semibold text-foreground">{cat}</span>
                      <Badge className="font-mono bg-primary/10 text-primary border-primary/20">{count} Tickets</Badge>
                    </div>
                  );
                }).filter(Boolean)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 3: KNOWLEDGE BASE ── */}
      {activeTab === "kb" && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="flex justify-between gap-4 flex-wrap items-center">
            <div className="relative w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search KB articles..." value={kbSearchTerm} onChange={e => setKbSearchTerm(e.target.value)} className="pl-9 rounded-xl h-9 text-xs" />
            </div>
            <div className="flex gap-2 items-center">
              <input type="file" id="kb-import-input" accept=".json" onChange={handleImportKb} className="hidden" />
              <Button size="xs" variant="outline" onClick={() => document.getElementById("kb-import-input")?.click()} className="rounded-xl text-[10px]">
                <Upload className="h-3.5 w-3.5 mr-1" /> Import JSON
              </Button>
              <Button size="xs" variant="outline" onClick={exportKbArticles} className="rounded-xl text-[10px]">
                <Download className="h-3.5 w-3.5 mr-1" /> Export JSON
              </Button>
              <Button size="xs" onClick={() => {
                setEditingArticle(null);
                setKbForm({ title: "", category: "Login Issues", keywords: "", trigger_phrases: "", confidence_weight: 1.0, suggested_response: "", troubleshooting_steps: "", status: "active" });
                setIsKbModalOpen(true);
              }} className="rounded-xl font-bold bg-primary text-primary-foreground text-[10px]">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Article
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {kbArticles
              .filter(a => a.title.toLowerCase().includes(kbSearchTerm.toLowerCase()) || a.category.toLowerCase().includes(kbSearchTerm.toLowerCase()))
              .map((art) => (
                <Card key={art.id} className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-soft flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-sm text-foreground">{art.title}</h4>
                      <Badge className={`rounded-full px-2 text-[8px] font-bold ${art.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-600 border border'}`}>
                        {art.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono">Category: <b>{art.category}</b> · Confidence Weight: <b>{art.confidence_weight}</b></p>
                    <p className="text-xs text-foreground line-clamp-3 bg-muted/20 p-2.5 rounded-xl border border-border/50">{art.suggested_response}</p>
                    
                    {art.keywords && art.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {art.keywords.map(k => <Badge key={k} variant="secondary" className="text-[9px] py-0">{k}</Badge>)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end pt-3 border-t">
                    <Button size="xs" variant="outline" onClick={() => {
                      setEditingArticle(art);
                      setKbForm({
                        title: art.title,
                        category: art.category,
                        keywords: art.keywords?.join(", ") || "",
                        trigger_phrases: art.trigger_phrases?.join(", ") || "",
                        confidence_weight: art.confidence_weight || 1.0,
                        suggested_response: art.suggested_response,
                        troubleshooting_steps: art.troubleshooting_steps || "",
                        status: art.status as any
                      });
                      setIsKbModalOpen(true);
                    }} className="rounded-xl text-[10px]">Edit</Button>
                    
                    <Button size="xs" variant="destructive" onClick={async () => {
                      if(confirm("Delete this article?")) {
                        await supabase.from("support_kb_articles").delete().eq("id", art.id);
                        loadKbArticles();
                      }
                    }} className="rounded-xl text-[10px]">Delete</Button>
                  </div>
                </Card>
              ))}
          </div>

          {/* KB Modal */}
          {isKbModalOpen && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <Card className="w-full max-w-lg rounded-3xl bg-card border shadow-xl max-h-[90vh] overflow-y-auto">
                <CardHeader className="border-b">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>{editingArticle ? "Edit Article" : "Create KB Article"}</span>
                    <button onClick={() => setIsKbModalOpen(false)} className="rounded-full hover:bg-muted p-1"><X className="h-4 w-4" /></button>
                  </CardTitle>
                </CardHeader>
                <form onSubmit={handleKbSubmit} className="p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={kbForm.title} onChange={e => setKbForm({...kbForm, title: e.target.value})} required className="rounded-xl text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={kbForm.category} onValueChange={(val) => setKbForm({...kbForm, category: val})}>
                        <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SUPPORT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Confidence Weight</Label>
                      <Input type="number" step="0.1" value={kbForm.confidence_weight} onChange={e => setKbForm({...kbForm, confidence_weight: parseFloat(e.target.value)})} required className="rounded-xl text-xs" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Keywords (Comma separated)</Label>
                    <Input value={kbForm.keywords} onChange={e => setKbForm({...kbForm, keywords: e.target.value})} placeholder="e.g. login, verify, locked" className="rounded-xl text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger Phrases (Comma separated)</Label>
                    <Input value={kbForm.trigger_phrases} onChange={e => setKbForm({...kbForm, trigger_phrases: e.target.value})} placeholder="e.g. forgot password, reset password" className="rounded-xl text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Suggested Response</Label>
                    <Textarea rows={4} value={kbForm.suggested_response} onChange={e => setKbForm({...kbForm, suggested_response: e.target.value})} required className="rounded-xl text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Troubleshooting Steps</Label>
                    <Textarea rows={3} value={kbForm.troubleshooting_steps} onChange={e => setKbForm({...kbForm, troubleshooting_steps: e.target.value})} className="rounded-xl text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={kbForm.status} onValueChange={(val: any) => setKbForm({...kbForm, status: val})}>
                      <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsKbModalOpen(false)} className="rounded-xl">Cancel</Button>
                    <Button type="submit" className="rounded-xl bg-primary text-primary-foreground font-bold">Save Article</Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: RULES & SANDBOX ── */}
      {activeTab === "rules" && (
        <div className="grid gap-8 lg:grid-cols-12 items-start animate-in fade-in-50">
          {/* Rules Configuration */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground">Configured Trigger Rules</h3>
              <Button size="xs" onClick={() => {
                setEditingRule(null);
                setRuleForm({ rule_name: "", trigger_type: "keyword", keywords: "", category: "Login Issues", response_text: "", action_type: "respond", confidence_score: 1.0, status: "active" });
                setIsRuleModalOpen(true);
              }} className="rounded-xl text-[10px] font-bold"><Plus className="h-3 w-3 mr-1" /> Add Rule</Button>
            </div>

            <div className="space-y-3">
              {aiRules.map(rule => (
                <Card key={rule.id} className="rounded-xl border p-4 bg-card space-y-2 shadow-soft">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-xs text-foreground">{rule.rule_name}</h4>
                    <Badge variant="outline" className="text-[8px] uppercase font-bold">{rule.trigger_type}</Badge>
                  </div>
                  <p className="text-xs text-foreground bg-muted/30 p-2 rounded-lg border">{rule.response_text}</p>
                  
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-1">
                    <span>Action: <b>{rule.action_type}</b> · Status: <b>{rule.status}</b></span>
                    <div className="flex gap-1.5">
                      <button onClick={() => {
                        setEditingRule(rule);
                        setRuleForm({
                          rule_name: rule.rule_name,
                          trigger_type: rule.trigger_type,
                          keywords: rule.conditions?.keywords?.join(", ") || "",
                          category: rule.conditions?.category || "Login Issues",
                          response_text: rule.response_text,
                          action_type: rule.action_type,
                          confidence_score: rule.confidence_score || 1.0,
                          status: rule.status as any
                        });
                        setIsRuleModalOpen(true);
                      }} className="text-primary hover:underline">Edit</button>
                      <button onClick={async () => {
                        if(confirm("Delete rule?")) {
                          await supabase.from("support_ai_rules").delete().eq("id", rule.id);
                          loadAiRules();
                        }
                      }} className="text-destructive hover:underline">Delete</button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Rule Modal */}
            {isRuleModalOpen && (
              <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md rounded-3xl bg-card border shadow-xl">
                  <CardHeader className="border-b">
                    <CardTitle className="text-sm font-bold flex justify-between">
                      <span>{editingRule ? "Edit Rule" : "Create Trigger Rule"}</span>
                      <button onClick={() => setIsRuleModalOpen(false)} className="rounded-full hover:bg-muted p-1"><X className="h-4 w-4" /></button>
                    </CardTitle>
                  </CardHeader>
                  <form onSubmit={handleRuleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label>Rule Name</Label>
                      <Input value={ruleForm.rule_name} onChange={e => setRuleForm({...ruleForm, rule_name: e.target.value})} required className="rounded-xl text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Trigger Type</Label>
                        <Select value={ruleForm.trigger_type} onValueChange={(val: any) => setRuleForm({...ruleForm, trigger_type: val})}>
                          <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="keyword">Keyword</SelectItem>
                            <SelectItem value="category">Category</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Action Type</Label>
                        <Select value={ruleForm.action_type} onValueChange={(val: any) => setRuleForm({...ruleForm, action_type: val})}>
                          <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="respond">Respond</SelectItem>
                            <SelectItem value="escalate">Escalate</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {ruleForm.trigger_type === 'keyword' && (
                      <div className="space-y-2">
                        <Label>Keywords (Comma separated)</Label>
                        <Input value={ruleForm.keywords} onChange={e => setRuleForm({...ruleForm, keywords: e.target.value})} placeholder="e.g. human, agent, person" className="rounded-xl text-xs" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Response Text</Label>
                      <Textarea rows={3} value={ruleForm.response_text} onChange={e => setRuleForm({...ruleForm, response_text: e.target.value})} required className="rounded-xl text-xs" />
                    </div>
                    <div className="flex gap-2 justify-end pt-4 border-t">
                      <Button type="button" variant="outline" onClick={() => setIsRuleModalOpen(false)} className="rounded-xl">Cancel</Button>
                      <Button type="submit" className="rounded-xl bg-primary text-primary-foreground font-bold">Save Rule</Button>
                    </div>
                  </form>
                </Card>
              </div>
            )}
          </div>

          {/* Sandbox Testing Console */}
          <div className="lg:col-span-6 space-y-6">
            <h3 className="font-bold text-sm text-foreground">AI Testing Sandbox Console</h3>
            <Card className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <div className="space-y-2">
                <Label>Type user query to test matching accuracy:</Label>
                <div className="flex gap-2">
                  <Input placeholder="e.g. Cannot stream course videos" value={sandboxQuery} onChange={e => setSandboxQuery(e.target.value)} className="rounded-xl text-xs" />
                  <Button onClick={runSandboxTest} className="rounded-xl bg-primary text-primary-foreground font-bold">Test</Button>
                </div>
              </div>

              {sandboxResults && (
                <div className="space-y-3.5 border-t pt-4 text-xs">
                  <div>
                    <p className="font-bold text-muted-foreground uppercase text-[9px]">Matched Rule:</p>
                    <p className="font-semibold text-foreground mt-0.5">{sandboxResults.matchedRule ? `${sandboxResults.matchedRule.rule_name} (Confidence: ${sandboxResults.matchedRule.confidence_score || 1.0})` : "None"}</p>
                  </div>
                  <div>
                    <p className="font-bold text-muted-foreground uppercase text-[9px]">Matched KB Article:</p>
                    <p className="font-semibold text-foreground mt-0.5">{sandboxResults.matchedArticle ? `${sandboxResults.matchedArticle.title} (Confidence: ${sandboxResults.articleScore.toFixed(2)})` : "None"}</p>
                  </div>
                  <div>
                    <p className="font-bold text-muted-foreground uppercase text-[9px]">Decided Platform Action:</p>
                    <Badge variant="outline" className="uppercase font-bold text-[9px] mt-1">{sandboxResults.chosenAction}</Badge>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/50">
                    <p className="font-bold text-muted-foreground uppercase text-[9px]">Assistant Output Response:</p>
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{sandboxResults.finalResponse}</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 5: LEARNING RECOMMENDATIONS ── */}
      {activeTab === "learning" && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground">AI Learning Engine Recommendations</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Approve or reject KB article expansions automatically derived from escalated ticket word aggregates.</p>
            </div>
            <Button size="xs" onClick={runLearningEngine} className="rounded-xl font-bold bg-primary text-primary-foreground text-[10px]">
              <Database className="h-3 w-3 mr-1" /> Run Engine Audit
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {suggestions
              .filter(s => s.status === 'pending')
              .map((sug) => (
                <Card key={sug.id} className="rounded-2xl border p-5 bg-card space-y-3 shadow-soft flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-bold">New Article Proposed</Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">Word occurrences: {sug.source_data?.occurrences || sug.source_data?.count || 2}</span>
                    </div>
                    
                    <h4 className="font-bold text-xs text-foreground">{sug.suggested_content?.title}</h4>
                    <p className="text-xs text-foreground bg-muted/30 p-2.5 rounded-xl border line-clamp-3">{sug.suggested_content?.suggested_response}</p>
                    
                    <div className="flex flex-wrap gap-1">
                      {sug.suggested_content?.keywords?.map((k: string) => (
                        <Badge key={k} variant="secondary" className="text-[8px]">{k}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-3 border-t">
                    <Button size="xs" onClick={() => handleApproveSuggestion(sug)} className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]"><Check className="h-3 w-3 mr-1" /> Approve &amp; Create</Button>
                    <Button size="xs" variant="outline" onClick={() => handleRejectSuggestion(sug.id)} className="rounded-xl text-[10px] border-destructive text-destructive hover:bg-destructive/10">Reject</Button>
                  </div>
                </Card>
              ))}

            {suggestions.filter(s => s.status === 'pending').length === 0 && (
              <Card className="col-span-2 rounded-3xl border border-dashed p-12 text-center text-muted-foreground text-xs italic bg-muted/5 flex flex-col items-center justify-center">
                <Database className="h-8 w-8 text-muted-foreground/30 mb-2" />
                No pending learning recommendations. Run "Run Engine Audit" to scan current database records.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
