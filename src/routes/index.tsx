import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Trophy, ArrowRight, PlayCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Examly — Practice MCQ tests, level up your prep" },
      { name: "description", content: "A clean modern platform for MCQ tests, courses, and rankings." },
    ],
  }),
  component: Landing,
});

type Test = { id: string; title: string; description: string; tier: string; price: number; duration_min: number };
type Video = { id: string; title: string; description: string; thumbnail_url: string; video_url: string };

function Landing() {
  const [tests, setTests] = useState<Test[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);

  useEffect(() => {
    supabase.from("tests").select("id,title,description,tier,price,duration_min").order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => setTests(data ?? []));
    supabase.from("videos").select("id,title,description,thumbnail_url,video_url").order("created_at", { ascending: false }).limit(3)
      .then(({ data }) => setVideos(data ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="h-4 w-4" /></span>
            Examly
          </Link>
          <nav className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/signup"><Button size="sm">Sign up</Button></Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Built for students
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            Practice smarter. <br />
            <span className="text-primary">Score higher.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Curated MCQ tests, instant scoring, transparent rankings, and focused video courses — all in one minimal workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup"><Button size="lg" className="gap-2">Get started <ArrowRight className="h-4 w-4" /></Button></Link>
            <Link to="/login"><Button size="lg" variant="outline">I have an account</Button></Link>
          </div>
        </div>
      </section>

      {/* Featured tests */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Featured tests</h2>
            <p className="mt-1 text-sm text-muted-foreground">Free and premium MCQ exams across topics.</p>
          </div>
          <BookOpen className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {tests.length === 0 && <p className="text-sm text-muted-foreground">No tests yet — your admin will add some soon.</p>}
          {tests.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t.tier === 'free' ? 'bg-success/10 text-success' : 'bg-accent text-accent-foreground'}`}>{t.tier}</span>
                <span className="text-sm font-semibold">{t.tier === 'free' ? 'Free' : `₹${t.price}`}</span>
              </div>
              <h3 className="font-display text-lg font-semibold">{t.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
              <p className="mt-4 text-xs text-muted-foreground">{t.duration_min} min</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured videos */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Featured courses</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hand-picked videos for focused learning.</p>
          </div>
          <PlayCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {videos.length === 0 && <p className="text-sm text-muted-foreground">No videos yet.</p>}
          {videos.map((v) => (
            <div key={v.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              {v.thumbnail_url ? <img src={v.thumbnail_url} alt={v.title} className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-muted" />}
              <div className="p-5">
                <h3 className="font-display font-semibold">{v.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: BookOpen, t: "Curated tests", d: "Quality MCQs designed by educators." },
            { icon: Trophy, t: "Live rankings", d: "Compete on a transparent leaderboard." },
            { icon: PlayCircle, t: "Video courses", d: "Learn at your pace with focused videos." },
          ].map((c, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <c.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">{c.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-border/60 bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-3xl font-bold">Get in touch</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">Have a question, feedback, or partnership idea? We'd love to hear from you.</p>
          <a href="mailto:hello@examly.app" className="mt-6 inline-flex"><Button variant="outline">hello@examly.app</Button></a>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} Examly</span>
          <Link to="/admin/login" className="hover:text-foreground">Admin</Link>
        </div>
      </footer>
    </div>
  );
}
