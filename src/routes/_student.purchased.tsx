import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BookOpen, PlayCircle, GraduationCap, ChevronRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_student/purchased")({ component: Purchased });

function Purchased() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1. Fetch purchased tests and courses
      const { data: purchases } = await supabase
        .from("purchases")
        .select("test_id, course_id, tests(*), courses:courses_v2(*)")
        .eq("user_id", user.id);
      
      // 2. Fetch active membership subscription courses
      const { data: membership } = await supabase
        .from("memberships")
        .select("subscription_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("valid_until", new Date().toISOString())
        .maybeSingle();

      let subCourses: any[] = [];
      if (membership?.subscription_id) {
        const { data: mappings } = await supabase
          .from("subscription_courses_v2" as any)
          .select("course_id, courses:courses_v2(*)")
          .eq("subscription_id", membership.subscription_id);
        
        if (mappings) {
          subCourses = mappings
            .map((m: any) => m.courses)
            .filter(Boolean)
            .map((c: any) => ({ ...c, type: 'course', unlocked_via: 'subscription' }));
        }
      }

      // 3. Map and merge everything
      const purchaseItems = (purchases ?? [])
        .map((r: any) => {
          const item = r.tests || r.courses;
          if (!item) return null;
          return {
            ...item,
            type: r.test_id ? 'test' : 'course',
            unlocked_via: 'purchase'
          };
        })
        .filter(Boolean);

      const seenIds = new Set(purchaseItems.map(item => item.id));
      const filteredSubs = subCourses.filter(c => !seenIds.has(c.id));

      setItems([...purchaseItems, ...filteredSubs]);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse">Loading your library...</div>;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold italic">Your library</h1>
          <p className="mt-1 text-muted-foreground font-medium italic">All your premium unlocked content in one place.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 && (
          <div className="col-span-full rounded-3xl border border-dashed border-border p-20 text-center bg-muted/20">
            <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground font-medium italic">You haven't unlocked any premium content yet.</p>
            <Link to="/tests" className="mt-6 inline-block"><Button variant="outline" className="rounded-xl italic">Browse Assessments</Button></Link>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:shadow-card">
            <div className="relative aspect-video w-full bg-muted">
              {item.type === 'course' && item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5">
                  {item.type === 'test' ? <BookOpen className="h-10 w-10 text-primary/30" /> : <PlayCircle className="h-10 w-10 text-primary/30" />}
                </div>
              )}
              <div className="absolute top-3 right-3 flex gap-2">
                <span className="rounded-full bg-background/90 px-2 py-1 text-[10px] font-bold text-success backdrop-blur shadow-sm">
                  <CheckCircle2 className="mr-1 inline h-3 w-3" /> {item.unlocked_via === 'subscription' ? 'Subscription' : 'Purchased'}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.type === 'test' ? 'Assessment' : 'Course Module'}</span>
              <h3 className="mt-2 font-display text-lg font-bold leading-tight">{item.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground/80">{item.description}</p>
              
              <Link 
                to={item.type === 'test' ? "/tests/$testId" : "/courses/$courseId"} 
                params={item.type === 'test' ? { testId: item.id } : { courseId: item.id }} 
                className="mt-6 block"
              >
                <Button className="w-full rounded-xl font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-all" variant="outline">
                  Continue {item.type === 'test' ? 'Testing' : 'Learning'} <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

