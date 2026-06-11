import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Eye, Check, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/import/$testId")({ component: ImportQuestions });

type ParsedQ = {
  question: string;
  question_type: "mcq" | "written";
  option_a?: string; option_b?: string; option_c?: string; option_d?: string;
  correct_option?: "a" | "b" | "c" | "d";
  explanation?: string;
  max_words?: number;
  marks: number;
  _error?: string;
};

/**
 * Parse pasted text. Recognised shape:
 *   Q1. <question text>            ← question marker (Q1. / 1. / 1) / Question 1:)
 *   A) ...   B) ...   C) ...   D) ...
 *   Answer: B
 *   Explanation: <text>
 * Written: no options + "Answer:" or "Expected points:" → written.
 */
function parsePastedQuestions(text: string): ParsedQ[] {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n(?=\s*(?:Q\s*\d+|\d+\s*[\.\)]|Question\s+\d+)[\.\):]?)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: ParsedQ[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    // Strip leading question marker
    const first = lines[0].replace(/^(?:Q\s*\d+|\d+\s*[\.\)]|Question\s+\d+)[\.\):]?\s*/i, "");
    let question = first;
    const opts: Record<string, string> = {};
    let answer: string | undefined;
    let explanation: string | undefined;
    let mode: "q" | "exp" = "q";
    let isWritten = false;
    let expectedPoints: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const ln = lines[i];
      const optMatch = ln.match(/^\(?([A-Da-d])[\)\.\:]\s*(.+)$/);
      const ansMatch = ln.match(/^Answer\s*[:\-]?\s*(.*)$/i);
      const explMatch = ln.match(/^Explanation\s*[:\-]?\s*(.*)$/i);
      const expectedMatch = ln.match(/^Expected\s*points?\s*[:\-]?\s*(.*)$/i);
      const bullet = ln.match(/^[\-\*•]\s*(.+)$/);

      if (optMatch) {
        opts[optMatch[1].toLowerCase()] = optMatch[2].trim();
        mode = "q";
      } else if (ansMatch) {
        answer = ansMatch[1].trim();
        mode = "q";
      } else if (explMatch) {
        explanation = explMatch[1].trim();
        mode = "exp";
      } else if (expectedMatch) {
        isWritten = true;
        if (expectedMatch[1]) expectedPoints.push(expectedMatch[1]);
        mode = "exp";
      } else if (bullet && mode === "exp") {
        if (isWritten) expectedPoints.push(bullet[1]);
        else explanation = (explanation ? explanation + "\n" : "") + "- " + bullet[1];
      } else if (mode === "exp") {
        if (isWritten) expectedPoints.push(ln);
        else explanation = (explanation ? explanation + "\n" : "") + ln;
      } else {
        question += " " + ln;
      }
    }

    const hasOptions = Object.keys(opts).length >= 2;
    if (!hasOptions || isWritten) {
      out.push({
        question: question.trim(),
        question_type: "written",
        explanation: expectedPoints.length ? "Expected points:\n- " + expectedPoints.join("\n- ") : explanation,
        max_words: 500,
        marks: 5,
      });
    } else {
      const correct = (answer || "").trim().match(/^([A-Da-d])/)?.[1]?.toLowerCase() as ParsedQ["correct_option"] | undefined;
      const q: ParsedQ = {
        question: question.trim(),
        question_type: "mcq",
        option_a: opts.a, option_b: opts.b, option_c: opts.c, option_d: opts.d,
        correct_option: correct,
        explanation,
        marks: 1,
      };
      if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) q._error = "MCQ needs all 4 options (A–D).";
      else if (!correct) q._error = "Answer line missing or invalid (e.g. 'Answer: B').";
      out.push(q);
    }
  }
  return out;
}

function ImportQuestions() {
  const { testId } = Route.useParams();
  const nav = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedQ[]>([]);
  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase.from("tests").select("*").eq("id", testId).maybeSingle().then(({ data }) => setTest(data));
  }, [testId]);

  function doParse() {
    const list = parsePastedQuestions(raw);
    if (!list.length) return toast.error("No questions detected. Check format.");
    setParsed(list);
    setStep("preview");
  }

  function updateQ(i: number, patch: Partial<ParsedQ>) {
    setParsed((p) => p.map((q, idx) => idx === i ? { ...q, ...patch, _error: undefined } : q));
  }
  function removeQ(i: number) {
    setParsed((p) => p.filter((_, idx) => idx !== i));
  }

  async function approveAll() {
    const valid = parsed.filter((q) => !q._error && q.question.trim());
    if (!valid.length) return toast.error("Nothing valid to import");
    setImporting(true);
    const { data: existing } = await supabase.from("test_questions").select("id").eq("test_id", testId);
    const startPos = (existing?.length || 0);
    const rows = valid.map((q, i) => ({
      test_id: testId,
      position: startPos + i,
      question: q.question,
      question_type: q.question_type,
      option_a: q.option_a ?? null,
      option_b: q.option_b ?? null,
      option_c: q.option_c ?? null,
      option_d: q.option_d ?? null,
      correct_option: q.correct_option ?? null,
      explanation: q.explanation ?? null,
      max_words: q.max_words ?? null,
      marks: q.marks ?? 1,
      is_published: true,
    }));
    const { error } = await supabase.from("test_questions").insert(rows as any);
    setImporting(false);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length} questions`);
    nav({ to: "/admin/questions/$testId", params: { testId } });
  }

  const sample = `Q1. What is React?
