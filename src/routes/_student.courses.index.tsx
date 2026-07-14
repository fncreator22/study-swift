import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Search,
  GraduationCap,
  PlayCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_student/courses/")({ component: Courses });

// ─── Types ──────────────────────────────────────────────────────────────────

type Course = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  tier: string;
  pricing_tokens: number;
  thumbnail_url: string | null;
  difficulty_level: string | null;
  category: string | null;
  instructor_name: string | null;
  skills_learned: string[] | null;
  avg_rating: number;
  enrollment_count: number;
  duration_hours: number | null;
  language: string | null;
  created_at: string;
};

type SortOption = "newest" | "oldest" | "popular" | "az";
type OwnershipOption = "all" | "enrolled" | "free" | "paid" | "certificate";
type DifficultyOption = "all" | "beginner" | "intermediate" | "advanced";
type TierOption = "all" | "free" | "basic" | "premium" | "paid";

// ─── Tier badge helpers ──────────────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  free: "bg-emerald-500/90 text-white",
  basic: "bg-sky-500/90 text-white",
  premium: "bg-violet-600/90 text-white",
  paid: "bg-amber-500/90 text-white",
};

const GRADIENT_PALETTES = [
  "from-violet-500/30 to-fuchsia-500/30",
  "from-sky-500/30 to-cyan-500/30",
  "from-emerald-500/30 to-teal-500/30",
  "from-amber-500/30 to-orange-500/30",
  "from-rose-500/30 to-pink-500/30",
  "from-indigo-500/30 to-blue-500/30",
];

function gradientForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENT_PALETTES[Math.abs(hash) % GRADIENT_PALETTES.length];
}

// ─── Component ───────────────────────────────────────────────────────────────

