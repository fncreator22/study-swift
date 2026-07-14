import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, PlayCircle, Film, Pencil, Trash2, Trophy, Clock, FileText, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/courses")({ component: AdminCourses });

const empty = {
  title: '', subtitle: '', category: 'Professional', description: '',
  tier: 'free', price: 0, difficulty: 'Beginner',
  thumbnail_url: '', instructor_name: '', instructor_bio: '',
  completion_test_id: null, skills_learned: [], university_partner: '',
  language: 'English', duration_hours: 0, faqs: []
};

function AdminCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("none");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editing, setEditing] = useState<string | null>(null);

  // Course Assessment Settings States
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  
  // Assessment Question form states
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<"mcq" | "written" | "hybrid">("mcq");
  const [questionWeight, setQuestionWeight] = useState("1");
  const [mcqA, setMcqA] = useState("");
  const [mcqB, setMcqB] = useState("");
  const [mcqC, setMcqC] = useState("");
  const [mcqD, setMcqD] = useState("");
  const [mcqCorrect, setMcqCorrect] = useState("a");
  const [referenceAnswer, setReferenceAnswer] = useState("");
  const [requiredKeywords, setRequiredKeywords] = useState("");
  const [minSimilarity, setMinSimilarity] = useState("70");
  const [savingAssessment, setSavingAssessment] = useState(false);

  async function load() {
    const [{ data: cs }, { data: subs }, { data: ts }, { data: cats }, { data: mappings }] = await Promise.all([
      supabase.from("courses_v2").select("*, difficulty:difficulty_level, price:pricing_tokens").order("created_at", { ascending: false }),
      supabase.from("subscriptions" as any).select("id, name"),
      supabase.from("tests").select("id, title, test_type").order("title"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("subscription_courses_v2" as any).select("subscription_id, course_id")
    ]);

    const mappedSubs = (subs ?? []).map(s => {
      const courseIds = (mappings ?? [])
        .filter((m: any) => m.subscription_id === s.id)
        .map((m: any) => m.course_id);
      return { ...s, course_ids: courseIds };
    });

    setCourses(cs ?? []);
    setSubscriptions(mappedSubs);
    setTests(ts ?? []);
    setCategories(cats ?? []);
  }
  
  useEffect(() => { load(); }, []);

  function startEdit(c: any) {
    setForm({
      ...empty,
      ...c,
      subtitle: c.subtitle || '',
      skills_learned: c.skills_learned || [],
      university_partner: c.university_partner || '',
      language: c.language || 'English',
      duration_hours: c.duration_hours || 0,
      faqs: c.faqs || [],
      completion_test_id: c.completion_test_id || 'none'
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
      subtitle: form.subtitle || '',
      category: form.category,
      description: form.description,
      tier: form.tier,
      pricing_tokens: Number(form.price),
      difficulty_level: form.difficulty,
      thumbnail_url: form.thumbnail_url,
      instructor_name: form.instructor_name || 'Expert Educator',
      instructor_bio: form.instructor_bio || '',
      completion_test_id: completionTestId,
      skills_learned: form.skills_learned || [],
      university_partner: form.university_partner || null,
      language: form.language || 'English',
      duration_hours: Number(form.duration_hours) || 0,
      faqs: form.faqs || []
    };

    const { data: courseResult, error } = editing 
      ? await supabase.from("courses_v2").update(payload).eq("id", editing).select("id").single()
      : await supabase.from("courses_v2").insert(payload).select("id").single();
    
    if (error) return toast.error(error.message);

    const courseId = editing || courseResult.id;
    await supabase.from("subscription_courses_v2" as any).delete().eq("course_id", courseId);
    
    if (selectedPlanId !== "none") {
      await supabase.from("subscription_courses_v2" as any).insert({
        subscription_id: selectedPlanId,
        course_id: courseId
      });
    }

    toast.success(editing ? "Updated" : "Added"); 
    setOpen(false); 
    setForm(empty); 
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this course and all associated data?")) return;
    const { error } = await supabase.from("courses_v2").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  // --- Course Assessment Settings & Questions functions ---
  async function openAssessmentSettings(course: any) {
    setSelectedCourse(course);
    setAssessment(null);
    setQuestions([]);
    resetQuestionForm();

    // Fetch assessment
    const { data: asm, error } = await supabase
      .from("course_assessments_v2")
      .select("*")
      .eq("course_id", course.id)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
      return;
    }

    if (asm) {
      setAssessment(asm);
      setPassingScore(asm.passing_score.toString());
      setTimeLimit(asm.time_limit_min.toString());
      
      // Load questions
      const { data: qs } = await supabase
        .from("course_assessment_questions_v2")
        .select("*")
        .eq("assessment_id", asm.id)
        .order("order_index");
      setQuestions(qs || []);
    }
    
    setAssessmentOpen(true);
  }

  async function initializeAssessment() {
    if (!selectedCourse) return;
    setSavingAssessment(true);
    const { data, error } = await supabase
      .from("course_assessments_v2")
      .insert({
        course_id: selectedCourse.id,
        passing_score: 80.00,
        time_limit_min: 60
      })
      .select()
      .single();

    setSavingAssessment(false);
    if (error) {
      toast.error(error.message);
    } else {
      setAssessment(data);
      toast.success("Completion Assessment initialized successfully!");
    }
  }

  async function saveAssessmentSettings() {
    if (!assessment) return;
    setSavingAssessment(true);
    const { error } = await supabase
      .from("course_assessments_v2")
      .update({
        passing_score: parseFloat(passingScore) || 80.00,
        time_limit_min: parseInt(timeLimit) || 60
      })
      .eq("id", assessment.id);

    setSavingAssessment(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Assessment settings saved!");
    }
  }

  function resetQuestionForm() {
    setActiveQuestionId(null);
    setQuestionText("");
    setQuestionType("mcq");
    setQuestionWeight("1");
    setMcqA("");
    setMcqB("");
    setMcqC("");
    setMcqD("");
    setMcqCorrect("a");
    setWrittenReference("");
    setRequiredKeywords("");
    setMinSimilarity("70");
  }

  function editQuestion(q: any) {
    setActiveQuestionId(q.id);
    setQuestionText(q.question_text);
    setQuestionType(q.question_type);
    setQuestionWeight(q.weight?.toString() || "1");
    
    if (q.question_type === "mcq") {
      const opts = q.options || [];
      setMcqA(opts[0]?.label || "");
      setMcqB(opts[1]?.label || "");
      setMcqC(opts[2]?.label || "");
      setMcqD(opts[3]?.label || "");
      setMcqCorrect(q.correct_answers?.[0] || "a");
    } else {
      setWrittenReference(q.correct_answers?.reference || q.correct_answers || "");
      setRequiredKeywords((q.correct_answers?.keywords || []).join(", "));
      setMinSimilarity(q.correct_answers?.min_similarity?.toString() || "70");
    }
  }

  async function deleteQuestion(qId: string) {
    if (!confirm("Are you sure you want to delete this question?")) return;
    const { error } = await supabase
      .from("course_assessment_questions_v2")
      .delete()
      .eq("id", qId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Question deleted");
      // Reload questions
      const { data: qs } = await supabase
        .from("course_assessment_questions_v2")
        .select("*")
        .eq("assessment_id", assessment.id)
        .order("order_index");
      setQuestions(qs || []);
      resetQuestionForm();
    }
  }

  async function saveQuestion() {
    if (!assessment) return;
    if (!questionText.trim()) {
      toast.error("Please enter the question prompt.");
      return;
    }

    let correctAnswersObj: any;
    let optionsObj: any[] = [];

    if (questionType === "mcq") {
      if (!mcqA.trim() || !mcqB.trim()) {
        toast.error("Please provide at least Option A and Option B.");
        return;
      }
      optionsObj = [
        { label: mcqA.trim(), value: "a" },
        { label: mcqB.trim(), value: "b" }
      ];
      if (mcqC.trim()) optionsObj.push({ label: mcqC.trim(), value: "c" });
      if (mcqD.trim()) optionsObj.push({ label: mcqD.trim(), value: "d" });
      
      correctAnswersObj = [mcqCorrect];
    } else {
      if (!writtenReference.trim()) {
        toast.error("Please provide the reference/expected answer.");
        return;
      }
      const kws = requiredKeywords
        .split(",")
        .map(k => k.trim())
        .filter(k => k.length > 0);
      
      correctAnswersObj = {
        reference: writtenReference.trim(),
        keywords: kws,
        min_similarity: parseFloat(minSimilarity) || 70.00
      };
    }

    setSavingAssessment(true);
    
    const payload = {
      assessment_id: assessment.id,
      question_text: questionText.trim(),
      question_type: questionType,
      options: optionsObj,
      correct_answers: correctAnswersObj,
      weight: parseFloat(questionWeight) || 1.00,
      order_index: activeQuestionId ? undefined : questions.length + 1
    };

    const { error } = activeQuestionId
      ? await supabase.from("course_assessment_questions_v2").update(payload).eq("id", activeQuestionId)
      : await supabase.from("course_assessment_questions_v2").insert(payload);

    setSavingAssessment(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(activeQuestionId ? "Question updated!" : "Question added!");
      resetQuestionForm();
      
      // Reload questions
      const { data: qs } = await supabase
        .from("course_assessment_questions_v2")
        .select("*")
        .eq("assessment_id", assessment.id)
        .order("order_index");
      setQuestions(qs || []);
    }
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
              
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-bold">{c.tier === 'free' ? 'Free' : `${c.price} Tokens`}</span>
                <div className="flex gap-1.5 items-center">
                  <Link to="/admin/videos/$courseId" params={{ courseId: c.id }}>
                    <Button size="sm" variant="outline"><Film className="h-3.5 w-3.5 mr-1" /> Modules</Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => openAssessmentSettings(c)}>
                    <Trophy className="h-3.5 w-3.5 mr-1 text-amber-500" /> Assessment
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)} aria-label="Edit course"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)} aria-label="Delete course"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Course Edit/Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Course" : "New Course"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select 
                  value={form.category} 
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input value={form.subtitle || ''} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Short compelling subtitle..." />
            </div>

            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

            <div className="space-y-2">
              <Label>Instructor Bio</Label>
              <Textarea value={form.instructor_bio || ''} onChange={(e) => setForm({ ...form, instructor_bio: e.target.value })} placeholder="Brief instructor biography..." rows={3} />
            </div>

            <div className="space-y-2">
              <Label>Skills Learned (comma-separated)</Label>
              <Input 
                value={(form.skills_learned || []).join(', ')}
                onChange={(e) => setForm({ ...form, skills_learned: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                placeholder="React, TypeScript, Node.js, ..."
              />
            </div>

            <div className="space-y-2">
              <Label>University / Partner Organization</Label>
              <Input value={form.university_partner || ''} onChange={(e) => setForm({ ...form, university_partner: e.target.value })} placeholder="MIT, Google, IIT Delhi..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Language</Label><Input value={form.language || 'English'} onChange={(e) => setForm({ ...form, language: e.target.value })} /></div>
              <div className="space-y-2"><Label>Duration (hours)</Label><Input type="number" value={form.duration_hours || 0} onChange={(e) => setForm({ ...form, duration_hours: parseFloat(e.target.value) || 0 })} /></div>
            </div>

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

            <div className="space-y-2"><Label>Thumbnail URL</Label><Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} /></div>
            <div className="space-y-2"><Label>Instructor Name</Label><Input value={form.instructor_name} onChange={(e) => setForm({ ...form, instructor_name: e.target.value })} /></div>

            <div className="space-y-2">
              <Label>FAQs (JSON array: [{`{"q": "...", "a": "..."}`}])</Label>
              <Textarea 
                value={JSON.stringify(form.faqs || [], null, 2)}
                onChange={(e) => { try { setForm({ ...form, faqs: JSON.parse(e.target.value) }); } catch {} }}
                rows={4}
                className="font-mono text-xs"
                placeholder='[{"q": "How long is this course?", "a": "8 weeks"}]'
              />
            </div>
          </div>
          <DialogFooter><Button onClick={save} className="w-full">{editing ? "Update" : "Create"} Course</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dedicated Course Completion Assessment Settings Modal */}
      <Dialog open={assessmentOpen} onOpenChange={setAssessmentOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Trophy className="h-5.5 w-5.5 text-amber-500 animate-bounce" />
              Completion Assessment Manager: {selectedCourse?.title}
            </DialogTitle>
            <DialogDescription>
              Configure evaluation threshold rules, reference answers, expected keyword concepts, and scoring weights.
            </DialogDescription>
          </DialogHeader>

          {!assessment ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <ShieldAlert className="h-14 w-14 text-gray-300 dark:text-gray-700" />
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Assessment Not Configured</h3>
                <p className="text-sm text-gray-500 max-w-sm mt-1">This course does not have an independent completion assessment configured. Learners cannot earn a certificate without passing an assessment.</p>
              </div>
              <Button onClick={initializeAssessment} disabled={savingAssessment} className="rounded-xl font-bold">
                {savingAssessment ? "Initializing..." : "Initialize Completion Assessment"}
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
              {/* Settings panel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Passing Score (%)</Label>
                  <Input type="number" value={passingScore} onChange={(e) => setPassingScore(e.target.value)} placeholder="80" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Time Limit (Minutes)</Label>
                  <Input type="number" value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} placeholder="60" />
                </div>
                <div className="flex items-end">
                  <Button onClick={saveAssessmentSettings} disabled={savingAssessment} className="w-full bg-slate-900 dark:bg-slate-100 dark:text-slate-950 font-bold rounded-xl h-10">
                    Save General Settings
                  </Button>
                </div>
              </div>

              {/* Questions List & Editor Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Left side: Questions List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">Questions Queue ({questions.length})</h3>
                    <Button size="sm" variant="ghost" onClick={resetQuestionForm} className="text-xs text-primary font-bold">
                      Add New Question
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {questions.length === 0 ? (
                      <p className="text-xs text-gray-500 italic py-4">No questions created yet. Add one on the right editor.</p>
                    ) : (
                      questions.map((q, idx) => (
                        <div key={q.id} className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/10 flex items-start justify-between gap-3 text-left">
                          <div>
                            <span className="text-[9px] font-black uppercase text-primary tracking-widest">{q.question_type} · Weight: {q.weight || '1'}</span>
                            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mt-0.5">{idx + 1}. {q.question_text}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => editQuestion(q)} className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteQuestion(q.id)} className="h-7 w-7 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right side: Add/Edit Question Form */}
                <div className="border border-gray-100 dark:border-gray-800 rounded-2xl p-5 bg-slate-50/30 dark:bg-slate-900/10 space-y-4 text-left">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    {activeQuestionId ? "Modify Question" : "Create New Question"}
                  </h4>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Question Prompt Text</Label>
                      <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Type question details..." rows={3} className="text-xs" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Type</Label>
                        <Select value={questionType} onValueChange={(v: any) => setQuestionType(v)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                            <SelectItem value="written">Written (Auto Similarity)</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Weight (Score points)</Label>
                        <Input type="number" step="0.5" value={questionWeight} onChange={(e) => setQuestionWeight(e.target.value)} className="h-9 text-xs" />
                      </div>
                    </div>

                    {/* MCQ Options Config */}
                    {questionType === "mcq" && (
                      <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">MCQ options settings</span>
                        <div className="grid grid-cols-2 gap-2">
                          <Input size={1} value={mcqA} onChange={(e) => setMcqA(e.target.value)} placeholder="Option A (Required)" className="h-8 text-xs" />
                          <Input size={1} value={mcqB} onChange={(e) => setMcqB(e.target.value)} placeholder="Option B (Required)" className="h-8 text-xs" />
                          <Input size={1} value={mcqC} onChange={(e) => setMcqC(e.target.value)} placeholder="Option C" className="h-8 text-xs" />
                          <Input size={1} value={mcqD} onChange={(e) => setMcqD(e.target.value)} placeholder="Option D" className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Correct Option</Label>
                          <Select value={mcqCorrect} onValueChange={setMcqCorrect}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="a">A</SelectItem>
                              <SelectItem value="b">B</SelectItem>
                              {mcqC.trim() && <SelectItem value="c">C</SelectItem>}
                              {mcqD.trim() && <SelectItem value="d">D</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Written / Hybrid Similarity config */}
                    {questionType !== "mcq" && (
                      <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Automated similarity rules</span>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Expected Answer Key Reference</Label>
                          <Textarea value={writtenReference} onChange={(e) => setWrittenReference(e.target.value)} placeholder="Type reference answer to compare against..." rows={3} className="text-xs font-mono" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Required keywords/concepts (comma-separated)</Label>
                          <Input value={writtenKeywords} onChange={(e) => setRequiredKeywords(e.target.value)} placeholder="e.g. React, hook, state, effect" className="h-9 text-xs" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Similarity Threshold required to pass (%)</Label>
                          <Input type="number" min="0" max="100" value={minSimilarity} onChange={(e) => setMinSimilarity(e.target.value)} className="h-9 text-xs" />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {activeQuestionId && (
                        <Button variant="outline" size="sm" onClick={resetQuestionForm} className="flex-1 rounded-xl text-xs h-9">
                          Cancel
                        </Button>
                      )}
                      <Button onClick={saveQuestion} disabled={savingAssessment} size="sm" className="flex-1 rounded-xl text-xs h-9 font-bold bg-primary text-primary-foreground">
                        {activeQuestionId ? "Save Changes" : "Create Question"}
                      </Button>
                    </div>

                  </div>
                </div>

              </div>

            </div>
          )}

          <DialogFooter className="pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button variant="outline" onClick={() => setAssessmentOpen(false)} className="rounded-xl">Close settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
