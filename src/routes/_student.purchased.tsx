import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_student/purchased")({ component: Purchased });

function Purchased() {
  const { user } = useAuth();
  const [tests, setTests] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("purchases").select("test_id, tests(*)").eq("user_id", user.id);
      setTests((data ?? []).map((r: any) => r.tests));
    })();
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-bold">Purchased tests</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tests.length === 0 && <p className="text-sm text-muted-foreground">You haven't purchased any tests yet.</p>}
        {tests.map((t) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-display text-lg font-semibold">{t.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
            <Link to="/tests/$testId" params={{ testId: t.id }} className="mt-4 block">
              <Button className="w-full" variant="outline">Open</Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
