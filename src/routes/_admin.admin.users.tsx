import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/users")({ component: UsersAdmin });

function UsersAdmin() {
  const [users, setUsers] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setUsers(data ?? []);
  }
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
      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-4">Name</th><th className="p-4">College</th><th className="p-4">Joined</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-4 font-medium">{u.full_name || "—"}</td>
                <td className="p-4 text-muted-foreground">{u.college || "—"}</td>
                <td className="p-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="p-4">{u.blocked ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Blocked</span> : <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Active</span>}</td>
                <td className="p-4 text-right">
                  <Button size="sm" variant="outline" onClick={() => toggleBlock(u.id, u.blocked)}>{u.blocked ? "Unblock" : "Block"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
