import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  MessageSquare, Send, Clock, CheckCircle, HelpCircle, Sparkles, 
  Upload, User, Mail, Star, FileText, Trash2, X, Search, Filter, RefreshCw
} from "lucide-react";
import { 
  AssistantState, ChatMessage, matchKBArticle, matchAIRules, DECISION_TREE 
} from "@/lib/support-assistant";

export const Route = createFileRoute("/_student/support-center")({ component: StudentSupportPage });

const SUPPORT_CATEGORIES = [
  "Login Issues", "Registration", "Password Reset", "Account", "Profile",
  "Subscription", "Tokens", "Payments", "Marketplace", "Courses",
  "Course Progress", "Course Assessment", "Mock Test", "Certificates",
  "Leaderboard", "Technical Issues", "Bugs", "Feature Request", "Security", "Other"
];

function StudentSupportPage() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Form State
  const [category, setCategory] = useState("Login Issues");
  const [otherCategoryDescription, setOtherCategoryDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Ticket history filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "waiting" | "resolved" | "closed" | "archived">("all");

  // Selected Ticket Chat State
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Chatbot State
  const [chatbotOpen, setChatbotOpen] = useState(true);
  const [chatState, setChatState] = useState<AssistantState>('welcome');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [currentDecisionNode, setCurrentDecisionNode] = useState<string>('root');

  const dragRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch User Metadata
  async function loadUserMetadata() {
    if (!user) return;
    setLoadingMetadata(true);
    try {
      // 1. Fetch Profile
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setProfileData(prof);

      // 2. Fetch Purchases
      const { data: purch } = await supabase
        .from('purchases')
        .select('id, course_id, test_id, courses(title), tests(title)')
        .eq('user_id', user.id);
      setPurchases(purch ?? []);

      // 3. Fetch Certificates
      const { data: certs } = await supabase
        .from('certificates')
        .select('id, course_id, courses(title), issued_at')
        .eq('user_id', user.id);
      setCertificates(certs ?? []);
    } catch (err) {
      console.error("Error loading user metadata:", err);
    } finally {
      setLoadingMetadata(false);
    }
  }

  // Fetch Tickets List
  async function loadTickets() {
    if (!user) return;
    setLoadingTickets(true);
    try {
      const { data } = await supabase
        .from('support_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setTickets(data ?? []);
    } catch (err) {
      console.error("Error loading support tickets:", err);
    } finally {
      setLoadingTickets(false);
    }
  }

  useEffect(() => {
    loadUserMetadata();
    loadTickets();
  }, [user]);

  // Subscribe to Selected Ticket messages
  useEffect(() => {
    if (!selectedTicket) return;

    async function loadMessages() {
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('report_id', selectedTicket.id)
        .order('created_at', { ascending: true });
      setTicketMessages(data ?? []);
      setRating(selectedTicket.satisfaction_rating || 0);
      setRatingSubmitted(!!selectedTicket.satisfaction_rating);
    }

    loadMessages();

    const channel = supabase
      .channel(`student_ticket_chat_${selectedTicket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `report_id=eq.${selectedTicket.id}` },
        (payload) => {
          setTicketMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket]);

  // Scroll Chatbot to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Initialize Chatbot Greet
  useEffect(() => {
    if (chatMessages.length === 0) {
      const name = profileData?.full_name || 'there';
      setChatMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          text: `Hi ${name}! I am the Examly Support Assistant. How can I help you today? Let's check some solutions before making a ticket.`,
          created_at: new Date()
        }
      ]);
      setChatState('category_select');
      setCurrentDecisionNode('root');
    }
  }, [profileData]);

  // Upload attachments helper
  async function uploadAttachments(ticketFiles: File[]): Promise<any[]> {
    if (ticketFiles.length === 0) return [];
    setUploadingFiles(true);
    const uploadedList: any[] = [];
    
    try {
      for (const file of ticketFiles) {
        const fileExt = file.name.split('.').pop();
        const randomName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${user!.id}/${randomName}`;

        const { error: uploadError } = await supabase.storage
          .from('support-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('support-attachments')
          .getPublicUrl(filePath);

        uploadedList.push({
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size
        });
      }
      return uploadedList;
    } catch (err: any) {
      toast.error(`File upload failed: ${err.message}`);
      return [];
    } finally {
      setUploadingFiles(false);
    }
  }

  // Handle support ticket submit
  async function handleTicketSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      return toast.error("Please fill in Subject and Description.");
    }

    setSubmitting(true);
    try {
      const attachments = await uploadAttachments(files);
      const categoryLabel = category === "Other" ? `Other: ${otherCategoryDescription}` : category;

      const { error } = await supabase
        .from('support_reports')
        .insert({
          user_id: user!.id,
          email: user!.email!,
          title: subject.trim(),
          description: description.trim(),
          category: categoryLabel,
          priority: priority,
          attachments: attachments,
          status: 'Open'
        });

      if (error) throw error;
      toast.success("Support ticket created!");
      setSubject("");
      setDescription("");
      setFiles([]);
      loadTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  // Assistant chatbot user message
  async function handleAssistantSend(text: string) {
    if (!text.trim()) return;

    setChatMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text,
      created_at: new Date()
    }]);
    setChatInput("");

    setTimeout(async () => {
      // 1. Direct rule match
      const { rule, response } = await matchAIRules(text);
      if (rule) {
        setChatMessages(prev => [...prev, {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: response,
          created_at: new Date()
        }]);

        if (rule.action_type === 'escalate') {
          setChatState('escalating');
        }
        return;
      }

      // 2. KB Article lookup
      const { article, score } = await matchKBArticle(text);
      if (article && score >= 0.2) {
        setChatState('suggested_kb');
        let ansText = `I found a solution matching your query: **${article.title}**\n\n${article.suggested_response}`;
        if (article.troubleshooting_steps) {
          ansText += `\n\n**Troubleshooting steps:**\n${article.troubleshooting_steps}`;
        }

        setChatMessages(prev => [...prev, {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: ansText,
          created_at: new Date()
        }, {
          id: `ast-opt-${Date.now()}`,
          sender: 'system',
          text: "Did this resolve your issue?",
          created_at: new Date()
        }]);
      } else {
        setChatState('escalating');
        setChatMessages(prev => [...prev, {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't find a solution in the knowledge base. Describe it differently, or escalate directly using the button below:",
          created_at: new Date()
        }]);
      }
    }, 600);
  }

  function handleDecisionClick(opt: any) {
    setChatMessages(prev => [...prev, {
      id: `user-opt-${Date.now()}`,
      sender: 'user',
      text: opt.label,
      created_at: new Date()
    }]);

    setTimeout(() => {
      if (opt.response) {
        setChatMessages(prev => [...prev, {
          id: `ast-resp-${Date.now()}`,
          sender: 'assistant',
          text: opt.response,
          created_at: new Date()
        }]);
      }

      if (opt.nextNode && DECISION_TREE[opt.nextNode]) {
        setCurrentDecisionNode(opt.nextNode);
        const node = DECISION_TREE[opt.nextNode];
        setChatMessages(prev => [...prev, {
          id: `ast-node-${Date.now()}`,
          sender: 'assistant',
          text: node.question,
          created_at: new Date()
        }]);
      } else {
        setChatState(opt.nextState);
        if (opt.nextState === 'awaiting_query') {
          setChatMessages(prev => [...prev, {
            id: `ast-query-${Date.now()}`,
            sender: 'assistant',
            text: "Please describe your query in detail below:",
            created_at: new Date()
          }]);
        }
      }
    }, 400);
  }

  function handleKbFeedback(resolved: boolean) {
    setChatMessages(prev => [...prev, {
      id: `user-feed-${Date.now()}`,
      sender: 'user',
      text: resolved ? "Yes, it resolved my issue" : "No, I need an agent",
      created_at: new Date()
    }]);

    setTimeout(() => {
      if (resolved) {
        setChatState('closed');
        setChatMessages(prev => [...prev, {
          id: `ast-closed-${Date.now()}`,
          sender: 'assistant',
          text: "Great! Glad that resolved it. Let me know if you need anything else.",
          created_at: new Date()
        }]);
      } else {
        setChatState('escalating');
        setChatMessages(prev => [...prev, {
          id: `ast-esc-${Date.now()}`,
          sender: 'assistant',
          text: "No problem. Click the button below to escalate this chat to our human administrators immediately.",
          created_at: new Date()
        }]);
      }
    }, 400);
  }

  async function handleChatEscalation() {
    setSubmitting(true);
    try {
      const historyLog = chatMessages
        .map(m => `[${m.sender === 'user' ? 'Student' : 'Assistant'}] ${m.text}`)
        .join("\n");

      const categoryLabel = category === "Other" ? `Other: ${otherCategoryDescription}` : category;

      const { error } = await supabase
        .from('support_reports')
        .insert({
          user_id: user!.id,
          email: user!.email!,
          title: `Escalated assistant session: ${categoryLabel}`,
          description: `Conversation History:\n${historyLog}`,
          category: categoryLabel,
          priority: 'medium',
          status: 'Open',
          assistant_attempted: true,
          assistant_resolved: false,
          escalated: true
        });

      if (error) throw error;
      toast.success("Chat escalated. Admin ticket created!");
      setChatState('escalated');
      loadTickets();
    } catch (err: any) {
      toast.error(err.message || "Failed to escalate chat");
    } finally {
      setSubmitting(false);
    }
  }

  // Reply to human admin
  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setSendingReply(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          report_id: selectedTicket.id,
          sender_id: user!.id,
          is_admin_sender: false,
          message: replyText.trim()
        });

      if (error) throw error;
      setReplyText("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingReply(false);
    }
  }

  // Rate ticket resolution
  async function handleRateTicket(stars: number) {
    if (!selectedTicket || ratingSubmitted) return;
    setRating(stars);
    try {
      const { error } = await supabase
        .from('support_reports')
        .update({ satisfaction_rating: stars })
        .eq('id', selectedTicket.id);

      if (error) throw error;
      setRatingSubmitted(true);
      toast.success("Thank you for your feedback!");
      
      // Update local state
      setSelectedTicket(prev => ({ ...prev, satisfaction_rating: stars }));
      loadTickets();
    } catch (err: any) {
      toast.error("Feedback submission failed: " + err.message);
    }
  }

  // Reopen eligible tickets
  async function handleReopenTicket() {
    if (!selectedTicket) return;
    try {
      const { error } = await supabase
        .from('support_reports')
        .update({ status: 'Open', satisfaction_rating: null })
        .eq('id', selectedTicket.id);

      if (error) throw error;
      toast.success("Ticket reopened successfully!");
      setSelectedTicket(prev => ({ ...prev, status: 'Open', satisfaction_rating: null }));
      loadTickets();
    } catch (err: any) {
      toast.error("Failed to reopen ticket: " + err.message);
    }
  }

  // Drag and drop attachments
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  function getStatusColor(status: string) {
    switch (status) {
      case "Open": return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      case "In Progress": return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "In Review": return "bg-purple-500/10 text-purple-500 border border-purple-500/20";
      case "Waiting for User": return "bg-pink-500/10 text-pink-500 border border-pink-500/20";
      case "Assigned": return "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20";
      case "Resolved": return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      case "Closed": return "bg-neutral-500/10 text-neutral-500 border border-neutral-500/20";
      case "Rejected": return "bg-destructive/10 text-destructive border border-destructive/20";
      default: return "bg-secondary text-secondary-foreground";
    }
  }

  // Filter & search tickets
  const filteredTickets = tickets.filter(t => {
    const text = searchTerm.toLowerCase();
    const matchesSearch = t.title.toLowerCase().includes(text) || t.id.toLowerCase().includes(text) || t.category.toLowerCase().includes(text);
    
    if (!matchesSearch) return false;

    switch (filterType) {
      case "active":
        return ['Open', 'Assigned', 'In Review', 'In Progress'].includes(t.status) && !t.archived;
      case "waiting":
        return t.status === 'Waiting for User' && !t.archived;
      case "resolved":
        return t.status === 'Resolved' && !t.archived;
      case "closed":
        return ['Closed', 'Rejected'].includes(t.status) && !t.archived;
      case "archived":
        return t.archived;
      default:
        return !t.archived;
    }
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-display text-2xl font-black text-foreground">Support &amp; Help Desk</h1>
          <p className="text-xs text-muted-foreground mt-1">Converse with our intelligent chatbot or open a direct ticket with admins.</p>
        </div>
        
        {/* User context card (quick view) */}
        {!loadingMetadata && profileData && (
          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground bg-muted/30 border p-3 rounded-2xl">
            <div>Tier: <strong className="text-primary font-bold uppercase">{profileData.membership_status || 'Free'}</strong></div>
            <div className="border-l border-border pl-2">Courses: <strong className="text-foreground">{purchases.length}</strong></div>
            <div className="border-l border-border pl-2">Certificates: <strong className="text-foreground">{certificates.length}</strong></div>
            <div className="border-l border-border pl-2">Balance: <strong className="text-foreground">{profileData.tokens} Tokens</strong></div>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left Side: Create Ticket & Track list */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-3xl border border-border shadow-soft bg-card overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <MessageSquare className="h-5 w-5 text-primary" /> File a Support Ticket
              </CardTitle>
              <CardDescription>Directly register your issue with our customer assistance team.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleTicketSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="std-category">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUPPORT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="std-priority">Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {category === "Other" && (
                  <div className="space-y-2 animate-in slide-in-from-top-1">
                    <Label htmlFor="std-other-cat">Specify custom description <span className="text-destructive">*</span></Label>
                    <Input id="std-other-cat" placeholder="Detail category..." value={otherCategoryDescription} onChange={e => setOtherCategoryDescription(e.target.value)} required className="rounded-xl" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="std-subject">Subject <span className="text-destructive">*</span></Label>
                  <Input id="std-subject" placeholder="What is the issue?" value={subject} onChange={e => setSubject(e.target.value)} required className="rounded-xl" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="std-desc">Details &amp; Description <span className="text-destructive">*</span></Label>
                  <Textarea id="std-desc" rows={4} placeholder="Provide logs or description..." value={description} onChange={e => setDescription(e.target.value)} required className="rounded-xl" />
                </div>

                {/* Drag and Drop Zone */}
                <div className="space-y-2">
                  <Label>Attachments</Label>
                  <div 
                    ref={dragRef}
                    onDragOver={handleDrag}
                    onDragEnter={handleDrag}
                    onDrop={handleDrop}
                    className="border border-dashed border-border rounded-xl p-4 text-center cursor-pointer bg-muted/5 hover:bg-muted/10"
                  >
                    <label className="cursor-pointer flex flex-col items-center gap-1">
                      <Upload className="h-4 w-4 text-muted-foreground animate-bounce" />
                      <span className="text-[11px] font-semibold text-foreground">Drag &amp; Drop or click to add files</span>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*,application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files) {
                            setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {files.map((file, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted border border-border">
                          <span className="truncate flex-1 font-mono text-[10px] text-foreground flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          <button type="button" onClick={() => removeFile(i)} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button type="submit" disabled={submitting || uploadingFiles} className="w-full rounded-xl py-5 font-bold shadow-md shadow-primary/10">
                  {submitting ? "Submitting..." : uploadingFiles ? "Uploading attachments..." : "Submit Ticket"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Ticket history tracker */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-xs text-muted-foreground uppercase tracking-wider">Your Filed Support Tickets</h3>
            
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search tickets..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 rounded-xl text-xs" />
              </div>
              <div className="w-[120px] shrink-0">
                <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
                  <SelectTrigger className="h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingTickets ? (
              <p className="text-xs text-muted-foreground animate-pulse">Loading tickets...</p>
            ) : filteredTickets.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center p-4 bg-muted/10 border border-dashed rounded-xl">No support tickets found.</p>
            ) : (
              <div className="space-y-2">
                {filteredTickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTicket(t);
                      setChatbotOpen(false);
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedTicket?.id === t.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/40 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-mono">ID: {t.id.slice(0, 8)}...</span>
                      <Badge className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(t.status)}`}>{t.status}</Badge>
                    </div>
                    <p className="text-xs font-semibold mt-2 line-clamp-1 text-foreground">{t.title}</p>
                    <div className="flex items-center justify-between mt-2 border-t border-border/50 pt-2 text-[9px] text-muted-foreground">
                      <span>Category: {t.category}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Chatbot or Human Chat Thread */}
        <div className="lg:col-span-7 flex flex-col h-[650px]">
          {selectedTicket ? (
            /* Direct human ticket chat */
            <Card className="rounded-3xl border border-border shadow-soft flex flex-col overflow-hidden h-full bg-card">
              <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between p-4 shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold truncate text-foreground">{selectedTicket.title}</CardTitle>
                    <Badge className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(selectedTicket.status)}`}>
                      {selectedTicket.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-[10px] mt-0.5">
                    Category: <b>{selectedTicket.category}</b> · Priority: <b>{selectedTicket.priority}</b>
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedTicket(null); setChatbotOpen(true); }} className="h-8 w-8 rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5 min-h-0">
                <div className="flex flex-col gap-1 max-w-[85%] bg-muted/40 border p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Ticket Details
                  </p>
                  <p className="text-xs text-foreground whitespace-pre-wrap mt-1">{selectedTicket.description}</p>
                  
                  {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                    <div className="mt-3 border-t border-border pt-2 space-y-1">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Attachments:</p>
                      {selectedTicket.attachments.map((file: any, index: number) => (
                        <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-primary hover:underline truncate">
                          📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {ticketMessages.map((m) => {
                  const isAdminMsg = m.is_admin_sender;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col gap-1 max-w-[85%] p-3 rounded-2xl ${
                        isAdminMsg
                          ? "bg-primary text-primary-foreground ml-auto rounded-tr-none shadow-md"
                          : "bg-card border mr-auto rounded-tl-none"
                      }`}
                    >
                      <p className={`text-[8px] font-bold uppercase ${isAdminMsg ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                        {isAdminMsg ? "Admin Representative" : "You (Student)"}
                      </p>
                      <p className="text-xs mt-1 break-words">{m.message}</p>
                    </div>
                  );
                })}
              </div>

              {/* Chat footer: handles resolved rating or reopen */}
              <div className="p-3 border-t border-border bg-card">
                {['Resolved', 'Closed', 'Rejected'].includes(selectedTicket.status) ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-muted/30 p-3 rounded-2xl border border-border">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4 text-emerald-500" /> Ticket is {selectedTicket.status}.
                      </span>
                      <Button size="xs" onClick={handleReopenTicket} className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white text-[10px]">
                        Re-open Ticket
                      </Button>
                    </div>
                    {selectedTicket.status === 'Resolved' && (
                      <div className="flex flex-col items-center justify-center p-2 space-y-2">
                        <p className="text-xs font-bold text-foreground">Rate your satisfaction with our assistance:</p>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              disabled={ratingSubmitted}
                              onClick={() => handleRateTicket(star)}
                              className="focus:outline-none hover:scale-110 transition-transform cursor-pointer"
                            >
                              <Star className={`h-5 w-5 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <Input
                      placeholder="Type your reply to admin..."
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      disabled={sendingReply}
                      className="flex-1 min-w-0 rounded-xl"
                    />
                    <Button type="submit" disabled={sendingReply || !replyText.trim()} className="rounded-xl px-4 shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </div>
            </Card>
          ) : (
            /* Intelligent Chatbot Widget */
            <Card className="rounded-3xl border border-border shadow-soft flex flex-col overflow-hidden h-full bg-card">
              <CardHeader className="border-b border-border bg-primary/5 p-4 flex flex-row items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">Intelligent Support Assistant</CardTitle>
                    <CardDescription className="text-[10px] mt-0.5">Automated deflection &amp; assistance system</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[9px] font-bold">V2 Active</Badge>
              </CardHeader>

              {/* Message thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5 min-h-0">
                {chatMessages.map((m) => {
                  const isUser = m.sender === 'user';
                  const isSystem = m.sender === 'system';
                  
                  if (isSystem) {
                    return (
                      <div key={m.id} className="flex flex-col items-center text-center my-4 space-y-3">
                        <p className="text-xs font-semibold text-foreground">{m.text}</p>
                        {chatState === 'suggested_kb' && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleKbFeedback(true)} className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white">Yes, resolved!</Button>
                            <Button size="sm" variant="outline" onClick={() => handleKbFeedback(false)} className="rounded-xl font-bold border-destructive text-destructive hover:bg-destructive/10">No, escalate</Button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col gap-1 max-w-[85%] p-3.5 rounded-2xl ${
                        isUser
                          ? "bg-card border mr-auto rounded-tl-none"
                          : "bg-primary text-primary-foreground ml-auto rounded-tr-none shadow-md"
                      }`}
                    >
                      <p className={`text-[8px] font-bold uppercase ${isUser ? 'text-muted-foreground' : 'text-primary-foreground/75'}`}>
                        {isUser ? "You (Student)" : "Assistant"}
                      </p>
                      <p className="text-xs mt-1 break-words whitespace-pre-wrap">{m.text}</p>
                    </div>
                  );
                })}

                {chatState === 'category_select' && DECISION_TREE[currentDecisionNode] && (
                  <div className="flex flex-col gap-2 p-3 bg-muted/40 border border-border rounded-2xl animate-node-options">
                    <p className="text-xs font-bold text-foreground mb-1">{DECISION_TREE[currentDecisionNode].question}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DECISION_TREE[currentDecisionNode].options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleDecisionClick(opt)}
                          className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-xl hover:scale-[1.01] hover:bg-primary/95 transition-all cursor-pointer"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatState === 'escalating' && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-3 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="mx-auto h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-foreground font-semibold">
                      Would you like to instantly compile our chat log and submit a ticket for our human admin support team?
                    </p>
                    <Button onClick={handleChatEscalation} disabled={submitting} className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white">
                      {submitting ? "Creating Ticket..." : "Escalate to Human Admin"}
                    </Button>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border bg-card shrink-0">
                {['escalated', 'closed'].includes(chatState) ? (
                  <div className="text-center py-2 text-xs italic text-muted-foreground flex items-center justify-center gap-1.5">
                    {chatState === 'escalated' ? (
                      <>
                        <Clock className="h-4 w-4 text-amber-500" /> Escalation complete. Review the newly filed ticket in the list.
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-emerald-500" /> Assistant session complete.
                      </>
                    )}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAssistantSend(chatInput);
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      placeholder={chatState === 'category_select' ? "Pick a decision option above..." : "Ask a question..."}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={chatState === 'category_select' || chatState === 'escalating'}
                      className="flex-1 min-w-0 rounded-xl"
                    />
                    <Button type="submit" disabled={!chatInput.trim() || chatState === 'category_select'} className="rounded-xl px-4">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
