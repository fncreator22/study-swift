import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/comments")({ component: CommentsAdmin });

function CommentsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  async function load() {
    const { data } = await supabase.from("comments").select("*, tests(title), profiles(full_name)").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);
  async function remove(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-bold">Comments</h1>
      <div className="mt-8 space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No comments.</p>}
        {rows.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{c.profiles?.full_name || "Student"}</span> on <span className="font-medium text-foreground">{c.tests?.title}</span> · {new Date(c.created_at).toLocaleString()}</p>
                <p className="mt-2 text-sm">{c.body}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
