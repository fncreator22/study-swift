import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, PlayCircle, FileCheck, TrendingUp, Calendar } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from 'recharts';

export const Route = createFileRoute("/_admin/admin/")({ component: AdminHome });

type TimeFilter = 'live' | 'hour' | 'weekly' | 'days' | 'monthly' | 'yearly' | 'all time';

function AdminHome() {
  const [s, setS] = useState({ users: 0, tests: 0, courses: 0, reviews: 0 });
  const [profiles, setProfiles] = useState<{ created_at: string }[]>([]);
  const [attempts, setAttempts] = useState<{ submitted_at: string | null }[]>([]);
  const [filter, setFilter] = useState<TimeFilter>("weekly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("profiles").select("id, created_at"),
      supabase.from("tests").select("id", { count: "exact", head: true }),
      supabase.from("courses").select("id", { count: "exact", head: true }),
      supabase.from("test_attempts").select("id, submitted_at").not("submitted_at", "is", null),
    ]).then(([u, t, c, r]) => {
      setProfiles(u.data ?? []);
      setAttempts(r.data ?? []);
      setS({ 
        users: u.data?.length ?? 0, 
        tests: t.count ?? 0, 
        courses: c.count ?? 0, 
        reviews: r.data?.length ?? 0 
      });
      setLoading(false);
    });
  }, []);

  const filters: { value: TimeFilter; label: string }[] = [
    { value: "live", label: "Live" },
    { value: "hour", label: "Hourly" },
    { value: "weekly", label: "Weekly" },
    { value: "days", label: "30 Days" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "all time", label: "All Time" },
  ];

  function getAggregatedData() {
    const now = new Date();
    let growthData: { name: string; users: number }[] = [];
    let expansionData: { month: string; count: number }[] = [];
    let baselineUsers = 0;
    let windowStart: Date | null = null;

    if (filter === 'live') windowStart = new Date(now.getTime() - 60 * 60 * 1000);
    else if (filter === 'hour') windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    else if (filter === 'weekly') windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (filter === 'days') windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (filter === 'monthly') windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (filter === 'yearly') windowStart = new Date(now.getFullYear(), 0, 1);

    if (windowStart) {
      baselineUsers = profiles.filter(p => new Date(p.created_at) < windowStart!).length;
    }

    if (filter === 'live') {
      for (let i = 5; i >= 0; i--) {
        const bStart = new Date(now.getTime() - (i + 1) * 10 * 60 * 1000);
        const bEnd = new Date(now.getTime() - i * 10 * 60 * 1000);
        const label = i === 0 ? "Now" : `${i * 10}m ago`;
        
        const users = profiles.filter(p => {
          const d = new Date(p.created_at);
          return d >= bStart && d < bEnd;
        }).length;
        
        const count = attempts.filter(a => {
          if (!a.submitted_at) return false;
          const d = new Date(a.submitted_at);
          return d >= bStart && d < bEnd;
        }).length;

        growthData.push({ name: label, users });
        expansionData.push({ month: label, count });
      }
    } else if (filter === 'hour') {
      for (let i = 23; i >= 0; i--) {
        const bStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
        const bEnd = new Date(now.getTime() - i * 60 * 60 * 1000);
        const label = `${bStart.getHours()}:00`;
        
        const users = profiles.filter(p => {
          const d = new Date(p.created_at);
          return d >= bStart && d < bEnd;
        }).length;
        
        const count = attempts.filter(a => {
          if (!a.submitted_at) return false;
          const d = new Date(a.submitted_at);
          return d >= bStart && d < bEnd;
        }).length;

        growthData.push({ name: label, users });
        expansionData.push({ month: label, count });
      }
    } else if (filter === 'weekly') {
      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const label = targetDate.toLocaleDateString('en-US', { weekday: 'short' });
        
        const users = profiles.filter(p => {
          const d = new Date(p.created_at);
          return d.toDateString() === targetDate.toDateString();
        }).length;
        
        const count = attempts.filter(a => {
          if (!a.submitted_at) return false;
          const d = new Date(a.submitted_at);
          return d.toDateString() === targetDate.toDateString();
        }).length;

        growthData.push({ name: label, users });
        expansionData.push({ month: label, count });
      }
    } else if (filter === 'days') {
      for (let i = 29; i >= 0; i--) {
        const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const label = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const users = profiles.filter(p => {
          const d = new Date(p.created_at);
          return d.toDateString() === targetDate.toDateString();
        }).length;
        
        const count = attempts.filter(a => {
          if (!a.submitted_at) return false;
          const d = new Date(a.submitted_at);
          return d.toDateString() === targetDate.toDateString();
        }).length;

        growthData.push({ name: label, users });
        expansionData.push({ month: label, count });
      }
    } else if (filter === 'monthly') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth(), i);
        const label = `${i}`;
        
        if (targetDate > now) break;

        const users = profiles.filter(p => {
          const d = new Date(p.created_at);
          return d.toDateString() === targetDate.toDateString();
        }).length;
        
        const count = attempts.filter(a => {
          if (!a.submitted_at) return false;
          const d = new Date(a.submitted_at);
          return d.toDateString() === targetDate.toDateString();
        }).length;

        growthData.push({ name: label, users });
        expansionData.push({ month: label, count });
      }
    } else if (filter === 'yearly') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = now.getMonth();
      for (let i = 0; i <= currentMonth; i++) {
        const label = months[i];
        
        const users = profiles.filter(p => {
          const d = new Date(p.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === i;
        }).length;
        
        const count = attempts.filter(a => {
          if (!a.submitted_at) return false;
          const d = new Date(a.submitted_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === i;
        }).length;

        growthData.push({ name: label, users });
        expansionData.push({ month: label, count });
      }
    } else if (filter === 'all time') {
      const currentYear = now.getFullYear();
      for (let i = 4; i >= 0; i--) {
        const targetYear = currentYear - i;
        const label = `${targetYear}`;
        
        const users = profiles.filter(p => {
          const d = new Date(p.created_at);
          return d.getFullYear() === targetYear;
        }).length;
        
        const count = attempts.filter(a => {
          if (!a.submitted_at) return false;
          const d = new Date(a.submitted_at);
          return d.getFullYear() === targetYear;
        }).length;

        growthData.push({ name: label, users });
        expansionData.push({ month: label, count });
      }
    }

    let cumulativeUsers = baselineUsers;
    growthData = growthData.map(item => {
      cumulativeUsers += item.users;
      return { name: item.name, users: cumulativeUsers };
    });

    return { growthData, expansionData };
  }

  const { growthData, expansionData } = getAggregatedData();

  const cards = [
    { l: "Total Users", v: s.users, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { l: "Active Tests", v: s.tests, icon: BookOpen, color: "text-purple-500", bg: "bg-purple-500/10" },
    { l: "Courses", v: s.courses, icon: PlayCircle, color: "text-orange-500", bg: "bg-orange-500/10" },
    { l: "Submissions", v: s.reviews, icon: FileCheck, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">System Overview</h1>
          <p className="text-sm text-muted-foreground italic font-medium">Real-time platform performance & user growth metrics.</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === f.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.l} className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-soft hover:border-primary/20 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-2xl shrink-0 ${c.bg} ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{c.l}</p>
                <p className="font-display text-lg sm:text-2xl font-bold leading-none mt-1">{c.v}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-4 md:p-6 shadow-soft overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold">User Growth</h2>
            </div>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">{filter} view</span>
          </div>
          <div className="h-[200px] md:h-[240px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">Loading growth chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 md:p-6 shadow-soft overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <h2 className="font-display text-lg font-bold">Submissions</h2>
            </div>
            <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full uppercase">{filter} view</span>
          </div>
          <div className="h-[200px] md:h-[240px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">Loading submissions chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expansionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}} />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.4)'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {expansionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === expansionData.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.3)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-soft text-center bg-gradient-to-br from-card to-primary/5">
        <h3 className="font-display text-xl font-bold">Revenue Readiness</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Monetization features are ready to scale. Once you connect a payment gateway, you can track real-time revenue and subscription growth here.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-primary">₹0.00</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today's Revenue</span>
          </div>
          <div className="h-10 w-px bg-border self-center" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold">0</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Premium Users</span>
          </div>
        </div>
      </div>
    </div>
  );
}