function Courses() {
  const { user } = useAuth();

  // Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [subTiers, setSubTiers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [ownership, setOwnership] = useState<OwnershipOption>("all");
  const [difficulty, setDifficulty] = useState<DifficultyOption>("all");
  const [tierFilter, setTierFilter] = useState<TierOption>("all");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);

      const [coursesRes, enrollRes, purchaseRes] = await Promise.all([
        supabase
          .from("courses_v2")
          .select(
            "id, title, subtitle, description, tier, pricing_tokens, thumbnail_url, difficulty_level, category, instructor_name, skills_learned, avg_rating, enrollment_count, duration_hours, language, created_at"
          )
          .order("created_at", { ascending: false }),

        user
          ? supabase
              .from("course_enrollments_v2")
              .select("course_id")
              .eq("user_id", user.id)
          : Promise.resolve({ data: [] }),

        user
          ? supabase.from("purchases").select("course_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);

      if (cancelled) return;

      setCourses((coursesRes.data as Course[]) ?? []);
      setEnrolledIds(new Set(((enrollRes.data ?? []) as any[]).map((r) => r.course_id)));
      const pIds = new Set(((purchaseRes.data ?? []) as any[]).map((r) => r.course_id));

      // Subscription tier access
      if (user) {
        const { data: membership } = await supabase
          .from("memberships" as any)
          .select("subscription_id, subscriptions(tier_access), subscription_tiers(tier)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .gt("valid_until", new Date().toISOString())
          .maybeSingle();

        if (!cancelled && membership) {
          const tierAccess: string[] = (membership as any)?.subscriptions?.tier_access ?? [];
          if (!cancelled) setSubTiers(tierAccess);

          // Legacy: subscription_courses_v2 for specific course access
          if ((membership as any)?.subscription_id) {
            const { data: subCourses } = await supabase
              .from("subscription_courses_v2" as any)
              .select("course_id")
              .eq("subscription_id", (membership as any).subscription_id);

            if (!cancelled && subCourses) {
              (subCourses as any[]).forEach((sc) => pIds.add(sc.course_id));
            }
          }
        }
      }

      if (!cancelled) {
        setPurchasedIds(pIds);
        setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [user]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = new Set<string>();
    courses.forEach((c) => { if (c.category) cats.add(c.category); });
    return Array.from(cats).sort();
  }, [courses]);

  const isAccessible = (c: Course) =>
    c.tier === "free" ||
    enrolledIds.has(c.id) ||
    purchasedIds.has(c.id) ||
    subTiers.includes(c.tier);

  const filtered = useMemo(() => {
    let list = [...courses];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.subtitle ?? "").toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q) ||
          (c.instructor_name ?? "").toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== "All") list = list.filter((c) => c.category === selectedCategory);

    if (ownership === "enrolled") list = list.filter((c) => enrolledIds.has(c.id));
    else if (ownership === "free") list = list.filter((c) => c.tier === "free");
    else if (ownership === "paid") list = list.filter((c) => c.tier !== "free");
    else if (ownership === "certificate") list = list.filter((c) => c.pricing_tokens === 0 && c.tier !== "free");

    if (difficulty !== "all")
      list = list.filter((c) => (c.difficulty_level ?? "").toLowerCase() === difficulty);

    if (tierFilter !== "all")
      list = list.filter((c) => (c.tier ?? "").toLowerCase() === tierFilter);

    if (sortBy === "newest") list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === "oldest") list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortBy === "popular") list.sort((a, b) => (b.enrollment_count ?? 0) - (a.enrollment_count ?? 0));
    else if (sortBy === "az") list.sort((a, b) => a.title.localeCompare(b.title));

    return list;
  }, [courses, search, selectedCategory, ownership, difficulty, tierFilter, sortBy, enrolledIds]);

  const activeFilterCount = [
    ownership !== "all",
    difficulty !== "all",
    tierFilter !== "all",
    selectedCategory !== "All",
  ].filter(Boolean).length;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 space-y-2">
          <div className="h-9 w-64 animate-pulse rounded-2xl bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded-xl bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
              <div className="aspect-video animate-pulse bg-muted" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-5 w-full animate-pulse rounded-lg bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded-lg bg-muted" />
                <div className="flex gap-1.5 pt-1">
                  {[1, 2, 3].map((j) => <div key={j} className="h-5 w-14 animate-pulse rounded-full bg-muted" />)}
                </div>
                <div className="flex justify-between pt-3 border-t border-border/50">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-6xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl font-black tracking-tight">Learning Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover world-class professional certification programs.
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span><span className="font-bold text-foreground">{courses.length}</span> courses available</span>
          <span className="text-border">·</span>
          <span><span className="font-bold text-foreground">{enrolledIds.size}</span> enrolled</span>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 -mx-4 bg-background/95 backdrop-blur-md px-4 border-b border-border py-3 mb-6">
        {/* Row 1 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses…"
              className="pl-9 h-9 rounded-xl text-sm bg-muted/40 border-border/70 focus:bg-background"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-9 px-3 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="newest">Latest</option>
            <option value="oldest">Oldest</option>
            <option value="popular">Most Popular</option>
            <option value="az">A – Z</option>
          </select>

          {/* Ownership */}
          <select
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as OwnershipOption)}
            className="h-9 px-3 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="all">All Courses</option>
            <option value="enrolled">Enrolled</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="certificate">Certificate</option>
          </select>

          {/* Difficulty */}
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DifficultyOption)}
            className="h-9 px-3 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          {/* Tier */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TierOption)}
            className="h-9 px-3 rounded-xl border border-border bg-muted/40 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
          >
            <option value="all">All Tiers</option>
            <option value="free">Free</option>
            <option value="basic">Basic</option>
            <option value="premium">Premium</option>
            <option value="paid">Paid</option>
          </select>

          {/* Clear filters */}
          {(activeFilterCount > 0 || search) && (
            <button
              onClick={() => {
                setOwnership("all");
                setDifficulty("all");
                setTierFilter("all");
                setSelectedCategory("All");
                setSearch("");
              }}
              className="flex items-center gap-1 h-9 px-3 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive text-xs font-semibold hover:bg-destructive/10 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          )}
        </div>

        {/* Row 2: Category pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {["All", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-150 border ${
                  selectedCategory === cat
                    ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/25"
                    : "bg-background border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="mb-4 text-xs text-muted-foreground font-medium">
        Showing{" "}
        <span className="font-bold text-foreground">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "course" : "courses"}
        {search && (
          <> for <span className="italic text-foreground">"{search}"</span></>
        )}
      </p>

      {/* Course grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-24 text-center">
          <GraduationCap className="h-14 w-14 text-muted-foreground/25" />
          <p className="mt-4 font-semibold text-muted-foreground">No courses match your filters</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Try broadening your search or clearing active filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const isEnrolled = enrolledIds.has(c.id);
            const tierKey = (c.tier ?? "free").toLowerCase();
            const badgeCls = TIER_BADGE[tierKey] ?? "bg-slate-700 text-white";
            const gradient = gradientForId(c.id);

            return (
              <Link
                key={c.id}
                to="/courses/$courseId"
                params={{ courseId: c.id }}
                className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-muted">
                  {c.thumbnail_url ? (
                    <img
                      src={c.thumbnail_url}
                      alt={c.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient}`}
                    >
                      <PlayCircle className="h-12 w-12 text-white/30" />
                    </div>
                  )}

                  {/* Top badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider shadow ${badgeCls}`}
                    >
                      {c.tier === "free" ? "FREE" : `${c.pricing_tokens ?? 0} Tokens`}
                    </span>

                    {isEnrolled && (
                      <span className="flex items-center gap-0.5 rounded-full bg-slate-900/90 text-white px-2 py-0.5 text-[9px] font-bold shadow backdrop-blur-sm">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 fill-emerald-400" />
                        Enrolled
                      </span>
                    )}

                    {c.pricing_tokens === 0 && c.tier !== "free" && (
                      <span className="rounded-full bg-amber-500/90 text-white px-2 py-0.5 text-[9px] font-bold shadow">
                        🏆 Certificate
                      </span>
                    )}
                  </div>

                  {/* Duration badge */}
                  {c.duration_hours != null && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-black/60 text-white px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm">
                      {c.duration_hours}h
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="flex flex-1 flex-col p-5">
                  {/* Category · Difficulty */}
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>{c.category ?? "Course"}</span>
                    <span>·</span>
                    <span>{c.difficulty_level ?? "All Levels"}</span>
                  </div>

                  {/* Title */}
                  <h3 className="mt-2 font-display text-base font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {c.title}
                  </h3>

                  {/* Subtitle */}
                  {c.subtitle && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1 italic">
                      {c.subtitle}
                    </p>
                  )}

                  {/* Skills chips */}
                  {(c.skills_learned ?? []).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {(c.skills_learned ?? []).slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-primary/8 text-primary px-2 py-0.5 text-[9px] font-semibold border border-primary/15"
                        >
                          {skill}
                        </span>
                      ))}
                      {(c.skills_learned ?? []).length > 3 && (
                        <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[9px] font-semibold">
                          +{(c.skills_learned ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Instructor + rating */}
                  <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary uppercase">
                        {c.instructor_name?.[0] ?? "E"}
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[110px]">
                        {c.instructor_name ?? "Expert Educator"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-amber-400 text-xs leading-none">★</span>
                      <span className="text-xs font-bold">
                        {(c.avg_rating ?? 0) > 0 ? c.avg_rating.toFixed(1) : "4.9"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({c.enrollment_count ?? 0})
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  {isEnrolled ? (
                    <Link
                      to="/portal/$courseId"
                      params={{ courseId: c.id }}
                      onClick={(e) => e.stopPropagation()}
                      className="block mt-3"
                    >
                      <Button
                        size="sm"
                        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 shadow-sm shadow-emerald-600/20 transition-all"
                      >
                        Continue Learning →
                      </Button>
                    </Link>
                  ) : (
                    <p className="mt-3 text-center text-[11px] text-muted-foreground font-medium opacity-70">
                      Click to view details
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
