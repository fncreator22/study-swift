import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_student/tests/$testId/")({ component: TestDetail });

type Test = { id: string; title: string; description: string; tier: string; price: number; duration_min: number; total_marks: number; instructions: string };
type Comment = { id: string; body: string; created_at: string; user_id: string };

function TestDetail() {
  const { testId } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");

  async function load() {
    if (!user) return;
    const { data: t } = await supabase.from("tests").select("*").eq("id", testId).maybeSingle();
    setTest(t as Test);
    if (!t) return;
    if (t.tier === "free") setHasAccess(true);
    else {
      const { data: p } = await supabase.from("purchases").select("id").eq("user_id", user.id).eq("test_id", testId).maybeSingle();
      setHasAccess(!!p);
    }
    const { data: cs } = await supabase.from("comments").select("*").eq("test_id", testId).order("created_at", { ascending: false });
    setComments((cs as Comment[]) ?? []);
    const ids = Array.from(new Set((cs ?? []).map((c) => c.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const m: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { m[p.id] = p.full_name || "Student"; });
      setNames(m);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user, testId]);

  async function purchase() {
    if (!user || !test) return;
    const { error } = await supabase.from("purchases").insert({ user_id: user.id, test_id: test.id });
    if (error) return toast.error(error.message);
    toast.success("Test unlocked");
    setHasAccess(true);
  }

  async function postComment() {
    if (!body.trim() || !user) return;
    const { error } = await supabase.from("comments").insert({ test_id: testId, user_id: user.id, body: body.trim() });
    if (error) return toast.error(error.message);
    setBody("");
    load();
  }

  if (!test) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/tests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" /> All tests</Link>

      <div className="mt-4 rounded-2xl border border-border bg-card p-8 shadow-card">
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${test.tier === 'free' ? 'bg-success/10 text-success' : 'bg-accent text-accent-foreground'}`}>{test.tier}</span>
          <span className="font-display text-xl font-bold">{test.tier === "free" ? "Free" : `₹${test.price}`}</span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold">{test.title}</h1>
        <p className="mt-2 text-muted-foreground">{test.description}</p>

        <div className="mt-6 grid gap-4 rounded-xl bg-muted p-4 sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Duration</p><p className="font-semibold"><Clock className="mr-1 inline h-3 w-3" />{test.duration_min} min</p></div>
          <div><p className="text-xs text-muted-foreground">Total marks</p><p className="font-semibold">{test.total_marks}</p></div>
          <div><p className="text-xs text-muted-foreground">Type</p><p className="font-semibold">MCQ</p></div>
        </div>

        {test.instructions && (
          <div className="mt-6">
            <h3 className="font-display font-semibold">Instructions</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{test.instructions}</p>
          </div>
        )}

        <div className="mt-8">
          {hasAccess ? (
            <Button size="lg" onClick={() => nav({ to: "/tests/$testId/attempt", params: { testId } })}>Start test</Button>
          ) : (
            <Button size="lg" onClick={purchase}><Lock className="mr-2 h-4 w-4" /> Purchase for ₹{test.price}</Button>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="mt-8">
        <h2 className="font-display text-xl font-bold">Discussion</h2>
        {hasAccess ? (
          <div className="mt-4 flex gap-3">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your thoughts…" />
            <Button onClick={postComment}>Post</Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Purchase the test to join the discussion.</p>
        )}
        <div className="mt-6 space-y-3">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{names[c.user_id] ?? "Student"}</span>
                <span>{new Date(c.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
