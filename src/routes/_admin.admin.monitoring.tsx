import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, Coins, Users, TrendingUp, Sparkles, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/monitoring")({ component: AdminMonitoring });

function AdminMonitoring() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    activeSubs: 0,
    newSubs30d: 0,
    repeatSubs: 0,
    avgTimeSpent: 0
  });

  const [activeSubscribers, setActiveSubscribers] = useState<any[]>([]);
  const [subRequests, setSubRequests] = useState<any[]>([]);
  const [tokenAdjustments, setTokenAdjustments] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    Promise.all([
      // Fetch memberships
      supabase.from("memberships" as any).select("*, subscriptions(*), profiles(full_name, email, total_time_spent)"),
      // Fetch manual token adjustments
      supabase.from("wallet_transactions").select("*, profiles(full_name, email)").eq("type", "admin_adj").order("created_at", { ascending: false }),
      // Fetch profiles
      supabase.from("profiles").select("id, total_time_spent"),
      // Fetch subscription upgrade requests
      supabase.from("subscription_requests").select("*, subscriptions(*), profiles(full_name, email)").order("created_at", { ascending: false })
    ]).then(([memsResult, txResult, profilesResult, reqsResult]) => {
      const mems = memsResult.data ?? [];
      const txs = txResult.data ?? [];
      const profiles = profilesResult.data ?? [];
      const reqs = reqsResult.data ?? [];

      // Calculate Metrics
      const active = mems.filter(m => m.status === 'active' && new Date(m.valid_until) > now);
      const newSubs = active.filter(m => new Date(m.created_at) >= thirtyDaysAgo);
      
      // Calculate repeat customers: users who have bought > 1 membership
      const userPurchasesCount: Record<string, number> = {};
      mems.forEach(m => {
        userPurchasesCount[m.user_id] = (userPurchasesCount[m.user_id] || 0) + 1;
      });
      const repeatCount = Object.values(userPurchasesCount).filter(count => count > 1).length;

      // Calculate average time spent
      const totalTime = profiles.reduce((acc, p) => acc + (p.total_time_spent ?? 0), 0);
      const avgTime = profiles.length ? Math.round(totalTime / profiles.length) : 0;

      setMetrics({
        activeSubs: active.length,
        newSubs30d: newSubs.length,
        repeatSubs: repeatCount,
        avgTimeSpent: avgTime
      });

      setActiveSubscribers(active);
      setTokenAdjustments(txs);
      setSubRequests(reqs);
      setLoading(false);
    }).catch(err => {
      toast.error(err.message || "Failed to load monitoring data");
      setLoading(false);
    });
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 25000);
    return () => clearInterval(interval);
  }, []);

  async function handleApproveRequest(req: any) {
    if (!req.subscriptions) return toast.error("Subscription details missing");
    if (confirm(`Approve upgrade to ${req.subscriptions.name} for ${req.profiles?.full_name}?`)) {
      try {
        const plan = req.subscriptions;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + (plan.duration_days || 30));

        // 1. Fetch user's current token balance
        const { data: prof } = await supabase.from("profiles").select("tokens").eq("id", req.user_id).maybeSingle();
        const currentTokens = prof?.tokens ?? 0;
        const finalTokens = currentTokens + (plan.token_price || 0);

        // 2. Deactivate any existing active memberships
        await supabase.from("memberships" as any).update({ status: 'cancelled' }).eq("user_id", req.user_id).eq("status", "active");

        // 3. Insert new premium membership
        await supabase.from("memberships" as any).insert({
          user_id: req.user_id,
          plan: 'premium',
          valid_until: validUntil.toISOString(),
          subscription_id: plan.id,
          status: 'active'
        });

        // 4. Update user's profile
        await supabase.from("profiles").update({
          membership_status: 'premium',
          subscription_expiry: validUntil.toISOString(),
          tokens: finalTokens
        }).eq("id", req.user_id);

        // 5. Insert wallet transaction for the token grant
        await supabase.from("wallet_transactions").insert({
          user_id: req.user_id,
          amount: plan.token_price || 0,
          type: 'admin_adj',
          description: `Subscription package grant: ${plan.name}`
        });

        // 6. Update request status to approved
        await supabase.from("subscription_requests").update({ status: 'approved' }).eq("id", req.id);

        toast.success("Subscription upgrade request approved!");
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to approve request");
      }
    }
  }

  async function handleRejectRequest(reqId: string) {
    if (confirm("Reject this upgrade request?")) {
      const { error } = await supabase.from("subscription_requests").update({ status: 'rejected' }).eq("id", reqId);
      if (error) return toast.error(error.message);
      toast.success("Request rejected");
      loadData();
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Monitoring & Analytics</h1>
        <p className="text-sm text-muted-foreground italic font-medium">Analyze subscription health, customer retention, and token adjustments ledger.</p>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Subscriptions", value: metrics.activeSubs, icon: Crown, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "New Subscribers (30d)", value: metrics.newSubs30d, icon: Sparkles, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "Repeat Customers", value: metrics.repeatSubs, icon: Users, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Avg study time", value: `${metrics.avgTimeSpent} mins`, icon: Clock, color: "text-emerald-500", bg: "bg-emerald-500/10" }
        ].map((item, idx) => (
          <div key={idx} className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-2xl shrink-0 ${item.bg} ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{item.label}</p>
                <p className="font-display text-2xl font-bold mt-0.5 truncate">{loading ? "..." : item.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="subscriptions" className="space-y-6">
        <TabsList className="grid max-w-xl grid-cols-3 rounded-2xl bg-muted p-1">
          <TabsTrigger value="subscriptions" className="rounded-xl py-2 font-semibold text-xs sm:text-sm">Subscription Insights</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl py-2 font-semibold text-xs sm:text-sm">Upgrade Requests ({subRequests.filter(r => r.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="tokens" className="rounded-xl py-2 font-semibold text-xs sm:text-sm">Token Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-display text-lg font-bold">Active Premium Subscribers</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-6">List of users currently holding active premium membership subscriptions.</p>

            <div className="responsive-table-container">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Plan Name</th>
                    <th className="px-6 py-4">Activated</th>
                    <th className="px-6 py-4">Expires</th>
                    <th className="px-6 py-4">Study time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Loading active subscriptions...</td></tr>
                  ) : activeSubscribers.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No active subscribers found</td></tr>
                  ) : activeSubscribers.map((item, index) => (
                    <tr key={index} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium">
                        <div>{item.profiles?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.profiles?.email || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600">
                          {item.subscriptions?.name || item.plan || "Premium Plan"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-muted-foreground">{new Date(item.valid_until).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono font-bold text-primary">{item.profiles?.total_time_spent ?? 0} mins</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-display text-lg font-bold">Subscription Upgrade Requests</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-6">Review payment receipts and manually approve or reject student premium membership upgrade requests.</p>

            <div className="responsive-table-container">
              <table className="w-full text-sm min-w-[650px]">
                <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Requested Plan</th>
                    <th className="px-6 py-4">Date Submitted</th>
                    <th className="px-6 py-4">Receipt Screenshot</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading upgrade requests...</td></tr>
                  ) : subRequests.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No upgrade requests found</td></tr>
                  ) : subRequests.map((item, index) => (
                    <tr key={index} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium">
                        <div>{item.profiles?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.profiles?.email || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-primary">{item.subscriptions?.name || "Premium Plan"}</span>
                          <span className="text-xs text-muted-foreground">₹{item.subscriptions?.price_inr}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {item.receipt_url ? (
                          <a href={item.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-bold">
                            View Receipt <ArrowUpRight className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">No receipt</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          item.status === 'approved' ? 'bg-success/10 text-success' :
                          item.status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                          'bg-amber-500/10 text-amber-600 animate-pulse'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {item.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleApproveRequest(item)}
                              className="rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs px-2.5 py-1.5 shadow-sm"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleRejectRequest(item.id)}
                              className="rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold text-xs px-2.5 py-1.5"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h3 className="font-display text-lg font-bold">Admin Token Adjustments Ledger</h3>
            <p className="text-xs text-muted-foreground mt-0.5 mb-6">Historical record of all manual token additions and removals done by system administrators.</p>

            <div className="responsive-table-container">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Adjustment Action</th>
                    <th className="px-6 py-4">Reason / message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Loading adjustments...</td></tr>
                  ) : tokenAdjustments.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No token adjustments found</td></tr>
                  ) : tokenAdjustments.map((item, index) => {
                    const isAdd = item.amount > 0;
                    return (
                      <tr key={index} className="transition-colors hover:bg-muted/30">
                        <td className="px-6 py-4 font-medium">
                          <div>{item.profiles?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{item.profiles?.email || "—"}</div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{new Date(item.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isAdd ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                          }`}>
                            {isAdd ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {isAdd ? `+${item.amount}` : item.amount} Tokens
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground max-w-[250px] truncate" title={item.description}>
                          {item.description || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
