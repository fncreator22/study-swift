import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Check, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_student/subscriptions")({ component: SubscriptionsPage });

type Plan = {
  id: string;
  name: string;
  description: string;
  token_price: number;
  duration_days: number;
  test_ids: string[];
  course_ids: string[];
  is_active: boolean;
};

type Membership = {
  id: string;
  subscription_id: string | null;
  status: string;
  valid_until: string | null;
  plan: string;
};

function SubscriptionsPage() {
  const { user, tokens, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [active, setActive] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: ps }, { data: ms }] = await Promise.all([
      supabase.from("subscriptions" as any).select("*").eq("is_active", true).order("token_price"),
      user
        ? supabase.from("memberships" as any).select("*").eq("user_id", user.id).eq("status", "active").order("valid_until", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setPlans((ps as any) ?? []);
    setActive((ms as any) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function buy(planId: string) {
    setBuying(planId);
    const { data, error } = await supabase.rpc("purchase_subscription" as any, { _subscription_id: planId });
    setBuying(null);
    if (error) return toast.error(error.message);
    toast.success("Subscription activated!");
    await refreshProfile();
    await load();
  }

  if (loading) return <div className="grid h-64 place-items-center text-sm text-muted-foreground">Loading plans…</div>;

  const activeUntil = active?.valid_until ? new Date(active.valid_until) : null;
  const isActive = activeUntil && activeUntil > new Date();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground mt-1">Unlock bundles of tests and courses by spending tokens.</p>
      </div>

      {isActive && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Active membership</CardTitle>
              <CardDescription>Valid until {activeUntil!.toLocaleDateString()}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No subscription plans available yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const canAfford = tokens >= p.token_price;
            return (
              <Card key={p.id} className="relative flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-xl">{p.name}</CardTitle>
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <CardDescription>{p.description || "Premium bundle"}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold">{p.token_price}</span>
                    <span className="text-xs text-muted-foreground">tokens</span>
                  </div>
                  <ul className="space-y-2 text-sm flex-1">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p.duration_days} days access</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p.test_ids?.length ?? 0} tests included</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-success" /> {p.course_ids?.length ?? 0} courses included</li>
                  </ul>
                  <Button
                    disabled={!canAfford || buying === p.id}
                    onClick={() => buy(p.id)}
                    className="w-full rounded-xl"
                  >
                    <Coins className="mr-2 h-4 w-4" />
                    {buying === p.id ? "Processing…" : canAfford ? "Subscribe" : "Insufficient tokens"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
