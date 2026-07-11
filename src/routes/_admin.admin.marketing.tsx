import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Eye, MousePointerClick, TrendingUp, BarChart3, Plus, Play, ToggleLeft, ToggleRight, Check, Pencil, Trash2, X } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_admin/admin/marketing")({ component: AdminMarketing });

type Campaign = {
  id: string;
  title: string;
  description: string;
  subscription_id: string | null;
  plan_mode: string; // 'specific' | 'all' | 'custom'
  custom_description?: string;
  is_active: boolean;
  views_count: number;
  clicks_count: number;
  conversions_count: number;
  created_at: string;
  subscriptions?: { name: string; price_inr: number; token_price: number; duration_days: number };
};

function AdminMarketing() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  // Create/Edit Form State
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedSubId, setSelectedSubId] = useState("");
  const [planMode, setPlanMode] = useState<"specific" | "all" | "custom">("specific");
  const [customDesc, setCustomDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: camps }, { data: subs }, { data: attempts }] = await Promise.all([
        supabase.from("marketing_campaigns").select("*, subscriptions(name, price_inr, token_price, duration_days)").order("created_at", { ascending: false }),
        supabase.from("subscriptions" as any).select("id, name, price_inr").eq("is_active", true),
        supabase.from("test_attempts").select("*, tests(category)")
      ]);

      setCampaigns((camps as any) ?? []);
      setSubscriptions(subs ?? []);
      if (subs && subs.length > 0 && !selectedSubId) {
        setSelectedSubId(subs[0].id);
      }

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

  useEffect(() => { loadData(); }, []);

  function openNewForm() {
    setEditingCampaign(null);
    setNewTitle("");
    setNewDesc("");
    setPlanMode("specific");
    setCustomDesc("");
    setSelectedSubId(subscriptions[0]?.id || "");
    setFormOpen(true);
  }

  function openEditForm(camp: Campaign) {
    setEditingCampaign(camp);
    setNewTitle(camp.title);
    setNewDesc(camp.description || "");
    setPlanMode((camp.plan_mode as any) || "specific");
    setCustomDesc(camp.custom_description || "");
    setSelectedSubId(camp.subscription_id || subscriptions[0]?.id || "");
    setFormOpen(true);
  }

  async function handleToggleActive(campId: string, currentlyActive: boolean) {
    try {
      if (!currentlyActive) {
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

  async function handleDeleteCampaign(campId: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    const { error } = await supabase.from("marketing_campaigns").delete().eq("id", campId);
    if (error) return toast.error(error.message);
    toast.success("Campaign deleted");
    loadData();
  }

  async function handleSaveCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return toast.error("Campaign title is required");
    if (planMode === "specific" && !selectedSubId) return toast.error("Select a subscription plan");

    setSubmitting(true);
    try {
      const payload: any = {
        title: newTitle,
        description: newDesc,
        plan_mode: planMode,
        subscription_id: planMode === "specific" ? selectedSubId : null,
        custom_description: planMode === "custom" ? customDesc : null,
        is_active: false
      };

      const { error } = editingCampaign
        ? await supabase.from("marketing_campaigns").update(payload).eq("id", editingCampaign.id)
        : await supabase.from("marketing_campaigns").insert(payload);

      if (error) throw error;
      toast.success(editingCampaign ? "Campaign updated!" : "Campaign created!");
      setFormOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save campaign");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Marketing & Growth Campaigns</h1>
          <p className="text-sm text-muted-foreground italic font-medium">Create interstitial subscription pop-ups and analyze conversion funnels.</p>
        </div>
        <Button onClick={openNewForm} className="rounded-xl gap-2">
          <Plus className="h-4 w-4" /> New Campaign
        </Button>
      </div>

      {/* Active Campaign Performance Funnel */}
      <Card className="rounded-3xl border border-border shadow-soft">
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
                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Pop-up Views (25s+)</p>
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

      {/* Test Participation by Category + Campaigns Ledger */}
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

        {/* Campaigns Ledger */}
        <Card className="rounded-3xl border border-border bg-card shadow-soft h-fit">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span>Promotional Campaigns Ledger</span>
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Funnel</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Loading campaigns...</td></tr>
                ) : campaigns.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">No campaigns created yet</td></tr>
                ) : campaigns.map((camp) => {
                  const campCtr = camp.views_count > 0 ? ((camp.clicks_count / camp.views_count) * 100).toFixed(0) : "0";
                  const campConv = camp.clicks_count > 0 ? ((camp.conversions_count / camp.clicks_count) * 100).toFixed(0) : "0";
                  return (
                    <tr key={camp.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{camp.title}</div>
                        <div className="text-[10px] text-muted-foreground font-normal max-w-[150px] truncate">{camp.description}</div>
                        <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${camp.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                          {camp.is_active ? "● Active" : "○ Inactive"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="text-[10px] space-y-0.5">
                          <div>{camp.views_count} views</div>
                          <div>{campCtr}% CTR · {campConv}% conv.</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="xs"
                            variant={camp.is_active ? "default" : "outline"}
                            onClick={() => handleToggleActive(camp.id, camp.is_active)}
                            className={`rounded-lg h-7 font-bold text-[10px] ${camp.is_active ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "border-border text-muted-foreground hover:bg-muted"}`}
                          >
                            {camp.is_active ? "Active" : "Activate"}
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => openEditForm(camp)} className="rounded-lg h-7 w-7 p-0">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => handleDeleteCampaign(camp.id)} className="rounded-lg h-7 w-7 p-0 text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Create / Edit Campaign Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="font-bold text-lg">{editingCampaign ? "Edit Campaign" : "New Pop-up Campaign"}</DialogTitle>
              <button onClick={() => setFormOpen(false)} className="rounded-full p-1 hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </DialogHeader>
          <form onSubmit={handleSaveCampaign} className="space-y-4 text-sm">
            <div className="space-y-1">
              <Label>Campaign Title</Label>
              <Input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Summer Sale" />
            </div>
            <div className="space-y-1">
              <Label>Description / Call-to-action</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Upgrade to premium package now..." className="h-16 resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Featured Plan</Label>
              <div className="flex gap-2">
                {(["specific", "all", "custom"] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPlanMode(mode)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold capitalize transition-all ${planMode === mode ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:border-primary"}`}
                  >
                    {mode === "specific" ? "Specific Plan" : mode === "all" ? "All Plans" : "Custom"}
                  </button>
                ))}
              </div>
              {planMode === "specific" && (
                <select
                  value={selectedSubId}
                  onChange={(e) => setSelectedSubId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none mt-2"
                >
                  {subscriptions.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (₹{s.price_inr})</option>
                  ))}
                </select>
              )}
              {planMode === "all" && (
                <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-xl p-3">All available subscription plans will be shown in the popup for users to choose from.</p>
              )}
              {planMode === "custom" && (
                <div className="space-y-1 mt-2">
                  <Label className="text-xs text-muted-foreground">Custom bullet points (one per line or use • )</Label>
                  <Textarea
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder={"• Exclusive discount this month\n• Access to all premium tests\n• Priority support"}
                    className="h-24 resize-none font-mono text-xs"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="font-bold">
                {submitting ? "Saving..." : editingCampaign ? "Update Campaign" : "Create Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
