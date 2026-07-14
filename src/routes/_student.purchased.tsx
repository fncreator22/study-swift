import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, PlayCircle, GraduationCap, ChevronRight, CheckCircle2, 
  Search, SlidersHorizontal, ArrowUpDown, Clock, CheckCircle, 
  HelpCircle, AlertCircle, FileSpreadsheet, Archive, Award 
} from "lucide-react";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_student/purchased")({ component: Purchased });

function Purchased() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, in_progress, awaiting, under_review, certified, failed
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, progress, name

  useEffect(() => {
    if (!user) return;
    loadMyLearning();
  }, [user]);

  async function loadMyLearning() {
    setLoading(true);
    try {
      // 1. Fetch enrollments
      const { data: enrs } = await supabase
        .from("course_enrollments_v2")
        .select(`
          id,
          course_id,
          progress_pct,
          created_at,
          courses_v2 (
            id,
            title,
            description,
            thumbnail_url,
            category,
            tier
          )
        `)
        .eq("user_id", user.id);

      if (!enrs || enrs.length === 0) {
        setEnrollments([]);
        return;
      }

      const enrollIds = enrs.map((e: any) => e.id);
      const courseIds = enrs.map((e: any) => e.course_id);

      // 2. Fetch attempts
      const { data: attempts } = await supabase
        .from("course_assessment_attempts_v2")
        .select("id, enrollment_id, score, passed, status, submitted_at")
        .in("enrollment_id", enrollIds)
        .order("submitted_at", { ascending: false });

      // 3. Fetch certificates
      const { data: certs } = await supabase
        .from("course_certificates_v2" as any)
        .select("id, enrollment_id, certificate_number, issued_at")
        .in("enrollment_id", enrollIds);

      // Map everything together
      const mapped = enrs.map((e: any) => {
        const c = e.courses_v2;
        if (!c) return null;

        // Get matching attempts & certificates
        const matchAttempts = (attempts ?? []).filter((a: any) => a.enrollment_id === e.id);
        const matchCert = (certs ?? []).find((ct: any) => ct.enrollment_id === e.id);
        
        const latestAttempt = matchAttempts[0] || null;
        const progress = e.progress_pct ?? 0;

        // Determine dynamic status
        let status = "in_progress"; // default
        if (matchCert) {
          status = "certified";
        } else if (latestAttempt) {
          if (latestAttempt.status === "under_review") {
            status = "under_review";
          } else if (latestAttempt.status === "approved" || latestAttempt.passed) {
            status = "certified";
          } else if (latestAttempt.status === "rejected" || !latestAttempt.passed) {
            status = "failed";
          }
        } else if (progress >= 95) {
          status = "awaiting_assessment";
        }

        return {
          id: e.id,
          courseId: c.id,
          title: c.title,
          description: c.description,
          thumbnail_url: c.thumbnail_url,
          category: c.category || "General",
          tier: c.tier,
          progress,
          created_at: e.created_at,
          status,
          attempt: latestAttempt,
          certificate: matchCert
        };
      }).filter(Boolean);

      setEnrollments(mapped);
    } catch (err) {
      console.error("Error loading My Learning:", err);
    } finally {
      setLoading(false);
    }
  }

  // Filter & Sort computation
  const processed = useMemo(() => {
    let list = [...enrollments];

    // Search query filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((item) => item.status === statusFilter);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "progress") {
        return b.progress - a.progress;
      }
      if (sortBy === "name") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return list;
  }, [enrollments, searchQuery, statusFilter, sortBy]);

  if (loading) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse font-medium italic">
        Syncing your learning portal...
      </div>
    );
  }

  const filters = [
    { value: "all", label: "All Courses" },
    { value: "in_progress", label: "In Progress" },
    { value: "awaiting_assessment", label: "Awaiting Assessment" },
    { value: "under_review", label: "Under Review" },
    { value: "certified", label: "Certified" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-[#1e3a8a] dark:text-[#60a5fa] uppercase italic">
            My Learning Portal
          </h1>
          <p className="mt-1 text-xs text-muted-foreground font-semibold italic">
            Manage your course completion checklist, track grades, and download certificates.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-muted/30 dark:bg-muted/10 p-4 rounded-2xl border border-border">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search courses by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5 items-center">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filter:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-background border border-border px-3 py-1.5 rounded-xl focus:outline-none"
          >
            {filters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground ml-2">
            <ArrowUpDown className="h-3.5 w-3.5" /> Sort:
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-background border border-border px-3 py-1.5 rounded-xl focus:outline-none"
          >
            <option value="newest">Newest Enrolled</option>
            <option value="oldest">Oldest Enrolled</option>
            <option value="progress">Completion %</option>
            <option value="name">Course Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {processed.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-20 text-center bg-muted/10">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground text-sm font-semibold italic">No courses found matching this criteria.</p>
            <Link to="/courses" className="mt-4 inline-block">
              <Button size="sm" className="rounded-xl italic">Explore Learning Catalog</Button>
            </Link>
          </div>
        ) : (
          processed.map((item) => {
            // Status badge configs
            let badgeBg = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
            let badgeLabel = "In Progress";
            
            if (item.status === "certified") {
              badgeBg = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold";
              badgeLabel = "Certified";
            } else if (item.status === "under_review") {
              badgeBg = "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold";
              badgeLabel = "Under AI Review";
            } else if (item.status === "failed") {
              badgeBg = "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold";
              badgeLabel = "Reattempt Required";
            } else if (item.status === "awaiting_assessment") {
              badgeBg = "bg-amber-500/10 text-amber-600 dark:text-amber-500 font-extrabold";
              badgeLabel = "Awaiting Assessment";
            }

            return (
              <div key={item.id} className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft hover:shadow-card transition-all duration-300">
                {/* Image / Thumbnail */}
                <div className="relative aspect-video w-full bg-muted">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
                      <PlayCircle className="h-10 w-10 text-primary/30" />
                    </div>
                  )}
                  {/* Status Overlay Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-wider backdrop-blur-sm shadow-sm ${badgeBg}`}>
                      {badgeLabel}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                      {item.category} · {item.tier}
                    </span>
                    <h3 className="font-display text-base font-bold leading-tight line-clamp-1">{item.title}</h3>
                    <p className="line-clamp-2 text-xs text-muted-foreground/80 leading-relaxed">{item.description}</p>
                  </div>

                  {/* Progress segment */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-muted-foreground">Syllabus Completion</span>
                      <span className="text-primary">{item.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${item.progress >= 95 ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${item.progress}%` }} 
                      />
                    </div>
                  </div>

                  {/* Actions segment */}
                  <div className="pt-2 border-t border-border/50 flex gap-2">
                    {item.status === "certified" && (
                      <>
                        <Link to="/profile" className="flex-1">
                          <Button size="sm" className="w-full rounded-xl font-bold text-xs h-9 bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
                            <Award className="h-3.5 w-3.5" /> View Certificate
                          </Button>
                        </Link>
                        <Link to={`/portal/${item.courseId}` as any} className="shrink-0">
                          <Button size="sm" variant="outline" className="rounded-xl h-9 px-3">
                            Review Course
                          </Button>
                        </Link>
                      </>
                    )}

                    {item.status === "under_review" && (
                      <Button size="sm" disabled className="flex-1 rounded-xl font-bold text-xs h-9 bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1.5 border border-blue-500/20">
                        <Clock className="h-3.5 w-3.5 animate-spin" /> In Grading Queue
                      </Button>
                    )}

                    {item.status === "failed" && (
                      <Link to={`/portal/${item.courseId}/complete` as any} className="flex-1">
                        <Button size="sm" className="w-full rounded-xl font-bold text-xs h-9 bg-rose-500 hover:bg-rose-600 text-white gap-1">
                          <AlertCircle className="h-3.5 w-3.5" /> Reattempt Test
                        </Button>
                      </Link>
                    )}

                    {item.status === "awaiting_assessment" && (
                      <Link to={`/portal/${item.courseId}/complete` as any} className="flex-1">
                        <Button size="sm" className="w-full rounded-xl font-bold text-xs h-9 bg-amber-500 hover:bg-amber-600 text-white gap-1">
                          <GraduationCap className="h-3.5 w-3.5" /> Start Assessment
                        </Button>
                      </Link>
                    )}

                    {item.status === "in_progress" && (
                      <Link to={`/portal/${item.courseId}` as any} className="flex-1">
                        <Button size="sm" className="w-full rounded-xl font-bold text-xs h-9" variant="outline">
                          Continue Learning <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
