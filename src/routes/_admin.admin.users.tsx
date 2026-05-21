import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_admin/admin/users")({ component: UsersAdmin });

function UsersAdmin() {
  const [users, setUsers] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data ?? []);
  }
  const [tokenUser, setTokenUser] = useState<any>(null);
  const [tokenAmt, setTokenAmt] = useState("0");
  const [tokenMsg, setTokenMsg] = useState("Admin adjustment");
  const [tokenSubmitting, setTokenSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function toggleBlock(id: string, blocked: boolean) {
    const { error } = await supabase.from("profiles").update({ blocked: !blocked }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(blocked ? "Unblocked" : "Blocked");
    load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-3xl font-bold">Users</h1>
      <div className="mt-8 responsive-table-container rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">College</th>
              <th className="px-6 py-4">Tokens</th>
              <th className="px-6 py-4">Joined</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="transition-colors hover:bg-muted/30">
                <td className="px-6 py-4 font-medium whitespace-nowrap">{u.full_name || "—"}</td>
                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{u.college || "—"}</td>
                <td className="px-6 py-4 font-mono text-primary whitespace-nowrap">{u.tokens ?? 0}</td>
                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {u.blocked ? (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive">Blocked</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">Active</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" disabled={u.blocked} className="h-8 rounded-lg border border-border/50 bg-background hover:bg-muted" onClick={() => { setTokenUser(u); setTokenAmt("0"); setTokenMsg("Admin adjustment"); }}>± Tokens</Button>
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg border border-border/50 bg-background hover:bg-muted" onClick={() => toggleBlock(u.id, u.blocked)}>
                      {u.blocked ? "Unblock" : "Block"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!tokenUser} onOpenChange={(o) => !o && setTokenUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Tokens for {tokenUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tokens">Token Amount (e.g. 100 or -100)</Label>
              <Input id="tokens" type="number" value={tokenAmt} onChange={(e) => setTokenAmt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message / Reason</Label>
              <Input id="message" value={tokenMsg} onChange={(e) => setTokenMsg(e.target.value)} />
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
            }}>Update Tokens</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
