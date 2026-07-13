import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PlayCircle, Star, BookOpen, GraduationCap, Filter, Search, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_student/courses/")({ component: Courses });

type Course = { 
  id: string; 
  title: string; 
  description: string; 
  tier: string; 
  price: number; 
  thumbnail_url: string; 
  difficulty: string; 
  category: string;
  instructor_name: string;
  created_at: string;
};

function Courses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "unlocked" | "free" | "paid">("all");
  const [sortBy, setSortBy] = useState<"newest" | "title">("newest");

  useEffect(() => {
    setLoading(true);
    
    const loadAll = async () => {
      const [cRes, catRes, pRes] = await Promise.all([
        supabase.from("courses_v2").select("*, difficulty:difficulty_level, price:pricing_tokens").order("created_at", { ascending: false }),
        supabase.from("categories").select("name").order("name"),
        user ? supabase.from("purchases").select("course_id").eq("user_id", user.id) : Promise.resolve({ data: [] })
      ]);

      const courseList = (cRes.data as unknown as Course[]) ?? [];
      setCourses(courseList);

      const cats = (catRes.data ?? []).map((c: any) => c.name);
      setCategories(["All", ...cats]);

      const unlockedSet = new Set((pRes.data ?? []).map((p: any) => p.course_id));

      // Fetch active subscription course IDs if user is logged in
      if (user) {
        const { data: membership } = await supabase
          .from("memberships" as any)
          .select("subscription_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .gt("valid_until", new Date().toISOString())
          .maybeSingle();

        if (membership?.subscription_id) {
          const { data: subCourses } = await supabase
            .from("subscription_courses" as any)
            .select("course_id")
            .eq("subscription_id", membership.subscription_id);

          if (subCourses) {
            subCourses.forEach((sc: any) => unlockedSet.add(sc.course_id));
          }
        }
      }

      setPurchasedIds(unlockedSet);
      setLoading(false);
    };

    loadAll();
  }, [user]);

  // Apply filters client-side
  const filtered = courses.filter((c) => {
    // Search filter
    const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) || 
                          c.description.toLowerCase().includes(search.toLowerCase());
    
    // Category filter
    const matchesCategory = selectedCategory === "All" || c.category === selectedCategory;

    // Status filter (Unlocked, Free, Paid)
    let matchesStatus = true;
    if (statusFilter === "unlocked") {
      matchesStatus = c.tier === "free" || purchasedIds.has(c.id);
    } else if (statusFilter === "free") {
      matchesStatus = c.tier === "free";
    } else if (statusFilter === "paid") {
      matchesStatus = c.tier === "paid";
    }

    return matchesSearch && matchesCategory && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else {
      return a.title.localeCompare(b.title);
    }
  });

  if (loading) return <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse">Scanning catalog...</div>;

  return (
    <div className="mx-auto max-w-6xl">
      
      {/* Header Title Section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Learning Catalog</h1>
          <p className="mt-1 text-muted-foreground text-sm">Professional certification programs and interactive lessons.</p>
        </div>
      </div>

      {/* Course Search & Filtering Controls Grid */}
      <div className="grid gap-6 md:grid-cols-12 mb-8 bg-card border border-border p-6 rounded-3xl shadow-soft">
        
        {/* Search Input */}
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search courses..." 
            className="pl-10 rounded-2xl h-11 border-border bg-muted/20"
          />
        </div>

        {/* Ownership Status Filter */}
        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full h-11 px-3 rounded-2xl border border-border bg-muted/20 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Ownership Tiers</option>
            <option value="unlocked">Unlocked / Enrolled</option>
            <option value="free">Free Courses Only</option>
            <option value="paid">Premium Paid Only</option>
          </select>
        </div>

        {/* Sorting Order Filter */}
        <div className="md:col-span-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full h-11 px-3 rounded-2xl border border-border bg-muted/20 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="newest">Newest Available</option>
            <option value="title">Alphabetical (A-Z)</option>
          </select>
        </div>

        {/* Category Pills (Pushed to full-width or dynamic layout below) */}
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

      {/* Courses Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-20 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground font-medium italic">No courses match your filter selection. Try adjusting filters.</p>
          </div>
        ) : (
          filtered.map((c) => {
            const hasUnlocked = c.tier === "free" || purchasedIds.has(c.id);
            return (
              <Link 
                key={c.id} 
                to="/courses/$courseId" 
                params={{ courseId: c.id }}
                className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-card text-left"
              >
                <div className="relative aspect-video w-full bg-muted">
                  {c.thumbnail_url ? (
                    <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <PlayCircle className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                  
                  {/* Tier status indicator badge */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm ${
                      c.tier === 'free' 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-indigo-600 text-white'
                    }`}>
                      {c.tier === 'free' ? 'Free' : `${c.price} Tokens`}
                    </span>

                    {/* Enrolled/Unlocked indicator */}
                    {hasUnlocked && (
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white flex items-center gap-1 shadow-sm">
                        <CheckCircle className="h-2.5 w-2.5 text-emerald-400 fill-emerald-400" /> Enrolled
                      </span>
                    )}
                  </div>

                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>{c.category || 'Development'}</span>
                    <span className="h-1 w-1 rounded-full bg-border" />
                    <span>{c.difficulty}</span>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold leading-tight group-hover:text-primary transition-colors line-clamp-1">{c.title}</h3>
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground/80">{c.description}</p>
                  
                  <div className="mt-auto pt-6 flex items-center justify-between border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-muted overflow-hidden">
                        <div className="h-full w-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                          {c.instructor_name?.charAt(0) || 'E'}
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-muted-foreground">{c.instructor_name || 'Expert Educator'}</span>
                    </div>
                    <div className="flex items-center gap-0.5 text-accent-foreground font-bold">
                      <Star className="h-3 w-3 fill-accent text-amber-500" /> <span className="text-xs">4.9</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
