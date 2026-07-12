import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Lock, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_student/tests/")({ component: TestsList });

type Test = {
  id: string; title: string; description: string; tier: "free" | "paid" | "premium";
  price: number; duration_min: number; total_marks: number; created_at: string;
  test_type: "mcq" | "written";
};

function TestsList() {
  const { user } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [tier, setTier] = useState<string>("all");
  const [sort, setSort] = useState<string>("new");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("tests").select("*").order("created_at", { ascending: false });
      setTests((data as Test[]) ?? []);
      const { data: p } = await supabase.from("purchases").select("test_id").eq("user_id", user.id);
      setPurchased(new Set((p ?? []).map((r) => r.test_id).filter((x): x is string => !!x)));
    })();
  }, [user]);

  const filtered = useMemo(() => {
    let arr = [...tests];
    if (tier !== "all") arr = arr.filter((t) => t.tier === tier);
    arr.sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "old") return +new Date(a.created_at) - +new Date(b.created_at);
      return +new Date(b.created_at) - +new Date(a.created_at);
    });
    return arr;
  }, [tests, tier, sort]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">All tests</h1>
          <p className="mt-1 text-muted-foreground">Browse MCQ and written tests across all tiers.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger className="w-full min-[480px]:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full min-[480px]:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Newest</SelectItem>
              <SelectItem value="old">Oldest</SelectItem>
              <SelectItem value="price_asc">Tokens ↑</SelectItem>
              <SelectItem value="price_desc">Tokens ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No tests match your filters.</p>}
        {filtered.map((t) => {
          const locked = t.tier !== "free" && !purchased.has(t.id);
          return (
            <div key={t.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t.tier === 'free' ? 'bg-success/10 text-success' : 'bg-accent text-accent-foreground'}`}>{t.tier}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{t.test_type === 'written' ? 'Written' : 'MCQ'}</span>
                </div>
                <span className="text-sm font-semibold">{t.tier === 'free' ? 'Free' : `${t.price} Tokens`}</span>
              </div>
              <h3 className="font-display text-lg font-semibold">{t.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> {t.duration_min} min · {t.total_marks} marks
              </div>
              <div className="mt-5 flex-1" />
              <Link to="/tests/$testId" params={{ testId: t.id }} className="block">
                <Button className="w-full" variant={locked ? "outline" : "default"}>
                  {locked ? <><Lock className="mr-2 h-3 w-3" /> View & purchase</> : "View test"}
                </Button>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
