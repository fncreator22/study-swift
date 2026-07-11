import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Coins, Crown, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/subscriptions")({ component: AdminSubs });

type Plan = {
  id?: string;
  name: string;
  description: string;
  token_price: number;
  price_inr: number;
  duration_days: number;
  test_ids: string[];
  course_ids: string[];
  is_active: boolean;
};

const EMPTY: Plan = { name: "", description: "", token_price: 100, price_inr: 1000, duration_days: 30, test_ids: [], course_ids: [], is_active: true };

function AdminSubs() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tests, setTests] = useState<{ id: string; title: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenPrice, setTokenPrice] = useState<number>(10);
  const [savingPrice, setSavingPrice] = useState(false);
  const [autoConvert, setAutoConvert] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: ps }, { data: ts }, { data: cs }, { data: setting }] = await Promise.all([
      supabase.from("subscriptions" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("tests").select("id,title").order("title"),
      supabase.from("courses" as any).select("id,title").order("title"),
      supabase.from("settings" as any).select("value").eq("key", "token_price").maybeSingle(),
    ]);
    setPlans((ps as any) ?? []);
    setTests((ts as any) ?? []);
    setCourses((cs as any) ?? []);
    const v = (setting as any)?.value;
    if (v && typeof v.inr === "number") setTokenPrice(v.inr);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveTokenPrice() {
    setSavingPrice(true);
    const { error } = await supabase.from("settings" as any).upsert({ key: "token_price", value: { inr: tokenPrice } });
    setSavingPrice(false);
    if (error) return toast.error(error.message);
    toast.success("Token price updated");
  }

  function openNew() { 
    setEditing({ ...EMPTY }); 
    setOpen(true); 
  }
  
  function openEdit(p: Plan) { 
    setEditing({ ...p, price_inr: p.price_inr ?? p.token_price * 10, test_ids: p.test_ids ?? [], course_ids: p.course_ids ?? [] }); 
    setOpen(true); 
  }

  async function savePlan() {
    if (!editing) return;
    if (!editing.name.trim()) return toast.error("Name required");
    const payload = { ...editing };
    const { error } = editing.id
      ? await supabase.from("subscriptions" as any).update(payload).eq("id", editing.id)
      : await supabase.from("subscriptions" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Plan saved");
    setOpen(false);
    setEditing(null);
    load();
  }

  async function deletePlan(id: string) {
    if (!confirm("Delete this plan?")) return;
    const { error } = await supabase.from("subscriptions" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plan deleted");
    load();
  }

  function toggle(arr: string[], id: string): string[] {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  }

  if (loading) return <div className="grid h-64 place-items-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Configure token economy and subscription bundles.</p>
        </div>
        <Button onClick={openNew} className="rounded-xl"><Plus className="mr-2 h-4 w-4" /> New plan</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Coins className="h-4 w-4 text-primary" /> Token settings</CardTitle>
          <CardDescription>Configure the real-money value of one token (used in token request UI).</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="space-y-2 flex-1 max-w-xs">
            <Label>1 Token = ₹</Label>
            <Input type="number" min={1} value={tokenPrice} onChange={(e) => setTokenPrice(Number(e.target.value))} />
          </div>
          <Button onClick={saveTokenPrice} disabled={savingPrice} className="rounded-xl">Save</Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold flex items-center gap-2"><Crown className="h-4 w-4 text-primary" /> Plans</h2>
        {plans.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No plans yet. Create your first plan.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((p) => (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                  </div>
                  <Badge variant={p.is_active ? "success" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {p.description ? (
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      {p.description.split(/•|\n/).map(x => x.trim()).filter(Boolean).map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No description</p>
                  )}
                  <div className="text-sm text-muted-foreground space-y-1 pt-2">
                    <div>
                      <b className="text-foreground">₹{p.price_inr ?? p.token_price * tokenPrice}</b> ({p.token_price} tokens) · <b className="text-foreground">{p.duration_days}</b> days
                    </div>
                    <div>{p.test_ids?.length ?? 0} tests · {p.course_ids?.length ?? 0} courses</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => deletePlan(p.id!)} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit plan" : "New plan"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Description (separate lines or • for pointers)</Label><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Price (₹)</Label>
                  <Input 
                    type="number" 
                    min={0} 
                    value={editing.price_inr ?? 0} 
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (autoConvert && tokenPrice > 0) {
                        setEditing({ ...editing, price_inr: val, token_price: Math.round(val / tokenPrice) });
                      } else {
                        setEditing({ ...editing, price_inr: val });
                      }
                    }} 
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Tokens Cost</Label>
                    <button
                      type="button"
                      title={autoConvert ? "Auto-convert ON: tokens calculated from price" : "Auto-convert OFF: enter tokens manually"}
                      onClick={() => {
                        const next = !autoConvert;
                        setAutoConvert(next);
                        if (next && tokenPrice > 0) {
                          setEditing({ ...editing, token_price: Math.round((editing.price_inr ?? 0) / tokenPrice) });
                        }
                      }}
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-all ${
                        autoConvert 
                          ? 'bg-primary text-primary-foreground border-primary' 
                          : 'bg-muted text-muted-foreground border-border hover:border-primary'
                      }`}
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${autoConvert ? 'animate-spin' : ''}`} />
                      Auto
                    </button>
                  </div>
                  <Input 
                    type="number" 
                    min={0} 
                    value={editing.token_price}
                    readOnly={autoConvert}
                    className={autoConvert ? 'opacity-60 cursor-not-allowed' : ''}
                    onChange={(e) => {
                      if (!autoConvert) {
                        setEditing({ ...editing, token_price: Number(e.target.value) });
                      }
                    }} 
                  />
                  {autoConvert && tokenPrice > 0 && (
                    <p className="text-[10px] text-muted-foreground">= ₹{editing.price_inr ?? 0} ÷ ₹{tokenPrice}/token</p>
                  )}
                </div>
                <div className="space-y-2"><Label>Duration (days)</Label><Input type="number" min={1} value={editing.duration_days} onChange={(e) => setEditing({ ...editing, duration_days: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Active</Label></div>

              <div className="space-y-2">
                <Label>Included tests ({editing.test_ids.length})</Label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {tests.length === 0 && <p className="text-xs text-muted-foreground">No tests available</p>}
                  {tests.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-sm py-1">
                      <Checkbox checked={editing.test_ids.includes(t.id)} onCheckedChange={() => setEditing({ ...editing, test_ids: toggle(editing.test_ids, t.id) })} />
                      <span className="truncate">{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Included courses ({editing.course_ids.length})</Label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {courses.length === 0 && <p className="text-xs text-muted-foreground">No courses available</p>}
                  {courses.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm py-1">
                      <Checkbox checked={editing.course_ids.includes(c.id)} onCheckedChange={() => setEditing({ ...editing, course_ids: toggle(editing.course_ids, c.id) })} />
                      <span className="truncate">{c.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={savePlan}>Save plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
