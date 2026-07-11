import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, Upload, Sparkles, FileText, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/questions/$testId")({ component: QuestionsAdmin });

const MAX_QUESTIONS = 100;
const emptyMcq = { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "a", explanation: "" };
const emptyWritten = { question: "", max_words: 500 };

function parseQuestionsFromText(text: string): any[] {
  const lines = text.split('\n');
  const questions: any[] = [];
  let currentQ: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for Question start: e.g., "1. What is...", "Q2: Explain...", "Question 3: ..."
    const qMatch = line.match(/^(?:Q(?:uestion)?\s*\d+[:.]?|\d+[:.)])\s*(.*)/i);
    if (qMatch) {
      if (currentQ) {
        questions.push(currentQ);
      }
      currentQ = {
        question: qMatch[1].trim(),
        option_a: "",
        option_b: "",
        option_c: "",
        option_d: "",
        correct_option: "a",
        explanation: ""
      };
      continue;
    }

    if (!currentQ) continue;

    // Check for Options: A) B) C) D) or A. B. C. D.
    const optMatch = line.match(/^[A-D]\s*[:.)-]\s*(.*)/i);
    if (optMatch) {
      const optLetter = line.slice(0, 1).toLowerCase();
      currentQ[`option_${optLetter}`] = optMatch[1].trim();
      continue;
    }

    // Check for Answer: e.g., "Answer: A", "Correct: B", "Ans: C"
    const ansMatch = line.match(/^(?:Correct(?:\s*Option|\s*Answer)?|Ans(?:wer)?)\s*[:.-]?\s*([A-D])/i);
    if (ansMatch) {
      currentQ.correct_option = ansMatch[1].toLowerCase();
      continue;
    }

    // Check for Explanation: e.g., "Explanation: Because...", "Exp: ..."
    const expMatch = line.match(/^(?:Explanation|Exp|Description)\s*[:.-]?\s*(.*)/i);
    if (expMatch) {
      currentQ.explanation = expMatch[1].trim();
      continue;
    }

    // If none of the above, append text to either question, explanation, or last option
    if (currentQ.explanation) {
      currentQ.explanation += " " + line;
    } else if (currentQ.option_d) {
      currentQ.option_d += " " + line;
    } else if (currentQ.option_c) {
      currentQ.option_c += " " + line;
    } else if (currentQ.option_b) {
      currentQ.option_b += " " + line;
    } else if (currentQ.option_a) {
      currentQ.option_a += " " + line;
    } else {
      currentQ.question += " " + line;
    }
  }

  if (currentQ) {
    questions.push(currentQ);
  }

  // Fallback: If no questions were parsed with numbering, try separating by blank lines
  if (questions.length === 0) {
    const paragraphs = text.split(/\n\s*\n/);
    for (const para of paragraphs) {
      const pText = para.trim();
      if (!pText) continue;
      questions.push({
        question: pText.slice(0, 200),
        option_a: "Option A",
        option_b: "Option B",
        option_c: "Option C",
        option_d: "Option D",
        correct_option: "a",
        explanation: "Auto-extracted from document chunk"
      });
    }
  }

  return questions.map(q => ({
    ...q,
    option_a: q.option_a || "Option A",
    option_b: q.option_b || "Option B",
    option_c: q.option_c || "Option C",
    option_d: q.option_d || "Option D",
  }));
}

