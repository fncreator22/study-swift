import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        <h1 className="font-display text-3xl font-bold">Token Wallet</h1>
        <p className="text-muted-foreground">Manage your tokens and view transaction history.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" /> Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : txs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">No transactions yet</TableCell></TableRow>
              ) : txs.map((t) => {
                const isPositive = t.amount > 0;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant={t.type === 'purchase' ? 'success' : t.type === 'unlock' ? 'outline' : 'secondary'}>
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">{t.description}</TableCell>
                    <TableCell className={isPositive ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      <div className="flex items-center gap-1">
                        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        {Math.abs(t.amount)} Tokens
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
