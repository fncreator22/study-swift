import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";

export const Route = createFileRoute("/_student/wallet")({ component: WalletPage });

type Transaction = {
  id: string;
  amount: number;
  type: 'purchase' | 'unlock' | 'refund' | 'admin_adj';
  description: string;
  created_at: string;
};

function WalletPage() {
  const { user, tokens } = useAuth();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setTxs((data as Transaction[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold">Token Wallet</h1>
        <p className="text-muted-foreground">Manage your tokens and view transaction history.</p>
      </div>

      {/* Balance card — full width on mobile, 1/3 on desktop */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="bg-primary text-primary-foreground sm:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70">Current Balance</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2">
              <Coins className="h-8 w-8" /> {tokens}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs opacity-80">1 Token = ₹10</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" /> Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile card view for small screens */}
          <div className="sm:hidden divide-y divide-border">
            {loading && (
              <p className="text-center py-8 text-sm text-muted-foreground">Loading...</p>
            )}
            {!loading && txs.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground italic">No transactions yet</p>
            )}
            {!loading && txs.map((t) => {
              const isPositive = t.amount > 0;
              return (
                <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <Badge variant={t.type === 'purchase' ? 'success' : t.type === 'unlock' ? 'outline' : 'secondary'} className="self-start">
                      {t.type}
                    </Badge>
                    <p className="text-sm text-foreground truncate">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1 text-sm font-bold ${isPositive ? "text-success" : "text-destructive"}`}>
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                    {Math.abs(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="responsive-table-container hidden sm:block">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                )}
                {!loading && txs.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground italic">No transactions yet</td></tr>
                )}
                {!loading && txs.map((t) => {
                  const isPositive = t.amount > 0;
                  return (
                    <tr key={t.id}>
                      <td className="px-6 py-4">
                        <Badge variant={t.type === 'purchase' ? 'success' : t.type === 'unlock' ? 'outline' : 'secondary'}>
                          {t.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 max-w-[240px] truncate">{t.description}</td>
                      <td className={`px-6 py-4 ${isPositive ? "text-success font-semibold" : "text-destructive font-semibold"}`}>
                        <div className="flex items-center gap-1">
                          {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                          {Math.abs(t.amount)} Tokens
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(t.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
