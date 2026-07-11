import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Send, Trash2, ToggleLeft, ToggleRight, Users, Clock } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/notifications")({ component: AdminNotifications });

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_active: boolean;
};

function AdminNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: notifs }, { count }] = await Promise.all([
      supabase.from("system_notifications" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id", { count: "exact", head: true })
    ]);
    setNotifications((notifs as any) ?? []);
    setTotalUsers(count ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return toast.error("Title and body are required");
    setSending(true);
    try {
      const { error } = await supabase.from("system_notifications" as any).insert({
        title: title.trim(),
        body: body.trim(),
        created_by: user?.id,
        is_active: true
      });
      if (error) throw error;
      toast.success(`Notification sent to all ${totalUsers} users!`);
      setTitle("");
      setBody("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification");
    } finally {
      setSending(false);
    }
  }

  async function handleToggle(n: Notification) {
    const { error } = await supabase
      .from("system_notifications" as any)
      .update({ is_active: !n.is_active })
      .eq("id", n.id);
    if (error) return toast.error(error.message);
    toast.success(n.is_active ? "Notification hidden from users" : "Notification shown to users");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notification permanently?")) return;
    const { error } = await supabase.from("system_notifications" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Notification deleted");
    load();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Notification Centre</h1>
        <p className="text-sm text-muted-foreground mt-1">Broadcast messages to all users on the platform.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Compose Form */}
        <div className="md:col-span-1">
          <Card className="rounded-3xl border border-border shadow-soft sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Send className="h-4 w-4 text-primary" />
                Compose Notification
              </CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs">
                <Users className="h-3 w-3" /> Broadcasts to <strong className="text-foreground ml-1">{totalUsers}</strong>&nbsp;users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSend} className="space-y-4">
                <div className="space-y-1">
                  <Label>Notification Title</Label>
                  <Input
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Important Update"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Message Body</Label>
                  <Textarea
                    required
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message here..."
                    className="h-28 resize-none rounded-xl"
                  />
                </div>
                <Button type="submit" disabled={sending} className="w-full rounded-xl font-bold gap-2">
                  <Send className="h-4 w-4" />
                  {sending ? "Sending..." : "Send to All Users"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Notification History */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="font-bold text-base">Notification History</h2>
          {loading ? (
            <div className="text-sm text-muted-foreground py-10 text-center">Loading...</div>
          ) : notifications.length === 0 ? (
            <Card className="rounded-3xl">
              <CardContent className="py-16 text-center">
                <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground text-sm">No notifications sent yet.</p>
                <p className="text-muted-foreground text-xs mt-1">Use the form to broadcast your first message.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {notifications.map(n => (
                <Card key={n.id} className={`rounded-2xl border transition-all ${n.is_active ? "" : "opacity-50"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm text-foreground truncate">{n.title}</span>
                          <Badge variant={n.is_active ? "success" : "secondary"} className="text-[9px] shrink-0">
                            {n.is_active ? "Visible" : "Hidden"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.body}</p>
                        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(n.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleToggle(n)}
                          className="rounded-lg h-7 w-7 p-0"
                          title={n.is_active ? "Hide from users" : "Show to users"}
                        >
                          {n.is_active
                            ? <ToggleRight className="h-3.5 w-3.5 text-emerald-500" />
                            : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleDelete(n.id)}
                          className="rounded-lg h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
