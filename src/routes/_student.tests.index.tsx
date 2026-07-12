import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Lock, Clock, Search, Filter, HelpCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_student/tests/")({ component: TestsList });

type Test = {
  id: string; 
  title: string; 
  description: string; 
  tier: "free" | "paid" | "premium";
  price: number; 
  duration_min: number; 
  total_marks: number; 
  created_at: string;
  test_type: "mcq" | "written";
  category: string;
};

function TestsList() {
  const { user } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  
  // Filtering & Sorting states
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tier, setTier] = useState<string>("all");
  const [sort, setSort] = useState<string>("new");

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Fetch all tests
      const { data: tRes } = await supabase.from("tests").select("*").order("created_at", { ascending: false });
      setTests((tRes as Test[]) ?? []);

      // Fetch dynamic categories
      const { data: catRes } = await supabase.from("categories").select("name").order("name");
      const cats = (catRes ?? []).map((c: any) => c.name);
      setCategories(["All", ...cats]);

      // Fetch purchases
      const { data: pRes } = await supabase.from("purchases").select("test_id").eq("user_id", user.id);
      setPurchased(new Set((pRes ?? []).map((r) => r.test_id).filter((x): x is string => !!x)));
    })();
  }, [user]);

  const filtered = useMemo(() => {
    let arr = [...tests];

    // Search filter
    if (search.trim()) {
      arr = arr.filter(
        (t) => 
          t.title.toLowerCase().includes(search.toLowerCase()) || 
          t.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== "All") {
      arr = arr.filter((t) => t.category === selectedCategory);
    }

    // Tier filter
    if (tier !== "all") {
      arr = arr.filter((t) => t.tier === tier);
    }

    // Sorting
    arr.sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "old") return +new Date(a.created_at) - +new Date(b.created_at);
      return +new Date(b.created_at) - +new Date(a.created_at);
    });

    return arr;
  }, [tests, search, selectedCategory, tier, sort]);

  return (
    <div className="mx-auto max-w-6xl">
      
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Assessments & Exams</h1>
          <p className="mt-1 text-muted-foreground text-sm">Challenge yourself with standard MCQ and written assessments.</p>
        </div>
      </div>

      {/* Tests Search & Filter panel */}
      <div className="grid gap-6 md:grid-cols-12 mb-8 bg-card border border-border p-6 rounded-3xl shadow-soft">
        
        {/* Search Input */}
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search tests..." 
            className="pl-10 rounded-2xl h-11 border-border bg-muted/20"
          />
        </div>

        {/* Tier dropdown */}
        <div className="md:col-span-3">
          <Select value={tier} onValueChange={setTier}>
            <SelectTrigger className="w-full h-11 rounded-2xl border-border bg-muted/20 text-sm font-medium">
              <SelectValue placeholder="All Tiers" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="free">Free Tests</SelectItem>
              <SelectItem value="paid">Paid Tests</SelectItem>
              <SelectItem value="premium">Premium Subscription</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort dropdown */}
        <div className="md:col-span-4">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full h-11 rounded-2xl border-border bg-muted/20 text-sm font-medium">
              <SelectValue placeholder="Sort order" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="new">Newest First</SelectItem>
              <SelectItem value="old">Oldest First</SelectItem>
              <SelectItem value="price_asc">Tokens (Lowest to Highest)</SelectItem>
              <SelectItem value="price_desc">Tokens (Highest to Lowest)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Pills */}
        <div className="md:col-span-12 border-t border-border/50 pt-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-2 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all border ${
                selectedCategory === cat
                  ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/10"
                  : "bg-background border-border text-muted-foreground hover:border-muted hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

      </div>

      {/* Tests Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-20 text-center">
            <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/30 animate-pulse" />
            <p className="mt-4 text-muted-foreground font-medium italic">No tests match your filter criteria.</p>
          </div>
        ) : (
          filtered.map((t) => {
            const locked = t.tier !== "free" && !purchased.has(t.id);
            return (
              <div key={t.id} className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-soft text-left group hover:border-primary/30 transition-all">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                      t.tier === 'free' 
                        ? 'bg-emerald-500/10 text-emerald-600' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {t.tier}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
                      {t.test_type === 'written' ? 'Written' : 'MCQ'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {t.tier === 'free' ? 'Free' : `${t.price} Tokens`}
                  </span>
                </div>
                
                <div className="flex-1">
                  {/* Show Category tag */}
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {t.category || "General"}
                  </span>
                  <h3 className="font-display text-lg font-bold mt-1 group-hover:text-primary transition-colors line-clamp-1">{t.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground/80">{t.description}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground/60" /> 
                    <span>{t.duration_min} min · {t.total_marks} marks</span>
                  </div>
                </div>

                <div className="mt-5">
                  <Link to="/tests/$testId" params={{ testId: t.id }} className="block">
                    <Button className="w-full rounded-2xl h-11 font-bold" variant={locked ? "outline" : "default"}>
                      {locked ? <><Lock className="mr-2 h-4 w-4" /> View & purchase</> : "Start Assessment"}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
