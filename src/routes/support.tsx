import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
  ArrowLeft, MessageSquare, Send, Clock, CheckCircle, 
  HelpCircle, Sparkles, Upload, User, Mail, Phone, Globe, AlertCircle, FileText, Trash2, X
} from "lucide-react";
import { 
  AssistantState, ChatMessage, matchKBArticle, matchAIRules, DECISION_TREE, tokenize 
} from "@/lib/support-assistant";

export const Route = createFileRoute("/support")({ component: GuestSupportRouter });

const SUPPORT_CATEGORIES = [
  "Login Issues", "Registration", "Password Reset", "Account", "Profile",
  "Subscription", "Tokens", "Payments", "Marketplace", "Courses",
  "Course Progress", "Course Assessment", "Mock Test", "Certificates",
  "Leaderboard", "Technical Issues", "Bugs", "Feature Request", "Security", "Other"
];

function GuestSupportRouter() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/support-center" });
    }
  }, [user, loading]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Redirecting to Dashboard Support...</div>;
  }

  return <GuestSupportPage />;
}

function GuestSupportPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [escalatedTicketId, setEscalatedTicketId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("Login Issues");
  const [otherCategoryDescription, setOtherCategoryDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Chat/Assistant State
  const [chatOpen, setChatOpen] = useState(true);
  const [chatState, setChatState] = useState<AssistantState>('welcome');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [currentDecisionNode, setCurrentDecisionNode] = useState<string>('root');
  const [suggestedArticle, setSuggestedArticle] = useState<any>(null);
  
  // Active Chat with Agent State
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [agentMessages, setAgentMessages] = useState<any[]>([]);
  const [agentReplyText, setAgentReplyText] = useState("");
  const [sendingAgentReply, setSendingAgentReply] = useState(false);

  const dragRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Guest LocalStorage tickets
  interface GuestCredential {
    id: string;
    token: string;
  }

  function getGuestCredentials(): GuestCredential[] {
    try {
      const raw = localStorage.getItem("guest_tickets");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveGuestCredential(id: string, token: string) {
    const current = getGuestCredentials();
    localStorage.setItem("guest_tickets", JSON.stringify([...current, { id, token }]));
  }

  async function loadGuestTickets() {
    setLoadingReports(true);
    try {
      const credentials = getGuestCredentials();
      if (credentials.length > 0) {
        const { data, error } = await supabase.rpc("get_anonymous_reports_bulk", { creds: credentials });
        if (error) throw error;
        setReports(data ?? []);
      } else {
        setReports([]);
      }
    } catch (err: any) {
      console.error(err.message || "Failed to load guest tickets");
    } finally {
      setLoadingReports(false);
    }
  }

  useEffect(() => {
    loadGuestTickets();
  }, []);

  // Poll messages if a guest ticket is open
  useEffect(() => {
    if (!selectedReport) return;

    async function loadMessages() {
      const credentials = getGuestCredentials();
      const matchingCred = credentials.find(c => c.id === selectedReport.id);
      if (matchingCred?.token) {
        const { data, error } = await supabase.rpc("get_anonymous_report_messages", {
          ticket_id: selectedReport.id,
          token: matchingCred.token
        });
        if (!error) setAgentMessages(data ?? []);
      }
    }

    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedReport]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Init Assistant
  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          text: "Hi! Welcome to Examly Support. I'm your Intelligent Support Assistant. Let's try to resolve your issue right away!",
          created_at: new Date()
        }
      ]);
      setChatState('category_select');
      setCurrentDecisionNode('root');
    }
  }, []);

  // Upload attachments helper
  async function uploadAttachments(ticketFiles: File[]): Promise<any[]> {
    if (ticketFiles.length === 0) return [];
    setUploadingFiles(true);
    const uploadedList: any[] = [];
    
    try {
      for (const file of ticketFiles) {
        const fileExt = file.name.split('.').pop();
        const randomName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `guest/${randomName}`;

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

  // Handle direct complaint form submission
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !description.trim()) {
      return toast.error("Please fill in all required fields.");
    }

    setSubmitting(true);
    try {
      const attachmentUrls = await uploadAttachments(files);
      const categoryLabel = category === "Other" ? `Other: ${otherCategoryDescription}` : category;

      const { data, error } = await supabase.rpc("create_anonymous_report", {
        p_email: email.trim(),
        p_title: subject.trim(),
        p_description: description.trim(),
        p_phone: phone.trim() || null,
        p_country: country.trim() || null,
        p_category: categoryLabel,
        p_priority: priority,
        p_attachments: JSON.stringify(attachmentUrls)
      });

      if (error) throw error;

      if (data && data.length > 0) {
        saveGuestCredential(data[0].id, data[0].anonymous_token);
        toast.success("Support ticket created successfully!");
        setEscalatedTicketId(data[0].id);
        
        // Reset form
        setSubject("");
        setDescription("");
        setFiles([]);
        loadGuestTickets();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit ticket");
    } finally {
      setSubmitting(false);
    }
  }

  // Assistant Logic
  async function handleAssistantSend(text: string) {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text,
      created_at: new Date()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");

    // Simulate typing
    setTimeout(async () => {
      // 1. Check direct rule matches
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
        setSuggestedArticle(article);
        setChatState('suggested_kb');

        let ansText = `I found a matching solution in our Knowledge Base: **${article.title}**\n\n${article.suggested_response}`;
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
        // Fallback
        setChatState('escalating');
        setChatMessages(prev => [...prev, {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't find a direct match for that issue in our database. You can try describing it in other words, or escalate directly using the button below:",
          created_at: new Date()
        }]);
      }
    }, 600);
  }

  function handleDecisionClick(opt: any) {
    // Add user selection to chat
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
            text: "Please describe your issue in detail below:",
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
      text: resolved ? "Yes, it resolved my issue" : "No, I need to speak to an agent",
      created_at: new Date()
    }]);

    setTimeout(() => {
      if (resolved) {
        setChatState('closed');
        setChatMessages(prev => [...prev, {
          id: `ast-closed-${Date.now()}`,
          sender: 'assistant',
          text: "Excellent! I am glad we could resolve your issue. Have a great day!",
          created_at: new Date()
        }]);
      } else {
        setChatState('escalating');
        setChatMessages(prev => [...prev, {
          id: `ast-esc-${Date.now()}`,
          sender: 'assistant',
          text: "I understand. I am preparing a support ticket for you now. Please fill in the brief form on the left to complete your registration, or write a description so I can generate a quick ticket.",
          created_at: new Date()
        }]);
      }
    }, 400);
  }

  // Escalate Assistant Chat to Ticket
  async function handleChatEscalation() {
    if (!name.trim() || !email.trim()) {
      return toast.error("Please fill in your Name and Email on the form before escalating.");
    }

    setSubmitting(true);
    try {
      const historyLog = chatMessages
        .map(m => `[${m.sender === 'user' ? 'User' : 'Assistant'}] ${m.text}`)
        .join("\n");

      const categoryLabel = category === "Other" ? `Other: ${otherCategoryDescription}` : category;

      const { data, error } = await supabase.rpc("create_anonymous_report", {
        p_email: email.trim(),
        p_title: `Assistant Escalation: ${categoryLabel}`,
        p_description: `Name: ${name}\nPhone: ${phone}\nCountry: ${country}\n\n--- Conversation History ---\n${historyLog}`,
        p_phone: phone.trim() || null,
        p_country: country.trim() || null,
        p_category: categoryLabel,
        p_priority: 'medium',
        p_attachments: []
      });

      if (error) throw error;

      if (data && data.length > 0) {
        saveGuestCredential(data[0].id, data[0].anonymous_token);
        setEscalatedTicketId(data[0].id);
        toast.success("Chat escalated. Admin ticket created!");
        
        // Find ticket in db and select it to start chatting
        loadGuestTickets();
        setChatState('escalated');
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to escalate chat");
    } finally {
      setSubmitting(false);
    }
  }

  // Handle file drops
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

  // Reply to active admin chat as Guest
  async function handleSendGuestReply(e: React.FormEvent) {
    e.preventDefault();
    if (!agentReplyText.trim() || !selectedReport) return;

    setSendingAgentReply(true);
    try {
      const credentials = getGuestCredentials();
      const token = credentials.find(c => c.id === selectedReport.id)?.token || "";
      
      const { error } = await supabase.rpc("send_anonymous_report_message", {
        ticket_id: selectedReport.id,
        token,
        message_text: agentReplyText.trim()
      });

      if (error) throw error;
      setAgentReplyText("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingAgentReply(false);
    }
  }

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:py-12 bg-background min-h-screen">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
        <Link to="/" className="flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Return to Homepage
        </Link>
        <div className="text-right">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 justify-end">
            <HelpCircle className="h-6 w-6 text-primary animate-pulse" /> Examly Support Portal
          </h1>
          <p className="text-xs text-muted-foreground italic">Professional customer assistance for guests and visitors.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Left 5 Cols: Form & File attachments */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-3xl border border-border shadow-soft bg-card overflow-hidden">
            <CardHeader className="bg-muted/10 border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <MessageSquare className="h-5 w-5 text-primary" /> Create a Support Ticket
              </CardTitle>
              <CardDescription>
                Provide your details below to register a support ticket in our tracking system.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guest-name">Full Name <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="guest-name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required className="pl-9 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-email">Email Address <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="guest-email" type="email" placeholder="john@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="pl-9 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guest-phone">Phone (Optional)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="guest-phone" placeholder="+1 (555) 0199" value={phone} onChange={e => setPhone(e.target.value)} className="pl-9 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-country">Country (Optional)</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input id="guest-country" placeholder="United States" value={country} onChange={e => setCountry(e.target.value)} className="pl-9 rounded-xl" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guest-category">Issue Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUPPORT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-priority">Priority</Label>
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
                  <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                    <Label htmlFor="guest-category-other">Specify Category Details <span className="text-destructive">*</span></Label>
                    <Input id="guest-category-other" placeholder="e.g. Exam recovery error" value={otherCategoryDescription} onChange={e => setOtherCategoryDescription(e.target.value)} required className="rounded-xl" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="guest-subject">Subject <span className="text-destructive">*</span></Label>
                  <Input id="guest-subject" placeholder="Summarize your issue..." value={subject} onChange={e => setSubject(e.target.value)} required className="rounded-xl" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest-desc">Description &amp; Details <span className="text-destructive">*</span></Label>
                  <Textarea id="guest-desc" rows={4} placeholder="Describe the issue in detail..." value={description} onChange={e => setDescription(e.target.value)} required className="rounded-xl" />
                </div>

                {/* Drag and Drop Upload Zone */}
                <div className="space-y-2">
                  <Label>Attachments (Screenshots, PDFs, ZIPs, Word docs)</Label>
                  <div 
                    ref={dragRef}
                    onDragOver={handleDrag}
                    onDragEnter={handleDrag}
                    onDrop={handleDrop}
                    className="border border-dashed border-border rounded-xl p-4 text-center cursor-pointer bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <label className="cursor-pointer flex flex-col items-center gap-1.5">
                      <Upload className="h-5 w-5 text-muted-foreground animate-bounce" />
                      <span className="text-xs font-semibold text-foreground">Drag &amp; Drop or click to upload files</span>
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
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
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
                  {submitting ? "Submitting..." : uploadingFiles ? "Uploading Files..." : "Submit Ticket"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Filed Guest Tickets Tracking */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-xs text-muted-foreground uppercase tracking-wider">Your Tracked Tickets (Guest Session)</h3>
            {loadingReports ? (
              <p className="text-xs text-muted-foreground animate-pulse">Loading tracked tickets...</p>
            ) : reports.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/10 border border-dashed rounded-xl p-4 text-center">No active guest tickets being tracked.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedReport(t);
                      setEscalatedTicketId(t.id);
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedReport?.id === t.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/40 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-mono">ID: {t.id.slice(0, 8)}...</span>
                      <Badge className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(t.status)}`}>{t.status}</Badge>
                    </div>
                    <p className="text-xs font-semibold mt-2 line-clamp-1 text-foreground">{t.title}</p>
                    <div className="flex items-center justify-between mt-2 border-t border-border/50 pt-2 text-[9px] text-muted-foreground">
                      <span>Cat: {t.category}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 7 Cols: Interactive Chat Widget or Active Ticket Chat */}
        <div className="lg:col-span-7 flex flex-col h-[650px]">
          {selectedReport ? (
            /* Active agent chat */
            <Card className="rounded-3xl border border-border shadow-soft flex flex-col overflow-hidden h-full bg-card">
              <CardHeader className="border-b border-border bg-muted/20 flex flex-row items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold truncate text-foreground">{selectedReport.title}</CardTitle>
                    <Badge className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${getStatusColor(selectedReport.status)}`}>
                      {selectedReport.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-[10px] mt-0.5">
                    Category: <b>{selectedReport.category}</b> · Priority: <b>{selectedReport.priority}</b>
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedReport(null)} className="h-8 w-8 rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              
              {/* Agent Messages List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5 min-h-0">
                <div className="flex flex-col gap-1 max-w-[85%] bg-muted/40 border p-3 rounded-2xl">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Ticket Details
                  </p>
                  <p className="text-xs text-foreground whitespace-pre-wrap mt-1">{selectedReport.description}</p>
                  
                  {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                    <div className="mt-3 border-t border-border pt-2 space-y-1">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Attachments:</p>
                      {selectedReport.attachments.map((file: any, index: number) => (
                        <a key={index} href={file.url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-primary hover:underline truncate">
                          📎 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {agentMessages.map((m) => {
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
                        {isAdminMsg ? "Admin Support" : "You (Guest)"}
                      </p>
                      <p className="text-xs mt-1 break-words">{m.message}</p>
                    </div>
                  );
                })}
              </div>

              {/* Chat Composer */}
              <div className="p-3 border-t border-border bg-card">
                {['Resolved', 'Closed', 'Rejected'].includes(selectedReport.status) ? (
                  <p className="text-xs text-muted-foreground text-center py-2 italic flex items-center justify-center gap-1 bg-muted/40 rounded-xl">
                    <CheckCircle className="h-4 w-4 text-success" /> This ticket is marked {selectedReport.status.toLowerCase()}. Chat is disabled.
                  </p>
                ) : (
                  <form onSubmit={handleSendGuestReply} className="flex gap-2">
                    <Input
                      placeholder="Type your reply here..."
                      value={agentReplyText}
                      onChange={e => setAgentReplyText(e.target.value)}
                      disabled={sendingAgentReply}
                      className="flex-1 min-w-0 rounded-xl"
                    />
                    <Button type="submit" disabled={sendingAgentReply || !agentReplyText.trim()} className="rounded-xl px-4 shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </div>
            </Card>
          ) : (
            /* Assistant deflection interface */
            <Card className="rounded-3xl border border-border shadow-soft flex flex-col overflow-hidden h-full bg-card">
              <CardHeader className="border-b border-border bg-primary/5 p-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">Intelligent Support Assistant</CardTitle>
                    <CardDescription className="text-[10px] mt-0.5">Deflection Engine (100% Client-Side Rules &amp; KB)</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[9px] font-bold">V2 Platform Native</Badge>
              </CardHeader>

              {/* Chat Area */}
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
                        {isUser ? "You (Guest)" : "Assistant"}
                      </p>
                      <p className="text-xs mt-1 break-words whitespace-pre-wrap">{m.text}</p>
                    </div>
                  );
                })}

                {chatState === 'category_select' && DECISION_TREE[currentDecisionNode] && (
                  <div className="flex flex-col gap-2 p-3 bg-muted/40 border border-border rounded-2xl animate-in fade-in-50">
                    <p className="text-xs font-bold text-foreground mb-1">{DECISION_TREE[currentDecisionNode].question}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DECISION_TREE[currentDecisionNode].options.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleDecisionClick(opt)}
                          className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-xl hover:scale-[1.01] hover:bg-primary/95 transition-all"
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
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <p className="text-xs text-foreground font-semibold">
                      Would you like to instantly compile our chat log and create a support ticket for an administrator?
                    </p>
                    <Button onClick={handleChatEscalation} disabled={submitting} className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white">
                      {submitting ? "Creating Ticket..." : "Escalate to Human Agent Now"}
                    </Button>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-border bg-card shrink-0">
                {['escalated', 'closed'].includes(chatState) ? (
                  <div className="text-center py-2 text-xs italic text-muted-foreground flex items-center justify-center gap-1.5">
                    {chatState === 'escalated' ? (
                      <>
                        <Clock className="h-4 w-4 text-amber-500" /> Conversational escalation active. Track ticket on the left.
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
                      placeholder={chatState === 'category_select' ? "Please pick a decision option above..." : "Describe your problem here..."}
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