function QuestionsAdmin() {
  const { testId } = Route.useParams();
  const nav = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [qs, setQs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyMcq);
  const [qType, setQType] = useState<"mcq" | "written">("mcq");

  const [importOpen, setImportOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      const parsed = parseQuestionsFromText(text);
      setParsedQuestions(parsed);
      toast.success(`Extracted ${parsed.length} questions draft!`);
    };
    reader.readAsText(file);
  };

  const handleParseText = () => {
    if (!rawText.trim()) return toast.error("Please paste textbook/QA page content first");
    const parsed = parseQuestionsFromText(rawText);
    setParsedQuestions(parsed);
    toast.success(`Extracted ${parsed.length} questions draft!`);
  };

  const handlePublish = async () => {
    if (parsedQuestions.length === 0) return toast.error("No questions to publish");
    setPublishing(true);
    const startPos = qs.length;
    const toInsert = parsedQuestions.map((q, idx) => ({
      test_id: testId,
      position: startPos + idx,
      question: q.question,
      question_type: "mcq",
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: q.explanation
    }));

    const { error } = await supabase.from("test_questions").insert(toInsert);
    setPublishing(false);
    if (error) return toast.error(error.message);
    
    toast.success(`Published ${toInsert.length} questions successfully!`);
    setImportOpen(false);
    setRawText("");
    setParsedQuestions([]);
    load();
  };

  const isWritten = test?.test_type === "written";
  const isHybrid = test?.test_type === "hybrid";

  async function load() {
    const { data: t } = await supabase.from("tests").select("*").eq("id", testId).maybeSingle();
    setTest(t);
    const { data } = await supabase.from("test_questions").select("*").eq("test_id", testId).order("position");
    setQs(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [testId]);

  function openNew() {
    if (qs.length >= MAX_QUESTIONS) return toast.error(`Max ${MAX_QUESTIONS} questions per test`);
    const initial: "mcq" | "written" = isWritten ? "written" : "mcq";
    setQType(initial);
    setForm(initial === "written" ? { ...emptyWritten, max_words: test?.word_limit ?? 500 } : emptyMcq);
    setOpen(true);
  }

  // Effective per-question type — written/mcq tests force one; hybrid allows admin choice.
  const formType: "mcq" | "written" = isWritten ? "written" : isHybrid ? qType : "mcq";

  async function save() {
    if (!form.question.trim()) return toast.error("Question text required");
    const base: any = {
      test_id: testId,
      position: qs.length,
      question: form.question,
      question_type: formType,
    };
    if (formType === "written") {
      base.max_words = Number(form.max_words) || 500;
    } else {
      if (!form.option_a || !form.option_b || !form.option_c || !form.option_d)
        return toast.error("All four options required");
      Object.assign(base, {
        option_a: form.option_a, option_b: form.option_b, option_c: form.option_c, option_d: form.option_d,
        correct_option: form.correct_option,
        explanation: form.explanation,
      });
    }
    const { error } = await supabase.from("test_questions").insert(base);
    if (error) return toast.error(error.message);
    toast.success(`Question ${qs.length + 1} added`);
    setOpen(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await supabase.from("test_questions").delete().eq("id", id);
    load();
  }

  if (!test) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => nav({ to: "/admin/tests" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Tests</button>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Questions · {test.title}</h1>
          <p className="text-sm text-muted-foreground">
            {isWritten ? "Written" : "MCQ"} test · {qs.length}/{MAX_QUESTIONS} questions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isWritten && (
            <Button variant="outline" onClick={() => setImportOpen(true)} disabled={qs.length >= MAX_QUESTIONS} className="rounded-xl">
              <Upload className="mr-2 h-4 w-4" /> Import from Document
            </Button>
          )}
          <Button onClick={openNew} disabled={qs.length >= MAX_QUESTIONS} className="rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Add another question
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {qs.length === 0 && <p className="text-sm text-muted-foreground">No questions yet. Click “Add another question” to begin.</p>}
        {qs.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Q{i + 1} · {q.question_type === "written" ? "Written" : "MCQ"}</p>
                <h3 className="mt-1 font-display font-semibold">{q.question}</h3>
                {q.question_type === "written" ? (
                  <p className="mt-2 text-xs text-muted-foreground">Max words: {q.max_words ?? "—"}</p>
                ) : (
                  <ul className="mt-3 space-y-1 text-sm">
                    {(["a", "b", "c", "d"] as const).map((k) => (
                      <li key={k} className={k === q.correct_option ? "font-medium text-success" : "text-muted-foreground"}>
                        <span className="mr-1 uppercase">{k}.</span> {q["option_" + k]}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(q.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New {formType === "written" ? "written" : "MCQ"} question (Q{qs.length + 1})</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {isHybrid && (
              <div>
                <Label>Question type</Label>
                <Select value={qType} onValueChange={(v: any) => { setQType(v); setForm(v === "written" ? { ...emptyWritten, max_words: test?.word_limit ?? 500 } : emptyMcq); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">MCQ</SelectItem>
                    <SelectItem value="written">Written</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Question</Label><Textarea rows={3} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
            {formType === "written" ? (
              <div>
                <Label>Word limit</Label>
                <Input type="number" value={form.max_words ?? 500} onChange={(e) => setForm({ ...form, max_words: e.target.value })} />
              </div>
            ) : (
              <>
                {(["a", "b", "c", "d"] as const).map((k) => (
                  <div key={k}><Label>Option {k.toUpperCase()}</Label><Input value={form["option_" + k] ?? ""} onChange={(e) => setForm({ ...form, ["option_" + k]: e.target.value })} /></div>
                ))}
                <div>
                  <Label>Correct answer</Label>
                  <Select value={form.correct_option} onValueChange={(v) => setForm({ ...form, correct_option: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["a", "b", "c", "d"] as const).map((k) => <SelectItem key={k} value={k}>{k.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Explanation (for correct answer)</Label>
                  <Textarea rows={3} value={form.explanation ?? ""} onChange={(e) => setForm({ ...form, explanation: e.target.value })} placeholder="Why is the answer correct?" />
                </div>
              </>
            )}
          </div>
          <DialogFooter><Button onClick={save}>Add question</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if(!v) { setParsedQuestions([]); setRawText(""); } }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
              <Sparkles className="h-5 w-5 text-primary" /> Import Questions from Document
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1">
            {parsedQuestions.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm font-semibold">Upload question-answer document</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Supported formats: .txt files</p>
                  <label className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/95 cursor-pointer shadow-soft">
                    Choose File
                    <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Or Paste Raw Content</Label>
                    <span className="text-[10px] text-muted-foreground">Pasted text will be automatically parsed into questions</span>
                  </div>
                  <Textarea 
                    rows={8} 
                    value={rawText} 
                    onChange={(e) => setRawText(e.target.value)} 
                    placeholder={`Paste textbook page or QA format here. Example:\n\nQ1: What is the capital of France?\nA) Berlin\nB) Paris\nC) Rome\nD) London\nAnswer: B\nExplanation: Paris is the capital and most populous city of France.`}
                    className="font-mono text-xs rounded-xl"
                  />
                  <Button onClick={handleParseText} className="w-full rounded-xl text-xs font-bold h-10 bg-primary">
                    <Sparkles className="mr-2 h-3.5 w-3.5" /> Parse Document Patterns
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-bold">Successfully extracted {parsedQuestions.length} questions!</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setParsedQuestions([])} className="text-xs hover:bg-primary/10 hover:text-primary rounded-xl h-8">
                    Reset & Start Over
                  </Button>
                </div>

                <div className="space-y-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verify & Edit Questions Position</p>
                  {parsedQuestions.map((q, idx) => (
                    <div key={idx} className="p-5 border border-border rounded-2xl bg-card shadow-soft space-y-4 relative group">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs font-bold text-primary">Question {idx + 1} (MCQ)</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full" 
                          onClick={() => setParsedQuestions(parsedQuestions.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Question Text</Label>
                        <Textarea 
                          value={q.question} 
                          onChange={(e) => {
                            const updated = [...parsedQuestions];
                            updated[idx].question = e.target.value;
                            setParsedQuestions(updated);
                          }}
                          className="text-xs rounded-xl"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(["a", "b", "c", "d"] as const).map((k) => (
                          <div key={k} className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Option {k.toUpperCase()}</Label>
                            <Input 
                              value={q["option_" + k]} 
                              onChange={(e) => {
                                const updated = [...parsedQuestions];
                                updated[idx]["option_" + k] = e.target.value;
                                setParsedQuestions(updated);
                              }}
                              className="text-xs rounded-xl h-9"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1 sm:col-span-1">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Correct Option</Label>
                          <Select 
                            value={q.correct_option} 
                            onValueChange={(val) => {
                              const updated = [...parsedQuestions];
                              updated[idx].correct_option = val;
                              setParsedQuestions(updated);
                            }}
                          >
                            <SelectTrigger className="text-xs rounded-xl h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(["a", "b", "c", "d"] as const).map((k) => (
                                <SelectItem key={k} value={k}>{k.toUpperCase()}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Explanation</Label>
                          <Input 
                            value={q.explanation} 
                            onChange={(e) => {
                              const updated = [...parsedQuestions];
                              updated[idx].explanation = e.target.value;
                              setParsedQuestions(updated);
                            }}
                            className="text-xs rounded-xl h-9"
                            placeholder="Why is it correct?"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setImportOpen(false)} className="rounded-xl h-10 text-xs font-bold">
              Cancel
            </Button>
            {parsedQuestions.length > 0 && (
              <Button onClick={handlePublish} disabled={publishing} className="rounded-xl h-10 text-xs font-bold bg-primary shadow-lg shadow-primary/15">
                {publishing ? "Publishing…" : `Publish ${parsedQuestions.length} Questions`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
