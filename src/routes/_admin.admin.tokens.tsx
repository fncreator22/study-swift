import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, ExternalLink, User } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/tokens")({ component: AdminTokens });

type TokenRequest = {
  id: string;
  user_id: string;
  amount: number;
  screenshot_url: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profiles: { full_name: string; college: string };
};

function AdminTokens() {
  const [requests, setRequests] = useState<TokenRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("token_requests")
      .select("*, profiles(full_name, college)")
      .order("created_at", { ascending: false });

    if (error) toast.error(error.message);
    else setRequests(data as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleStatus(id: string, status: "approved" | "rejected") {
    const fn = status === "approved" ? "approve_token_request" : "reject_token_request";
    const { error } = await supabase.rpc(fn as any, { _request_id: id });
    if (error) toast.error(error.message);
    else {
      toast.success(`Request ${status}`);
      load();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Token Purchase Requests</h1>
        <p className="text-muted-foreground">Verify and approve user token purchases.</p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Screenshot</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">No requests found</TableCell></TableRow>
            ) : requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{r.profiles?.full_name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{r.profiles?.college}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-primary">{r.amount} Tokens</span>
                    <span className="text-xs text-muted-foreground">₹{r.amount * 10}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={r.message}>{r.message || "—"}</TableCell>
                <TableCell>
                  {r.screenshot_url ? (
                    <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" /> View
                    </a>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {r.status === 'pending' && (
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 text-destructive" onClick={() => handleStatus(r.id, 'rejected')}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-success" onClick={() => handleStatus(r.id, 'approved')}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
