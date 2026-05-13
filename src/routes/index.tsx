import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlayCircle, BookOpen, GraduationCap, ArrowRight, Star, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const [tests, setTests] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("tests").select("*").order("created_at", { ascending: false }).limit(6),
      supabase.from("courses").select("*").order("created_at", { ascending: false }).limit(6),
    ]).then(([t, c]) => {
      setTests(t.data ?? []);
      setCourses(c.data ?? []);
    });
  }, []);

  const MarqueeRow = ({ title, items, type }: { title: string, items: any[], type: 'test' | 'course' }) => (
    <div className="mt-16 overflow-hidden">
      <div className="container mx-auto px-6 mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{type === 'course' ? 'Master new skills with video courses.' : 'Practice with realistic mock exams.'}</p>
        </div>
        <Link to={type === 'test' ? '/tests' : '/courses'} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline">View all</Link>
      </div>
      <div className="marquee-container">
        <div className="marquee-content">
          {(items.length > 0 ? [...items, ...items, ...items] : []).map((it, i) => (
            <div key={`${it.id}-${i}`} className="w-[340px] shrink-0 px-2">
              <ItemCard item={it} type={type} />
            </div>
          ))}
          {items.length === 0 && <p className="py-10 text-sm text-muted-foreground italic pl-10">New content arriving soon...</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-20 md:pt-32 md:pb-32">
        <div className="container relative z-10 mx-auto px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Zap className="h-3 w-3" /> Next-Gen Learning Platform
            </div>
            <h1 className="mt-6 font-display text-5xl font-black leading-[1.1] tracking-tight md:text-7xl animate-in fade-in slide-in-from-bottom-8 duration-700">
              Master your <span className="text-primary">exams</span> with confidence.
            </h1>
            <p className="mt-8 text-lg text-muted-foreground md:text-xl animate-in fade-in slide-in-from-bottom-12 duration-700 max-w-2xl">
              The most advanced LMS for professional certifications and academic excellence. 
              Real-time practice, expert-curated courses, and detailed analytics.
            </p>
            <div className="mt-10 flex flex-wrap gap-4 animate-in fade-in slide-in-from-bottom-16 duration-700">
              <Button size="lg" className="rounded-2xl h-14 px-8 text-base shadow-lg shadow-primary/20" asChild>
                <Link to="/login">Get Started Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-2xl h-14 px-8 text-base" asChild>
                <Link to="/courses">Explore Courses</Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative background elements */}
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-24 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
      </section>

      <MarqueeRow title="Popular Courses" items={courses} type="course" />
      <MarqueeRow title="Latest Mock Tests" items={tests} type="test" />

      {/* Recent Activity Marquee */}
      <div className="mt-16 overflow-hidden">
        <div className="container mx-auto px-6 mb-6">
          <h2 className="font-display text-2xl font-bold tracking-tight">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">See what other students are achieving right now.</p>
        </div>
        <div className="marquee-container bg-primary/5 py-6">
          <div className="marquee-content" style={{ animationDuration: '60s' }}>
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-full border border-primary/10 bg-card px-4 py-2 shadow-sm shrink-0">
                <div className="h-6 w-6 rounded-full bg-success/20 text-success grid place-items-center"><ShieldCheck className="h-3 w-3" /></div>
                <span className="text-xs font-bold whitespace-nowrap">
                  {["Ankit", "Priya", "John", "Sneha", "Vikram"][i % 5]} cleared {["Mock Test 4", "Banking Prep", "Final Review", "History Quiz"][i % 4]} with 92%
                </span>
              </div>
            ))}
            {[...Array(10)].map((_, i) => (
              <div key={`dup-${i}`} className="flex items-center gap-3 rounded-full border border-primary/10 bg-card px-4 py-2 shadow-sm shrink-0">
                <div className="h-6 w-6 rounded-full bg-success/20 text-success grid place-items-center"><ShieldCheck className="h-3 w-3" /></div>
                <span className="text-xs font-bold whitespace-nowrap">
                  {["Ankit", "Priya", "John", "Sneha", "Vikram"][i % 5]} cleared {["Mock Test 4", "Banking Prep", "Final Review", "History Quiz"][i % 4]} with 92%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <section className="mt-32 container mx-auto px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { t: "Expert Content", d: "Curated by top-tier instructors and subject matter experts with years of experience.", i: GraduationCap, bg: "bg-blue-500/10", c: "text-blue-500" },
            { t: "Real-time Feedback", d: "Instant results for MCQs and professional review workflow for essay-based written tests.", i: ShieldCheck, bg: "bg-success/10", c: "text-success" },
            { t: "Global Rankings", d: "Compete with thousands of students worldwide and track your percentile growth over time.", i: Star, bg: "bg-orange-500/10", c: "text-orange-500" },
          ].map((f) => (
            <div key={f.t} className="group rounded-3xl border border-border bg-card p-8 shadow-soft transition-all hover:border-primary/20 hover:shadow-card">
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${f.bg} ${f.c}`}>
                <f.i className="h-6 w-6" />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Success Stories */}
      <section className="mt-32 bg-muted/30 py-24 border-y border-border/50">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-4xl font-bold tracking-tight">Success Stories</h2>
            <p className="mt-4 text-muted-foreground">Join thousands of students who have already transformed their careers through Examly.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { n: "Aditya Verma", c: "IIT Delhi", r: "The mock tests are incredibly realistic. The interface is clean and doesn't distract from the actual exam content." },
              { n: "Sarah Jenkins", c: "Stanford Online", r: "The written test review workflow is a game changer. Actual human feedback helps you improve your essay style." },
              { n: "Rahul S.", c: "NIT Trichy", r: "Fast, sleek, and works perfectly on my phone. I can practice during my commute without any lag." },
            ].map((s, i) => (
              <div key={i} className="rounded-3xl border border-border bg-card p-8 shadow-soft transition-all hover:shadow-card">
                <div className="flex gap-1 text-orange-400">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="mt-6 text-sm italic leading-relaxed text-muted-foreground">"{s.r}"</p>
                <div className="mt-8 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 grid place-items-center font-bold text-primary text-xs">{s.n[0]}</div>
                  <div>
                    <p className="text-sm font-bold">{s.n}</p>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{s.c}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mt-32 container mx-auto px-6">
        <div className="rounded-[40px] bg-primary p-12 text-center text-primary-foreground shadow-2xl shadow-primary/20 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-display text-4xl font-bold md:text-5xl">Ready to start your journey?</h2>
            <p className="mt-4 text-primary-foreground/80 max-w-lg mx-auto">Create a free account today and get access to our starter mock tests and introductory courses.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Button variant="secondary" size="lg" className="rounded-2xl h-14 px-8 text-base font-bold" asChild>
                <Link to="/signup">Create Free Account</Link>
              </Button>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />
          <div className="absolute bottom-0 left-0 h-32 w-32 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/10" />
        </div>
      </section>
    </div>
  );
}

const ItemCard = ({ item, type }: { item: any, type: 'test' | 'course' }) => (
  <div className="group overflow-hidden rounded-[32px] border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-card active:scale-[0.98]">
    <div className="relative aspect-video w-full bg-muted">
      {item.thumbnail_url ? (
        <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary/10">
          {type === 'test' ? <BookOpen className="h-16 w-16" /> : <PlayCircle className="h-16 w-16" />}
        </div>
      )}
      <div className="absolute top-4 left-4">
        <span className="rounded-full bg-background/90 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest backdrop-blur">
          {item.tier}
        </span>
      </div>
    </div>
    <div className="p-6">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        <span>{item.category || (type === 'test' ? 'Academic' : 'Professional')}</span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>{item.difficulty || 'All Levels'}</span>
      </div>
      <h3 className="font-display font-bold text-xl leading-tight group-hover:text-primary transition-colors line-clamp-1">{item.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <span className="text-base font-black text-foreground">{item.tier === 'free' ? 'FREE' : `₹${item.price}`}</span>
        <Button size="sm" variant="ghost" className="rounded-xl font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all px-4">
          View Detail <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </div>
);
