import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Clock, Lock, ArrowLeft, Coins } from "lucide-react";
import { toast } from "sonner";
import { TokenRequestModal } from "@/components/TokenRequestModal";

export const Route = createFileRoute("/_student/tests/$testId/")({ component: TestDetail });

type Test = { 
  id: string; 
  title: string; 
  description: string; 
  tier: string; 
  price: number; 
  duration_min: number; 
  total_marks: number; 
  instructions: string; 
  test_type: "mcq" | "written"; 
  word_limit: number 
};

function TestDetail() {
  const { testId } = Route.useParams();
  const { user, tokens, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

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
  }

  useEffect(() => { 
    load(); 
  }, [user, testId]);

  async function purchase() {
    if (!user || !test) return;
    const tokenCost = Math.ceil(test.price / 10);

    if (tokens < tokenCost) {
      toast.error(`Insufficient tokens. This test requires ${tokenCost} tokens.`);
      setPurchaseOpen(true);
      return;
    }

    const { error } = await supabase.rpc("purchase_with_tokens" as any, {
      _test_id: test.id,
      _course_id: null,
    });
    if (error) return toast.error(error.message);

    toast.success("Test unlocked successfully!");
    setHasAccess(true);
    refreshProfile();
  }

  if (!test) return <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse">Loading test details...</div>;

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <Link to="/tests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3 w-3" /> Back to assessments
      </Link>

      <div className="mt-4 rounded-3xl border border-border bg-card p-8 shadow-soft">
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${test.tier === 'free' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
            {test.tier}
          </span>
          <span className="font-display text-2xl font-black">{test.tier === "free" ? "FREE" : `₹${test.price}`}</span>
        </div>
        
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">{test.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground leading-relaxed">{test.description}</p>

        <div className="mt-8 grid gap-4 rounded-2xl bg-muted/50 p-6 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Duration</span>
            <span className="font-bold flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> {test.duration_min} min</span>
          </div>
          <div className="flex flex-col gap-1 border-border/50 sm:border-l sm:pl-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Marks</span>
            <span className="font-bold">{test.total_marks} Marks</span>
          </div>
          <div className="flex flex-col gap-1 border-border/50 sm:border-l sm:pl-6">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assessment Type</span>
            <span className="font-bold capitalize">{test.test_type}</span>
          </div>
        </div>

        {test.instructions && (
          <div className="mt-10 border-t border-border pt-8">
            <h3 className="font-display text-lg font-bold">Important Instructions</h3>
            <div className="mt-4 prose prose-sm text-muted-foreground max-w-none">
              <p className="whitespace-pre-line leading-relaxed">{test.instructions}</p>
            </div>
          </div>
        )}

        <div className="mt-10 pt-8 border-t border-border">
          {hasAccess ? (
            <Button size="lg" className="h-14 rounded-2xl px-10 text-base font-bold shadow-lg shadow-primary/20" onClick={() => nav({ to: "/tests/$testId/attempt", params: { testId } })}>
              Begin Assessment
            </Button>
          ) : (
            <Button size="lg" className="h-14 rounded-2xl px-10 text-base font-bold shadow-lg shadow-primary/20" onClick={purchase}>
              <Lock className="mr-2 h-4 w-4" /> Unlock for ₹{test.price}
            </Button>
          )}
          <p className="mt-4 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            {hasAccess ? "Lifetime access unlocked" : "One-time purchase for lifetime access"}
          </p>
        </div>
      </div>
      <TokenRequestModal open={purchaseOpen} onOpenChange={setPurchaseOpen} requiredTokens={test ? Math.ceil(test.price / 10) : 0} />
    </div>
  );
}
