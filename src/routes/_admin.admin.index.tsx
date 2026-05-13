import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, BookOpen, PlayCircle, FileCheck, TrendingUp, Calendar } from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from 'recharts';

export const Route = createFileRoute("/_admin/admin/")({ component: AdminHome });

const growthData = [
  { name: 'Mon', users: 4 },
  { name: 'Tue', users: 7 },
  { name: 'Wed', users: 12 },
  { name: 'Thu', users: 15 },
  { name: 'Fri', users: 22 },
  { name: 'Sat', users: 30 },
  { name: 'Sun', users: 38 },
];

const yearlyData = [
  { month: 'Jan', count: 120 },
  { month: 'Feb', count: 210 },
  { month: 'Mar', count: 450 },
  { month: 'Apr', count: 680 },
  { month: 'May', count: 890 },
  { month: 'Jun', count: 1100 },
];

function AdminHome() {
  const [s, setS] = useState({ users: 0, tests: 0, courses: 0, reviews: 0 });
  
  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("tests").select("id", { count: "exact", head: true }),
      supabase.from("courses").select("id", { count: "exact", head: true }),
      supabase.from("test_attempts").select("id", { count: "exact", head: true }).not("submitted_at", "is", null),
    ]).then(([u, t, c, r]) => setS({ 
      users: u.count ?? 0, 
      tests: t.count ?? 0, 
      courses: c.count ?? 0, 
      reviews: r.count ?? 0 
    }));
  }, []);

  const cards = [
    { l: "Total Users", v: s.users, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { l: "Active Tests", v: s.tests, icon: BookOpen, color: "text-purple-500", bg: "bg-purple-500/10" },
    { l: "Courses", v: s.courses, icon: PlayCircle, color: "text-orange-500", bg: "bg-orange-500/10" },
    { l: "Submissions", v: s.reviews, icon: FileCheck, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  return (
    <div className="mx-auto max-w-6xl pb-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">System Overview</h1>
        <p className="text-sm text-muted-foreground italic font-medium">Real-time platform performance & user growth metrics.</p>
      </div>
      
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="rounded-3xl border border-border bg-card p-5 shadow-soft hover:border-primary/20 transition-all">
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-2xl ${c.bg} ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{c.l}</p>
                <p className="font-display text-2xl font-bold leading-none mt-1">{c.v}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold">Weekly User Growth</h2>
            </div>
            <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full uppercase">+12% this week</span>
          </div>
          <div className="h-[240px] w-full">
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
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <h2 className="font-display text-lg font-bold">Yearly Expansion</h2>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'hsl(var(--muted-foreground))'}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  cursor={{fill: 'hsl(var(--muted)/0.4)'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {yearlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === yearlyData.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.3)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