A) Library
B) Database
C) OS
D) Language
Answer: A
Explanation: React is a frontend library.

Q2. Explain virtual DOM.
Answer:
Expected points:
- In-memory tree representation
- Diffing algorithm
- Efficient batched updates`;

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={() => nav({ to: "/admin/questions/$testId", params: { testId } })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Questions
      </button>

      <h1 className="mt-2 font-display text-3xl font-bold">Import Questions {test ? `· ${test.title}` : ""}</h1>
      <p className="text-sm text-muted-foreground">Paste questions in simple text format. We detect MCQ vs written automatically.</p>

      {step === "paste" ? (
        <div className="mt-6 space-y-4">
          <div>
            <Label>Pasted questions</Label>
            <Textarea rows={16} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={sample} className="font-mono text-xs" />
          </div>
          <div className="flex gap-2">
            <Button onClick={doParse} disabled={!raw.trim()}><Eye className="mr-2 h-4 w-4" />Parse & preview</Button>
            <Button variant="outline" onClick={() => setRaw(sample)}>Load sample</Button>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs">
            <p className="font-bold uppercase tracking-wider text-muted-foreground mb-2">Format</p>
            <pre className="whitespace-pre-wrap text-muted-foreground">{sample}</pre>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">{parsed.length} questions detected · {parsed.filter(q => !q._error).length} valid</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("paste")}>Back to paste</Button>
              <Button disabled={importing || !parsed.some(q => !q._error)} onClick={approveAll}>
                <Check className="mr-2 h-4 w-4" />{importing ? "Importing..." : "Approve & import"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {parsed.map((q, i) => (
              <div key={i} className={`rounded-2xl border p-4 ${q._error ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Q{i + 1} · {q.question_type.toUpperCase()}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeQ(i)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
                <Textarea rows={2} value={q.question} onChange={(e) => updateQ(i, { question: e.target.value })} className="mt-2" />
                {q.question_type === "mcq" ? (
                  <>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {(["a", "b", "c", "d"] as const).map(k => (
                        <div key={k}>
                          <Label className="text-xs uppercase">Option {k}</Label>
                          <Input value={(q as any)["option_" + k] ?? ""} onChange={(e) => updateQ(i, { ["option_" + k]: e.target.value } as any)} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs">Correct</Label>
                        <Select value={q.correct_option ?? ""} onValueChange={(v: any) => updateQ(i, { correct_option: v })}>
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>{(["a", "b", "c", "d"] as const).map(k => <SelectItem key={k} value={k}>{k.toUpperCase()}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Marks</Label>
                        <Input type="number" value={q.marks} onChange={(e) => updateQ(i, { marks: Number(e.target.value) || 0 })} />
                      </div>
                    </div>
                    {q.explanation && (
                      <div className="mt-2"><Label className="text-xs">Explanation</Label>
                        <Textarea rows={2} value={q.explanation} onChange={(e) => updateQ(i, { explanation: e.target.value })} /></div>
                    )}
                  </>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-1"><Label className="text-xs">Word limit</Label>
                      <Input type="number" value={q.max_words ?? 500} onChange={(e) => updateQ(i, { max_words: Number(e.target.value) || 500 })} /></div>
                    <div className="sm:col-span-1"><Label className="text-xs">Marks</Label>
                      <Input type="number" value={q.marks} onChange={(e) => updateQ(i, { marks: Number(e.target.value) || 0 })} /></div>
                    <div className="sm:col-span-3"><Label className="text-xs">Expected points / notes</Label>
                      <Textarea rows={3} value={q.explanation ?? ""} onChange={(e) => updateQ(i, { explanation: e.target.value })} /></div>
                  </div>
                )}
                {q._error && <p className="mt-2 text-xs text-destructive">{q._error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
