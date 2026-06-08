import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Crown } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/users")({ component: UsersAdmin });

function UsersAdmin() {
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  async function load() {
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions" as any).select("id,name,duration_days").eq("is_active", true),
    ]);
    setUsers(u ?? []);
    setPlans((p as any[]) ?? []);
  }
  const [tokenUser, setTokenUser] = useState<any>(null);
  const [tokenAmt, setTokenAmt] = useState("0");
  const [tokenMsg, setTokenMsg] = useState("Admin adjustment");
  const [tokenSubmitting, setTokenSubmitting] = useState(false);

  const [grantUser, setGrantUser] = useState<any>(null);
  const [grantPlan, setGrantPlan] = useState("");
  const [grantDays, setGrantDays] = useState("30");

  useEffect(() => { load(); }, []);

  async function toggleBlock(id: string, blocked: boolean) {
    const { error } = await supabase.from("profiles").update({ blocked: !blocked }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(blocked ? "Unblocked" : "Blocked");
    load();
  }

  async function grantMembership() {
    if (!grantUser) return;
    const days = parseInt(grantDays) || 30;
    const expiry = new Date(Date.now() + days * 86400000).toISOString();
    const plan = plans.find((p) => p.id === grantPlan);
    const { error: e1 } = await supabase.from("memberships").insert({
      user_id: grantUser.id, plan: "premium", subscription_id: plan?.id ?? null, status: "active", valid_until: expiry,
    } as any);
    if (e1) return toast.error(e1.message);
    await supabase.from("profiles").update({ membership_status: "premium", subscription_expiry: expiry }).eq("id", grantUser.id);
    toast.success("Membership granted");
    setGrantUser(null);
    setGrantPlan("");
    load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-bold">Users</h1>
      <div className="mt-8 responsive-table-container rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">College</th>
              <th className="px-4 py-3">Tokens</th>
              <th className="px-4 py-3">Membership</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const premium = u.membership_status === "premium" && u.subscription_expiry && new Date(u.subscription_expiry) > new Date();
              return (
                <tr key={u.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{u.full_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.college || "—"}</td>
                  <td className="px-4 py-3 font-mono text-primary whitespace-nowrap">{u.tokens ?? 0}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {premium
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"><Crown className="h-3 w-3" />Premium</span>
                      : <span className="text-[10px] text-muted-foreground">Free</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.blocked
                      ? <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">Blocked</span>
                      : <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">Active</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="ghost" className="h-8 rounded-lg border border-border/50">
                        <Link to="/admin/users/$userId" params={{ userId: u.id }}><Eye className="h-3 w-3" /></Link>
                      </Button>
                      <Button size="sm" variant="ghost" disabled={u.blocked} className="h-8 rounded-lg border border-border/50" onClick={() => { setTokenUser(u); setTokenAmt("0"); setTokenMsg("Admin adjustment"); }}>± Tokens</Button>
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg border border-border/50" onClick={() => { setGrantUser(u); setGrantPlan(""); setGrantDays("30"); }}><Crown className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg border border-border/50" onClick={() => toggleBlock(u.id, u.blocked)}>
                        {u.blocked ? "Unblock" : "Block"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!tokenUser} onOpenChange={(o) => !o && setTokenUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Update tokens · {tokenUser?.full_name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Amount (positive or negative)</Label>
              <Input type="number" value={tokenAmt} onChange={(e) => setTokenAmt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Input value={tokenMsg} onChange={(e) => setTokenMsg(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenUser(null)}>Cancel</Button>
            <Button disabled={tokenSubmitting} onClick={async () => {
              const val = parseInt(tokenAmt);
              if (isNaN(val)) return toast.error("Invalid amount");
              if (tokenUser.blocked) return toast.error("User is blocked");
              setTokenSubmitting(true);
              const { error } = await supabase.from("profiles").update({ tokens: (tokenUser.tokens || 0) + val }).eq("id", tokenUser.id);
              if (error) toast.error(error.message);
              else {
                await supabase.from("wallet_transactions").insert({ user_id: tokenUser.id, amount: val, type: 'admin_adj', description: tokenMsg });
                toast.success("Tokens updated");
                setTokenUser(null);
                load();
              }
              setTokenSubmitting(false);
            }}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!grantUser} onOpenChange={(o) => !o && setGrantUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Grant membership · {grantUser?.full_name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Plan (optional — links benefits)</Label>
              <Select value={grantPlan} onValueChange={setGrantPlan}>
                <SelectTrigger><SelectValue placeholder="Generic premium" /></SelectTrigger>
                <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Days</Label>
              <Input type="number" value={grantDays} onChange={(e) => setGrantDays(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantUser(null)}>Cancel</Button>
            <Button onClick={grantMembership}>Grant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
