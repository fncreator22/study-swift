import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_student/profile")({ component: Profile });

function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [college, setCollege] = useState("");
  const [stats, setStats] = useState({ attempts: 0, purchases: 0, score: 0, avg: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setName(p?.full_name ?? ""); setCollege(p?.college ?? "");
      const { data: r } = await supabase.from("rankings_view").select("*").eq("user_id", user.id).maybeSingle();
      const { count: pc } = await supabase.from("purchases").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      setStats({
        attempts: r?.attempts_count ?? 0,
        purchases: pc ?? 0,
        score: r?.total_score ?? 0,
        avg: r?.avg_percentage ?? 0,
      });
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name, college }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">Profile</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {[
          { l: "Attempts", v: stats.attempts }, { l: "Purchases", v: stats.purchases },
          { l: "Total score", v: stats.score }, { l: "Avg %", v: `${stats.avg}%` },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="text-xs text-muted-foreground">{s.l}</p>
            <p className="mt-1 font-display text-2xl font-bold">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Personal info</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>College / University</Label><Input value={college} onChange={(e) => setCollege(e.target.value)} /></div>
        </div>
        <div className="mt-5"><Button onClick={save}>Save changes</Button></div>
      </div>
    </div>
  );
}
