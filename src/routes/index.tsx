import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlayCircle, BookOpen, GraduationCap, ArrowRight, Star, ShieldCheck, Zap, BarChart3, Clock, Trophy, Users, MessageSquare, Mail, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tests, setTests] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Campaign popup states, queue, and analytics refs
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignQueue, setCampaignQueue] = useState<any[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [allSubscriptions, setAllSubscriptions] = useState<any[]>([]);
  const [selectedPlanForCampaign, setSelectedPlanForCampaign] = useState<any>(null);
  
  const openedAtRef = useRef<number>(0);
  const hasLoggedClickOrCloseForActiveCampaignRef = useRef<boolean>(false);
  const viewEventLoggedRef = useRef<boolean>(false);

  useEffect(() => {
    Promise.all([
      supabase.from("tests").select("*").order("created_at", { ascending: false }).limit(6),
      supabase.from("courses").select("*").order("created_at", { ascending: false }).limit(6),
    ]).then(([t, c]) => {
      setTests(t.data ?? []);
      setCourses(c.data ?? []);
    });
  }, []);

  const handleCampaignDismiss = (isUpgradeClick = false) => {
    if (!activeCampaign) return;
    const secondsSpent = Math.round((Date.now() - openedAtRef.current) / 1000);
    
    if (!hasLoggedClickOrCloseForActiveCampaignRef.current) {
      hasLoggedClickOrCloseForActiveCampaignRef.current = true;
      const metric = isUpgradeClick ? 'click' : 'close';
      supabase.rpc("increment_campaign_metric", {
        _campaign_id: activeCampaign.id,
        _metric: metric,
        _seconds: secondsSpent
      }).then(() => {});
    }

    setCampaignOpen(false);

    // Schedule next campaign in queue after a 10s gap to prevent stacking
    const nextIdx = queueIndex + 1;
    if (nextIdx < campaignQueue.length) {
      setTimeout(() => {
        const nextCampaign = campaignQueue[nextIdx];
        setQueueIndex(nextIdx);
        setActiveCampaign(nextCampaign);
        setCampaignOpen(true);
        sessionStorage.setItem(`shown_campaign_${nextCampaign.id}`, "true");

        if (nextCampaign.plan_mode === 'all') {
          supabase.from("subscriptions" as any)
            .select("*")
            .eq("is_active", true)
            .then(({ data: subs }) => {
              setAllSubscriptions(subs ?? []);
              if (subs && subs.length > 0) {
                setSelectedPlanForCampaign(subs[0]);
              }
            });
        }
      }, 10000);
    }
  };

  async function handleCampaignClick() {
    if (!activeCampaign) return;
    handleCampaignDismiss(true);
    nav({ to: "/signup" });
  }

  // Load landing trigger campaigns
  useEffect(() => {
    supabase.from("marketing_campaigns")
      .select("*, subscriptions(*)")
      .eq("is_active", true)
      .eq("display_trigger", "landing")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const unshown = data.filter(c => !sessionStorage.getItem(`shown_campaign_${c.id}`));
          if (unshown.length > 0) {
            setCampaignQueue(unshown);
            setQueueIndex(0);
            
            const first = unshown[0];
            setActiveCampaign(first);
            setCampaignOpen(true);
            sessionStorage.setItem(`shown_campaign_${first.id}`, "true");

            if (first.plan_mode === 'all') {
              supabase.from("subscriptions" as any)
                .select("*")
                .eq("is_active", true)
                .then(({ data: subs }) => {
                  setAllSubscriptions(subs ?? []);
                  if (subs && subs.length > 0) {
                    setSelectedPlanForCampaign(subs[0]);
                  }
                });
            }
          }
        }
      });
  }, []);

  // Campaign 35s auto-dismiss + view-count at 5s
  useEffect(() => {
    if (campaignOpen && activeCampaign) {
      openedAtRef.current = Date.now();
      hasLoggedClickOrCloseForActiveCampaignRef.current = false;
      viewEventLoggedRef.current = false;

      // View count recorded after 5 seconds of opening
      const viewTimer = setTimeout(async () => {
        if (!viewEventLoggedRef.current) {
          viewEventLoggedRef.current = true;
          await supabase.rpc("increment_campaign_metric", {
            _campaign_id: activeCampaign.id,
            _metric: 'view',
            _seconds: 5
          });
        }
      }, 5000);

      // Auto-dismiss at 35s
      const closeTimer = setTimeout(() => {
        handleCampaignDismiss(false);
      }, 35000);

      return () => {
        clearTimeout(viewTimer);
        clearTimeout(closeTimer);
      };
    }
  }, [campaignOpen, activeCampaign]);

  const MarqueeRow = ({ title, items, type }: { title: string, items: any[], type: 'test' | 'course' }) => (
    <div className="mt-16 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{type === 'course' ? 'Master new skills with video courses.' : 'Practice with realistic mock exams.'}</p>
        </div>
        <Link to={type === 'test' ? '/tests' : '/courses'} className="text-xs font-bold uppercase tracking-widest text-primary hover:underline shrink-0 ml-4">View all</Link>
      </div>
      <div className="marquee-container">
        <div className="marquee-content">
          {(items.length > 0 ? [...items, ...items, ...items] : []).map((it, i) => (
            <div key={`${it.id}-${i}`} className="w-[280px] sm:w-[340px] shrink-0 px-2">
              <ItemCard item={it} type={type} isLoggedIn={!!user} />
            </div>
          ))}
          {items.length === 0 && <p className="py-10 text-sm text-muted-foreground italic pl-10">New content arriving soon...</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-16 md:pt-32 md:pb-32">
        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Zap className="h-3 w-3" /> Next-Gen Learning Platform
            </div>
            <h1 className="mt-6 font-display text-4xl sm:text-5xl font-black leading-[1.1] tracking-tight md:text-7xl animate-in fade-in slide-in-from-bottom-8 duration-700">
              Master your <span className="gradient-text font-black">exams</span> with confidence.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground md:text-xl animate-in fade-in slide-in-from-bottom-12 duration-700 max-w-2xl">
              The most advanced LMS for professional certifications and academic excellence.
              Real-time practice, expert-curated courses, and detailed analytics.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-16 duration-700">
              <Button size="lg" className="rounded-2xl h-12 sm:h-14 px-6 sm:px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] glow-effect w-full sm:w-auto" asChild>
                <Link to="/login">Get Started Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-2xl h-12 sm:h-14 px-6 sm:px-8 text-base transition-all duration-300 hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto" asChild>
                <Link to="/courses">Explore Courses</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-10 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {["Free to start", "No credit card needed", "Instant access"].map((b) => (
                <div key={b} className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  <span className="font-medium">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-primary/10 blur-3xl animate-pulse duration-[8000ms] pointer-events-none" />
        <div className="absolute top-1/2 -left-24 h-48 w-48 sm:h-64 sm:w-64 rounded-full bg-accent/8 blur-3xl pointer-events-none" />
        <div className="absolute bottom-12 right-1/4 h-60 w-60 sm:h-80 sm:w-80 rounded-full bg-primary/5 blur-3xl animate-pulse duration-[12000ms] pointer-events-none" />
      </section>

      {/* ── STATS STRIP ── */}
      <section className="border-y border-border bg-muted/30 py-6">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { v: "10K+", l: "Students" },
              { v: "500+", l: "Mock Tests" },
              { v: "200+", l: "Courses" },
              { v: "98%", l: "Satisfaction" },
            ].map((s) => (
              <div key={s.l}>
                <p className="font-display text-2xl sm:text-3xl font-black text-foreground">{s.v}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARQUEES ── */}
      <MarqueeRow title="Popular Courses" items={courses} type="course" />
      <MarqueeRow title="Latest Mock Tests" items={tests} type="test" />

      {/* ── RECENT ACTIVITY ── */}
      <div className="mt-16 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 mb-6">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">Recent Activity</h2>
          <p className="text-sm text-muted-foreground">See what other students are achieving right now.</p>
        </div>
        <div className="marquee-container bg-primary/5 py-6">
          <div className="marquee-content" style={{ animationDuration: '60s' }}>
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-full border border-primary/10 bg-card px-4 py-2 shadow-sm shrink-0">
                <div className="h-6 w-6 rounded-full bg-success/20 text-success grid place-items-center shrink-0"><ShieldCheck className="h-3 w-3" /></div>
                <span className="text-xs font-bold whitespace-nowrap">
                  {["Ankit", "Priya", "John", "Sneha", "Vikram"][i % 5]} cleared {["Mock Test 4", "Banking Prep", "Final Review", "History Quiz"][i % 4]} with 92%
                </span>
              </div>
            ))}
            {[...Array(10)].map((_, i) => (
              <div key={`dup-${i}`} className="flex items-center gap-3 rounded-full border border-primary/10 bg-card px-4 py-2 shadow-sm shrink-0">
                <div className="h-6 w-6 rounded-full bg-success/20 text-success grid place-items-center shrink-0"><ShieldCheck className="h-3 w-3" /></div>
                <span className="text-xs font-bold whitespace-nowrap">
                  {["Ankit", "Priya", "John", "Sneha", "Vikram"][i % 5]} cleared {["Mock Test 4", "Banking Prep", "Final Review", "History Quiz"][i % 4]} with 92%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section className="mt-24 sm:mt-32 container mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-12 sm:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">How Examly works</h2>
          <p className="mt-4 text-muted-foreground">Go from registration to ranked performance in three easy steps.</p>
        </div>
        <div className="grid gap-6 sm:gap-8 md:grid-cols-3">
          {[
            { n: "01", t: "Create Account", d: "Sign up free in under 60 seconds. No payment card required to get started.", icon: Users },
            { n: "02", t: "Pick & Practice", d: "Browse hundreds of mock tests and video courses. Track your time and marks per question.", icon: Clock },
            { n: "03", t: "Climb Rankings", d: "Submit your attempts, get instant scores, and appear on the global leaderboard.", icon: Trophy },
          ].map((s) => (
            <div key={s.n} className="flex flex-col gap-4 p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-soft">
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl font-black text-primary/20">{s.n}</span>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
              </div>
              <h3 className="font-display text-xl font-bold">{s.t}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE GRID ── */}
      <section className="mt-24 sm:mt-32 container mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-12 sm:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Everything you need to succeed</h2>
          <p className="mt-4 text-muted-foreground">Examly combines real exam simulation with professional analytics and structured learning paths.</p>
        </div>
        <div className="grid gap-6 sm:gap-8 md:grid-cols-3">
          {[
            { t: "Expert Content", d: "Curated by top-tier instructors and subject matter experts with years of experience.", i: GraduationCap, bg: "bg-blue-500/10", c: "text-blue-500" },
            { t: "Real-time Feedback", d: "Instant results for MCQs and professional review workflow for essay-based written tests.", i: ShieldCheck, bg: "bg-success/10", c: "text-success" },
            { t: "Global Rankings", d: "Compete with thousands of students worldwide and track your percentile growth over time.", i: Star, bg: "bg-orange-500/10", c: "text-orange-500" },
            { t: "Detailed Analytics", d: "Per-question breakdown, score trends, and accuracy metrics to identify weak spots.", i: BarChart3, bg: "bg-purple-500/10", c: "text-purple-500" },
            { t: "Token Wallet", d: "Pay only for what you need. Buy tokens to unlock individual tests or subscribe for full access.", i: Zap, bg: "bg-amber-500/10", c: "text-amber-500" },
            { t: "Live Support", d: "Built-in support ticketing with admin chat. Get help when you need it, anonymously or logged in.", i: MessageSquare, bg: "bg-teal-500/10", c: "text-teal-500" },
          ].map((f) => (
            <div key={f.t} className="group rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft transition-all hover:border-primary/20 hover:shadow-card">
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${f.bg} ${f.c}`}>
                <f.i className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-xl font-bold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SUCCESS STORIES ── */}
      <section className="mt-24 sm:mt-32 bg-muted/30 py-16 sm:py-24 border-y border-border/50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Success Stories</h2>
            <p className="mt-4 text-muted-foreground">Join thousands of students who have already transformed their careers through Examly.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { n: "Aditya Verma", c: "IIT Delhi", r: "The mock tests are incredibly realistic. The interface is clean and doesn't distract from the actual exam content." },
              { n: "Sarah Jenkins", c: "Stanford Online", r: "The written test review workflow is a game changer. Actual human feedback helps you improve your essay style." },
              { n: "Rahul S.", c: "NIT Trichy", r: "Fast, sleek, and works perfectly on my phone. I can practice during my commute without any lag." },
            ].map((s, i) => (
              <div key={i} className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft transition-all hover:shadow-card">
                <div className="flex gap-1 text-orange-400">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="mt-5 text-sm italic leading-relaxed text-muted-foreground">"{s.r}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 grid place-items-center font-bold text-primary text-xs shrink-0">{s.n[0]}</div>
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

      {/* ── FINAL CTA ── */}
      <section className="mt-24 sm:mt-32 container mx-auto px-4 sm:px-6 pb-24 sm:pb-0">
        <div className="rounded-[28px] sm:rounded-[40px] bg-primary p-8 sm:p-12 text-center text-primary-foreground shadow-2xl shadow-primary/20 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-display text-3xl sm:text-4xl font-bold md:text-5xl">Ready to start your journey?</h2>
            <p className="mt-4 text-primary-foreground/80 max-w-lg mx-auto text-sm sm:text-base">Create a free account today and get access to our starter mock tests and introductory courses.</p>
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
              <Button variant="secondary" size="lg" className="rounded-2xl h-12 sm:h-14 px-6 sm:px-8 text-base font-bold w-full sm:w-auto" asChild>
                <Link to="/signup">Create Free Account</Link>
              </Button>
              <Button variant="outline" size="lg" className="rounded-2xl h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold bg-transparent border-white/30 text-primary-foreground hover:bg-white/10 w-full sm:w-auto" asChild>
                <Link to="/support">Contact Support</Link>
              </Button>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-32 w-32 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/10 pointer-events-none" />
        </div>
      </section>

      {/* ── PRODUCTION FOOTER ── */}
      <footer className="mt-24 border-t border-border/40 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid gap-10 sm:gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 font-display text-lg font-bold mb-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground shrink-0">
                  <GraduationCap className="h-4 w-4" />
                </span>
                Examly
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                The next-generation LMS built for professional certifications, academic excellence, and competitive exam preparation.
              </p>
              <p className="mt-4 text-xs text-muted-foreground font-medium">Trusted by students across India and beyond.</p>
            </div>

            {/* Platform */}
            <div>
              <h4 className="font-display text-sm font-bold uppercase tracking-widest mb-4">Platform</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link to="/courses" className="hover:text-primary hover:underline transition-colors">Courses</Link></li>
                <li><Link to="/tests" className="hover:text-primary hover:underline transition-colors">Practice Tests</Link></li>
                <li><Link to="/subscriptions" className="hover:text-primary hover:underline transition-colors">Subscriptions & Plans</Link></li>
                <li><Link to="/rankings" className="hover:text-primary hover:underline transition-colors">Global Rankings</Link></li>
                <li><Link to="/wallet" className="hover:text-primary hover:underline transition-colors">Token Wallet</Link></li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="font-display text-sm font-bold uppercase tracking-widest mb-4">Account</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-primary hover:underline transition-colors">Sign In</Link></li>
                <li><Link to="/signup" className="hover:text-primary hover:underline transition-colors">Create Account</Link></li>
                <li><Link to="/dashboard" className="hover:text-primary hover:underline transition-colors">Dashboard</Link></li>
                <li><Link to="/history" className="hover:text-primary hover:underline transition-colors">Attempt History</Link></li>
                <li><Link to="/profile" className="hover:text-primary hover:underline transition-colors">Profile & Settings</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-display text-sm font-bold uppercase tracking-widest mb-4">Support</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link to="/support" className="hover:text-primary hover:underline transition-colors">Help & Support</Link></li>
                <li>
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>support@examly.app</span>
                  </span>
                </li>
              </ul>
              <div className="mt-6 rounded-xl bg-primary/5 border border-primary/10 p-4">
                <p className="text-xs font-bold text-foreground mb-1">Need help urgently?</p>
                <p className="text-xs text-muted-foreground">Use the anonymous support ticket system — no account required.</p>
                <Link to="/support" className="mt-2 inline-flex text-xs font-bold text-primary hover:underline">Open a ticket →</Link>
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Examly. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <Link to="/privacy" className="hover:text-primary hover:underline transition-colors font-medium">Privacy Policy</Link>
              <span className="hidden sm:inline text-border">|</span>
              <Link to="/terms" className="hover:text-primary hover:underline transition-colors font-medium">Terms of Service</Link>
              <span className="hidden sm:inline text-border">|</span>
              <Link to="/refund" className="hover:text-primary hover:underline transition-colors font-medium">Refund Policy</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Marketing Campaign Pop-up */}
      <Dialog open={campaignOpen} onOpenChange={(open) => { if (!open) handleCampaignDismiss(false); }}>
        <DialogContent className="sm:max-w-[460px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
              <span>{activeCampaign?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Exclusive promotional offer.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <p className="text-sm text-foreground font-medium">{activeCampaign?.description}</p>
            
            {/* Specific Plan Mode */}
            {activeCampaign?.plan_mode === 'specific' && activeCampaign?.subscriptions && (
              <div className="rounded-2xl border p-4 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{activeCampaign.subscriptions.name}</span>
                  <span className="font-bold text-primary text-sm">₹{activeCampaign.subscriptions.price_inr}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Includes {activeCampaign.subscriptions.token_price} tokens and unlocks premium features for {activeCampaign.subscriptions.duration_days} days.
                </p>
              </div>
            )}

            {/* All Plans Mode */}
            {activeCampaign?.plan_mode === 'all' && (
              <div className="space-y-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select a Subscription Package</Label>
                <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                  {allSubscriptions.map(s => {
                    const isSelected = selectedPlanForCampaign?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedPlanForCampaign(s)}
                        className={`cursor-pointer rounded-xl border p-3 flex items-center justify-between transition-all ${
                          isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs text-foreground">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{s.token_price} tokens · {s.duration_days} days</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xs text-primary">₹{s.price_inr}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Plan Mode */}
            {activeCampaign?.plan_mode === 'custom' && activeCampaign?.custom_description && (
              <div className="rounded-2xl border p-3 bg-muted/20 text-xs text-muted-foreground space-y-1">
                {activeCampaign.custom_description.split(/•|\n/).map(x => x.trim()).filter(Boolean).map((pt, i) => (
                  <p key={i} className="flex items-start gap-1">
                    <span>•</span>
                    <span>{pt}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleCampaignDismiss(false)} className="rounded-xl">Close</Button>
            <Button 
              onClick={handleCampaignClick} 
              className="rounded-xl bg-primary text-primary-foreground font-bold"
            >
              Sign Up & Upgrade Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CardContentInner = ({ item, type }: { item: any, type: 'test' | 'course' }) => (
  <div className="group overflow-hidden rounded-[28px] sm:rounded-[32px] border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-primary/20 hover:shadow-card active:scale-[0.98] cursor-pointer">
    <div className="relative aspect-video w-full bg-muted">
      {item.thumbnail_url ? (
        <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-primary/10">
          {type === 'test' ? <BookOpen className="h-12 w-12 sm:h-16 sm:w-16" /> : <PlayCircle className="h-12 w-12 sm:h-16 sm:w-16" />}
        </div>
      )}
      <div className="absolute top-3 left-3">
        <span className="rounded-full bg-background/90 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest backdrop-blur">
          {item.tier}
        </span>
      </div>
    </div>
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        <span>{item.category || (type === 'test' ? 'Academic' : 'Professional')}</span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>{item.difficulty || 'All Levels'}</span>
      </div>
      <h3 className="font-display font-bold text-base sm:text-xl leading-tight group-hover:text-primary transition-colors line-clamp-1">{item.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
      <div className="mt-4 sm:mt-6 flex items-center justify-between border-t border-border pt-3 sm:pt-4">
        <span className="text-base font-black text-foreground">{item.tier === 'free' ? 'FREE' : `${item.price} Tokens`}</span>
        <Button size="sm" variant="ghost" className="rounded-xl font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all px-3 sm:px-4">
          View <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </div>
);

const ItemCard = ({ item, type, isLoggedIn }: { item: any, type: 'test' | 'course', isLoggedIn: boolean }) => {
  if (!isLoggedIn) {
    return (
      <Link to="/signup" className="block text-left">
        <CardContentInner item={item} type={type} />
      </Link>
    );
  }

  if (type === 'test') {
    return (
      <Link to="/tests/$testId" params={{ testId: item.id }} className="block text-left">
        <CardContentInner item={item} type={type} />
      </Link>
    );
  }

  return (
    <Link to="/courses/$courseId" params={{ courseId: item.id }} className="block text-left">
      <CardContentInner item={item} type={type} />
    </Link>
  );
};
