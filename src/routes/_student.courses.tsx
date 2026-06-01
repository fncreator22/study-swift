import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PlayCircle, Star, BookOpen, GraduationCap, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_student/courses")({ component: Courses });

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
};

function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("courses").select("*").order("created_at", { ascending: false })
      .then(({ data }) => {
        setCourses((data as unknown as Course[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse">Scanning catalog...</div>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Learning modules</h1>
          <p className="mt-1 text-muted-foreground">Expert-led video courses to master your preparation.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-20 text-center">
            <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground font-medium italic">New courses are coming soon. Check back shortly!</p>
          </div>
        )}
        {courses.map((c) => (
          <Link 
            key={c.id} 
            to="/courses/$courseId" 
            params={{ courseId: c.id }}
            className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-card"
          >
            <div className="relative aspect-video w-full bg-muted">
              {c.thumbnail_url ? (
                <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                  <PlayCircle className="h-12 w-12 text-primary/40" />
                </div>
              )}
              <div className="absolute top-3 left-3">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${c.tier === 'free' ? 'bg-success text-success-foreground' : 'bg-primary text-primary-foreground'}`}>
                  {c.tier === 'free' ? 'Free' : `₹${c.price}`}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <span>{c.category || 'Professional'}</span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>{c.difficulty}</span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold leading-tight group-hover:text-primary transition-colors">{c.title}</h3>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground/80">{c.description}</p>
              
              <div className="mt-auto pt-6 flex items-center justify-between border-t border-border/50">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                      {c.instructor_name?.charAt(0) || 'E'}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground">{c.instructor_name || 'Expert'}</span>
                </div>
                <div className="flex items-center gap-0.5 text-accent-foreground font-bold">
                  <Star className="h-3 w-3 fill-accent" /> <span className="text-xs">4.9</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

