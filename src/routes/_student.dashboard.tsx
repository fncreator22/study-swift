import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { BookOpen, Trophy, History, PlayCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_student/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState({ tests: 0, attempts: 0, avg: 0, courses: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [latestTests, setLatestTests] = useState<any[]>([]);
  const [latestCourses, setLatestCourses] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: tests }, { data: rank }, { count: courses }, { data: prof }, { data: atts }, { data: lt }, { data: lc }] = await Promise.all([
        supabase.from("tests").select("id", { count: "exact", head: true }),
        supabase.from("rankings_view").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("test_attempts").select("id,score,total,submitted_at,tests(title,test_type)").eq("user_id", user.id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(3),
        supabase.from("tests").select("id,title,tier,category").order("created_at", { ascending: false }).limit(10),
        supabase.from("courses" as any).select("id,title,tier,category").order("created_at", { ascending: false }).limit(10),
      ]);
      setStats({
        tests: tests ?? 0,
        attempts: (rank?.attempts_count as number) ?? 0,
        avg: (rank?.avg_percentage as number) ?? 0,
        courses: courses ?? 0,
      });
      setName(prof?.full_name ?? "");
      setRecent(atts ?? []);
      setLatestTests(lt ?? []);
      setLatestCourses(lc ?? []);
      setLoading(false);
    })();
  }, [user]);

  const cards = [
    { t: "Assessments", v: stats.tests, icon: BookOpen, to: "/tests", color: "text-primary" },
    { t: "Attempts", v: stats.attempts, icon: History, to: "/history", color: "text-blue-500" },
    { t: "Performance", v: `${stats.avg}%`, icon: Trophy, to: "/rankings", color: "text-amber-500" },
    { t: "Courses", v: stats.courses, icon: PlayCircle, to: "/courses", color: "text-emerald-500" },
  ];

  if (loading) return <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse">Syncing your learning data...</div>;

  const MarqueeRow = ({ title, items, type }: { title: string, items: any[], type: 'test' | 'course' }) => (
    <div className="mt-8 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
        <Link to={type === 'test' ? "/tests" : "/courses"} className="text-[10px] font-bold text-primary hover:underline">View All</Link>
      </div>
      <div className="marquee-container">
        <div className="marquee-content">
          {[...items, ...items].map((it, i) => (
            <Link 
              key={`${it.id}-${i}`} 
              to={type === 'test' ? `/tests/${it.id}` : `/courses/${it.id}`}
              className="flex w-64 shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted`}>
                {type === 'test' ? <BookOpen className="h-4 w-4 text-primary/60" /> : <PlayCircle className="h-4 w-4 text-emerald-500/60" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold leading-tight">{it.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[9px] font-medium text-muted-foreground">
                   <span className="capitalize">{it.tier}</span>
                   <span className="h-0.5 w-0.5 rounded-full bg-border" />
                   <span className="truncate">{it.category || 'General'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Welcome back{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
          <p className="text-xs text-muted-foreground md:text-sm italic font-medium">Your preparation roadmap is ready.</p>
        </div>
        <div className="hidden sm:block">
           <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-soft">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Syncing Live</span>
           </div>
        </div>
      </div>

      {/* Compact Stats Grid */}
      <div className="dashboard-grid mt-8">
        {cards.map((c) => (
          <Link key={c.t} to={c.to} className="compact-card flex items-center gap-4">
            <div className={`grid h-10 w-10 place-items-center rounded-xl bg-muted/50 ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{c.t}</p>
              <p className="font-display text-xl font-bold leading-none mt-1">{c.v}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Main Content: Marquees */}
        <div className="lg:col-span-2">
           <MarqueeRow title="Newly Published Tests" items={latestTests} type="test" />
           <MarqueeRow title="Explore Fresh Courses" items={latestCourses} type="course" />
           
           <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <div className="flex items-center gap-3">
                 <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <Trophy className="h-5 w-5" />
                 </div>
                 <div>
                    <h3 className="font-display font-bold">Ready for a challenge?</h3>
                    <p className="text-xs text-muted-foreground">Jump into the latest leaderboard-ranked exam and boost your score.</p>
                 </div>
              </div>
              <Button className="mt-6 w-full rounded-xl font-bold" onClick={() => nav({ to: "/tests" })}>Explore All Tests</Button>
           </div>
        </div>

        {/* Sidebar: Recent Activity */}
        <div className="space-y-6">
           <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Recent Activity</h3>
              <div className="space-y-4">
                 {recent.length === 0 && <p className="text-[10px] text-muted-foreground italic text-center py-4">No recent activity found.</p>}
                 {recent.map((r) => (
                    <Link key={r.id} to="/tests/$testId/review/$attemptId" params={{ testId: r.test_id, attemptId: r.id }} className="group block">
                       <div className="flex items-center justify-between">
                          <p className="truncate text-xs font-bold group-hover:text-primary transition-colors">{r.tests?.title}</p>
                          <span className="text-[9px] font-bold text-muted-foreground">{new Date(r.submitted_at).toLocaleDateString()}</span>
                       </div>
                       <div className="mt-1 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                             <span className="text-[10px] font-medium text-muted-foreground capitalize">{r.tests?.test_type}</span>
                             <span className="h-0.5 w-0.5 rounded-full bg-border" />
                             <span className="text-[10px] font-bold text-success">{Math.round((r.score / r.total) * 100)}% Score</span>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                       </div>
                    </Link>
                 ))}
              </div>
              {recent.length > 0 && (
                 <Link to="/history" className="mt-6 block text-center text-[10px] font-bold text-primary hover:underline uppercase tracking-widest">
                    View Full History
                 </Link>
              )}
           </div>
           
           <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Learning Stats</h3>
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground">Accuracy</span>
                    <span className="text-[10px] font-bold font-mono">{stats.avg}%</span>
                 </div>
                 <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${stats.avg}%` }} />
                 </div>
                 <p className="text-[9px] text-muted-foreground italic">Maintaining a 70%+ score is recommended for top rankings.</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

