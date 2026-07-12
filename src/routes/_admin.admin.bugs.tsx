import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, CheckCircle, Trash2, Clock, MapPin, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_admin/admin/bugs")({ component: AdminBugsPage });

type BugReport = {
  id: string;
  user_id: string | null;
  error_message: string;
  error_stack: string | null;
  route: string;
  status: "open" | "ongoing" | "resolved" | "closed";
  created_at: string;
};

function AdminBugsPage() {
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "ongoing" | "resolved" | "closed">("all");
  const [expandedBugId, setExpandedBugId] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    let query = supabase.from("bug_reports" as any).select("*").order("created_at", { ascending: false });
    
    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const list = (data as BugReport[]) ?? [];
    setBugs(list);

    // Resolve user profile names if linked
    const userIds = Array.from(new Set(list.map(b => b.user_id).filter((id): id is string => !!id)));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const m: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => {
        m[p.id] = p.full_name || "Student";
      });
      setUsersMap(m);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function updateBugStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from("bug_reports" as any)
      .update({ status: newStatus })
      .eq("id", id);

    if (error) return toast.error(error.message);
    toast.success(`Bug status updated to ${newStatus}`);
    load();
  }

  async function deleteBug(id: string) {
    if (confirm("Are you sure you want to delete this bug log?")) {
      const { error } = await supabase
        .from("bug_reports" as any)
        .delete()
        .eq("id", id);

      if (error) return toast.error(error.message);
      toast.success("Bug log deleted");
      load();
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <span>Bug Diagnostics & Error Logging</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review user-reported frontend and backend issues. Open issues stay logged until resolved.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status:</span>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-36 rounded-2xl bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Logs</SelectItem>
              <SelectItem value="open">Active / Open</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid h-64 place-items-center text-sm text-muted-foreground animate-pulse">Scanning diagnostic reports...</div>
      ) : bugs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-20 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-500/40 animate-pulse" />
          <p className="mt-4 text-muted-foreground font-medium italic">No bug reports match your query filter. All systems clear!</p>
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-soft">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[200px]">Time / User</TableHead>
                <TableHead className="w-[180px]">Location (Route)</TableHead>
                <TableHead>Error Message</TableHead>
                <TableHead className="w-[180px] text-right">Status / Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bugs.map((b) => (
                <>
                  <TableRow key={b.id} className={`${b.status === 'resolved' || b.status === 'closed' ? 'opacity-60 bg-muted/5' : ''}`}>
                    <TableCell className="font-mono text-xs space-y-1">
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" /> {new Date(b.created_at).toLocaleString()}
                      </p>
                      <p className="font-bold text-slate-800">
                        {b.user_id ? usersMap[b.user_id] || 'Student' : 'Anonymous / Guest'}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground truncate max-w-[170px]" title={b.route}>
                        <MapPin className="h-3 w-3 text-sky-500 shrink-0" /> {b.route}
                      </span>
                    </TableCell>
                    <TableCell className="font-sans text-sm">
                      <p className="font-semibold text-slate-900 leading-normal">{b.error_message}</p>
                      {b.error_stack && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setExpandedBugId(expandedBugId === b.id ? null : b.id)}
                          className="h-auto p-0 text-xs font-bold text-primary hover:underline mt-1"
                        >
                          {expandedBugId === b.id ? (
                            <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> Hide Stack Trace</span>
                          ) : (
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> View Stack Trace</span>
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        <select
                          value={b.status}
                          onChange={(e) => updateBugStatus(b.id, e.target.value)}
                          className="h-8 rounded-lg border border-input bg-background px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="open">Active / Open</option>
                          <option value="ongoing">Ongoing</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBug(b.id)}
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/5 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {expandedBugId === b.id && b.error_stack && (
                    <TableRow key={`${b.id}-stack`} className="bg-black/5 hover:bg-black/5">
                      <TableCell colSpan={4} className="p-4 bg-muted/40 border-t border-border/50">
                        <pre className="p-4 bg-slate-950 text-slate-300 font-mono text-[9px] rounded-xl overflow-x-auto leading-relaxed border border-border select-text text-left">
                          {b.error_stack}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
