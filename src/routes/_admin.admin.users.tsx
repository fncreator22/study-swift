import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminResetUserPassword } from "@/lib/admin.functions";

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
  const [tokenAction, setTokenAction] = useState<"add" | "remove">("add");

  // States for user details view
  const [viewUser, setViewUser] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!viewUser) return;
    setLoadingDetails(true);
    setNewPassword("");
    Promise.all([
      supabase.from("purchases").select("id, created_at, tests(title), courses(title)").eq("user_id", viewUser.id),
      supabase.from("test_attempts").select("id, started_at, submitted_at, score, total, is_reviewed, tests(title)").eq("user_id", viewUser.id).order("started_at", { ascending: false }),
      supabase.from("wallet_transactions").select("id, amount, type, description, created_at").eq("user_id", viewUser.id).order("created_at", { ascending: false }),
    ]).then(([p, a, w]) => {
      setPurchases(p.data ?? []);
      setAttempts(a.data ?? []);
      setTransactions(w.data ?? []);
      setLoadingDetails(false);
    });
  }, [viewUser]);

  async function toggleBlock(id: string, blocked: boolean) {
    const { error } = await supabase.from("profiles").update({ blocked: !blocked }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(blocked ? "Unblocked" : "Blocked");
    load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold">Users</h1>
      <div className="mt-8 responsive-table-container rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[600px] text-sm">
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
                <td className="px-6 py-4 font-medium whitespace-nowrap">
                  <div>{u.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{u.email || "—"}</div>
                </td>
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
                    <Button size="sm" variant="ghost" className="h-8 rounded-lg border border-border/50 bg-background hover:bg-muted text-primary hover:text-primary" onClick={() => setViewUser(u)}>View Profile</Button>
                    <Button size="sm" variant="ghost" disabled={u.blocked} className="h-8 rounded-lg border border-border/50 bg-background hover:bg-muted" onClick={() => { setTokenUser(u); setTokenAmt("0"); setTokenMsg("Admin adjustment"); setTokenAction("add"); }}>± Tokens</Button>
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
              <Label>Action Type</Label>
              <Select value={tokenAction} onValueChange={(val: "add" | "remove") => setTokenAction(val)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add (Grant) Tokens</SelectItem>
                  <SelectItem value="remove">Remove (Deduct) Tokens</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tokens">Token Amount</Label>
              <Input id="tokens" type="number" min="1" value={tokenAmt} onChange={(e) => setTokenAmt(e.target.value)} placeholder="Enter positive number" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message / Reason</Label>
              <Input id="message" value={tokenMsg} onChange={(e) => setTokenMsg(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenUser(null)}>Cancel</Button>
            <Button disabled={tokenSubmitting} onClick={async () => {
              const amtInput = parseInt(tokenAmt);
              if (isNaN(amtInput) || amtInput <= 0) return toast.error("Please enter a valid positive token amount");
              if (tokenUser.blocked) return toast.error("User is blocked");
              
              const val = tokenAction === "add" ? amtInput : -amtInput;
              const finalTokens = (tokenUser.tokens || 0) + val;
              if (finalTokens < 0) {
                return toast.error(`Insufficient balance. User has only ${tokenUser.tokens || 0} tokens.`);
              }

              setTokenSubmitting(true);
              const { error } = await supabase.from("profiles").update({ tokens: finalTokens }).eq("id", tokenUser.id);
              if (error) toast.error(error.message);
              else {
                await supabase.from("wallet_transactions").insert({ 
                  user_id: tokenUser.id, 
                  amount: val, 
                  type: 'admin_adj', 
                  description: tokenMsg 
                });
                toast.success(tokenAction === "add" ? "Tokens added successfully" : "Tokens removed successfully");
                setTokenUser(null);
                load();
              }
              setTokenSubmitting(false);
            }}>{tokenAction === "add" ? "Add Tokens" : "Remove Tokens"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewUser} onOpenChange={(o) => { if (!o) { setViewUser(null); setNewPassword(""); } }}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <span>{viewUser?.full_name || "User Details"}</span>
              {viewUser?.blocked && (
                <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">Blocked</span>
              )}
            </DialogTitle>
            <div className="text-xs text-muted-foreground mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/30 rounded-xl p-3 border border-border/50">
              <div><strong>College:</strong> {viewUser?.college || "—"}</div>
              <div><strong>Tokens Balance:</strong> {viewUser?.tokens ?? 0} Tokens</div>
              <div><strong>Location:</strong> {[viewUser?.address, viewUser?.state, viewUser?.country].filter(Boolean).join(", ") || "—"}</div>
              <div><strong>Subscription:</strong> {viewUser?.membership_status === "premium" ? "Premium" : "Basic Tier (Free)"}</div>
              <div><strong>Time spent:</strong> {viewUser?.total_time_spent ? `${Math.floor(viewUser.total_time_spent / 60)}h ${viewUser.total_time_spent % 60}m` : "0 mins"}</div>
            </div>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground animate-pulse">Loading profile data...</div>
          ) : (
            <Tabs defaultValue="purchases" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-muted p-1">
                <TabsTrigger value="purchases" className="rounded-xl py-2 font-semibold">Purchased Items ({purchases.length})</TabsTrigger>
                <TabsTrigger value="attempts" className="rounded-xl py-2 font-semibold">Attempts History ({attempts.length})</TabsTrigger>
                <TabsTrigger value="transactions" className="rounded-xl py-2 font-semibold">Wallet Transactions ({transactions.length})</TabsTrigger>
                <TabsTrigger value="actions" className="rounded-xl py-2 font-semibold">Actions</TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 mt-4 overflow-y-auto pr-1">
                <TabsContent value="purchases" className="h-full">
                  {purchases.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No items purchased yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {purchases.map((p) => (
                        <div key={p.id} className="rounded-2xl border border-border p-4 bg-card/50 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold">{p.tests?.title || p.courses?.title || "Unknown Asset"}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5 tracking-wider">{p.tests?.title ? "Test" : "Course"}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="attempts" className="h-full">
                  {attempts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No test attempts recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {attempts.map((a) => (
                        <div key={a.id} className="rounded-2xl border border-border p-4 bg-card/50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">{a.tests?.title || "Test Attempt"}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Started: {new Date(a.started_at).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold">{a.score} / {a.total} marks</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{a.submitted_at ? "Submitted" : "In Progress"}</p>
                            </div>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              a.is_reviewed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                            }`}>
                              {a.is_reviewed ? "Graded" : "Review Pending"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transactions" className="h-full">
                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No transactions recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((w) => (
                        <div key={w.id} className="rounded-2xl border border-border p-4 bg-card/50 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{w.description || "Token Adjustment"}</p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5 tracking-wider">{w.type}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${w.amount >= 0 ? "text-success" : "text-destructive"}`}>
                              {w.amount >= 0 ? `+${w.amount}` : w.amount} Tokens
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(w.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="actions" className="h-full">
                  <div className="space-y-4 max-w-sm py-4">
                    <h4 className="font-display font-bold text-sm">Security Settings</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Update this student's account password. Passwords must be at least 6 characters long.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="new-pass">New Password</Label>
                      <Input 
                        id="new-pass" 
                        type="password" 
                        placeholder="Enter new password..." 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                      />
                    </div>
                    <Button 
                      disabled={resettingPassword || !newPassword} 
                      onClick={async () => {
                        if (newPassword.length < 6) return toast.error("Password must be at least 6 characters.");
                        setResettingPassword(true);
                        try {
                          const res = await adminResetUserPassword({ targetUserId: viewUser.id, newPassword });
                          if (res.success) {
                            toast.success("User password has been successfully reset.");
                            setNewPassword("");
                          }
                        } catch (err: any) {
                          toast.error(err.message || "Failed to reset password.");
                        } finally {
                          setResettingPassword(false);
                        }
                      }}
                      className="rounded-xl"
                    >
                      {resettingPassword ? "Updating..." : "Reset Password"}
                    </Button>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          )}

          <DialogFooter className="mt-4 border-t border-border pt-4">
            <Button onClick={() => setViewUser(null)}>Close Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
