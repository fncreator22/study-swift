import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Eye, MousePointerClick, TrendingUp, BarChart3, Plus, Play, ToggleLeft, ToggleRight, Check } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_admin/admin/marketing")({ component: AdminMarketing });

type Campaign = {
  id: string;
  title: string;
  description: string;
  subscription_id: string;
  is_active: boolean;
  views_count: number;
  clicks_count: number;
  conversions_count: number;
  created_at: string;
  subscriptions?: { name: string; price_inr: number };
};

function AdminMarketing() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  // Create Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: camps }, { data: subs }, { data: attempts }] = await Promise.all([
        supabase.from("marketing_campaigns").select("*, subscriptions(name, price_inr)").order("created_at", { ascending: false }),
        supabase.from("subscriptions" as any).select("id, name, price_inr").eq("is_active", true),
        supabase.from("test_attempts").select("*, tests(category)")
      ]);

      setCampaigns((camps as any) ?? []);
      setSubscriptions(subs ?? []);
      if (subs && subs.length > 0 && !selectedSubId) {
        setSelectedSubId(subs[0].id);
      }

      // Group test attempts by category
      const counts: Record<string, number> = { "MCQ": 0, "Written": 0, "Hybrid": 0 };
      attempts?.forEach((att: any) => {
        const cat = att.tests?.category || "MCQ";
        counts[cat] = (counts[cat] || 0) + 1;
      });

      const catChart = Object.entries(counts).map(([name, value]) => ({
        name,
        attempts: value,
        fill: name === "MCQ" ? "#3b82f6" : name === "Written" ? "#a855f7" : "#f97316"
      }));
      setCategoryData(catChart);

    } catch (err: any) {
      toast.error(err.message || "Failed to load marketing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleToggleActive(campId: string, currentlyActive: boolean) {
    try {
      if (!currentlyActive) {
        // Deactivate all first
        await supabase.from("marketing_campaigns").update({ is_active: false }).neq("id", campId);
      }
      const { error } = await supabase.from("marketing_campaigns").update({ is_active: !currentlyActive }).eq("id", campId);
      if (error) throw error;

      toast.success(currentlyActive ? "Campaign deactivated" : "Campaign activated!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status");
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !selectedSubId) return toast.error("Title and featured subscription are required");
    
    setSubmitting(true);
    try {
      const { error } = await supabase.from("marketing_campaigns").insert({
        title: newTitle,
        description: newDesc,
        subscription_id: selectedSubId,
        is_active: false
      });
      if (error) throw error;

      toast.success("Marketing campaign created successfully!");
      setNewTitle("");
      setNewDesc("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  const activeCampaign = campaigns.find(c => c.is_active);
  const ctr = activeCampaign && activeCampaign.views_count > 0 
    ? ((activeCampaign.clicks_count / activeCampaign.views_count) * 100).toFixed(1) 
    : "0.0";
  const convRate = activeCampaign && activeCampaign.clicks_count > 0 
    ? ((activeCampaign.conversions_count / activeCampaign.clicks_count) * 100).toFixed(1) 
    : "0.0";

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Marketing & Growth Campaigns</h1>
        <p className="text-sm text-muted-foreground italic font-medium">Create interstitial subscription pop-ups and analyze conversion funnels.</p>
      </div>

      {/* Active Campaign Performance funnel */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 rounded-3xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Active Campaign Performance Funnel</span>
            </CardTitle>
            <CardDescription>
              {activeCampaign ? `Live analytics for campaign: "${activeCampaign.title}"` : "No campaign currently active"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {activeCampaign ? (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-muted/40 p-4 rounded-2xl border">
                  <div className="flex justify-center mb-1 text-muted-foreground"><Eye className="h-4 w-4" /></div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pop-up Views (15s+)</p>
                  <p className="font-display text-2xl font-extrabold mt-1">{activeCampaign.views_count}</p>
                </div>
                <div className="bg-muted/40 p-4 rounded-2xl border">
                  <div className="flex justify-center mb-1 text-muted-foreground"><MousePointerClick className="h-4 w-4" /></div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">CTR ({ctr}%)</p>
                  <p className="font-display text-2xl font-extrabold mt-1">{activeCampaign.clicks_count}</p>
                </div>
                <div className="bg-muted/40 p-4 rounded-2xl border text-emerald-600 bg-emerald-500/5 border-emerald-500/10">
                  <div className="flex justify-center mb-1 text-emerald-600"><Check className="h-4 w-4" /></div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600/80">Conversions ({convRate}%)</p>
                  <p className="font-display text-2xl font-extrabold mt-1">{activeCampaign.conversions_count}</p>
                </div>
              </div>
            ) : (
              <div className="h-28 grid place-items-center text-sm text-muted-foreground border border-dashed rounded-2xl">
                Activate a promotion pop-up below to collect engagement telemetry.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Campaign Form */}
        <Card className="rounded-3xl border border-border shadow-soft h-fit">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>New Pop-up Promo</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label>Campaign Title</Label>
                <Input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Summer Sale" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label>Description / Call-to-action</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Upgrade to premium package now..." className="h-16 resize-none" />
              </div>
              <div className="space-y-1">
                <Label>Featured subscription package</Label>
                <select 
                  value={selectedSubId}
                  onChange={(e) => setSelectedSubId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none"
                >
                  {subscriptions.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (₹{s.price_inr})</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={submitting} className="w-full rounded-xl h-9 text-xs font-bold">
                {submitting ? "Creating..." : "Create Campaign"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Test Participation by Category */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-3xl border border-border shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span>Test Participation by Category</span>
            </CardTitle>
            <CardDescription>Analyze which test patterns students launch most frequently.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Bar dataKey="attempts" radius={[6, 6, 0, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Existing Campaigns List */}
        <Card className="rounded-3xl border border-border bg-card p-6 shadow-soft h-fit">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>Promotional Campaigns Ledger</span>
            </CardTitle>
          </CardHeader>
          <div className="responsive-table-container">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Featured Plan</th>
                  <th className="px-4 py-3">Conversions</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Loading campaigns...</td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">No campaigns created yet</td></tr>
                ) : campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">
                      <div>{camp.title}</div>
                      <div className="text-[10px] text-muted-foreground font-normal max-w-[150px] truncate">{camp.description}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{camp.subscriptions?.name || "—"}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{camp.conversions_count}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="xs"
                        variant={camp.is_active ? "default" : "outline"}
                        onClick={() => handleToggleActive(camp.id, camp.is_active)}
                        className={`rounded-lg h-7 font-bold text-[10px] ${
                          camp.is_active 
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {camp.is_active ? "Active" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
