import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, CheckCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/_student/notifications")({ component: StudentNotifications });

type Notification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_active: boolean;
};

function StudentNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase.from("system_notifications" as any).select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("notification_reads" as any).select("notification_id").eq("user_id", user.id)
    ]);
    setNotifications((notifs as any) ?? []);
    setReadIds(new Set((reads ?? []).map((r: any) => r.notification_id)));
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function markRead(id: string) {
    if (readIds.has(id) || !user) return;
    await supabase.from("notification_reads" as any).upsert({ notification_id: id, user_id: user.id });
    setReadIds(prev => new Set([...prev, id]));
  }

  async function markAllRead() {
    if (!user) return;
    const unread = notifications.filter(n => !readIds.has(n.id));
    if (unread.length === 0) return toast.info("All notifications already read");
    setMarkingAll(true);
    try {
      await Promise.all(
        unread.map(n =>
          supabase.from("notification_reads" as any).upsert({ notification_id: n.id, user_id: user.id })
        )
      );
      setReadIds(new Set(notifications.map(n => n.id)));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "You're all caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={markingAll}
            className="rounded-xl gap-2 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {markingAll ? "Marking..." : "Mark all read"}
          </Button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <Card className="rounded-3xl">
          <CardContent className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Bell className="h-8 w-8 text-muted-foreground opacity-40" />
            </div>
            <h2 className="font-bold text-base text-foreground">No notifications yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Admin broadcasts will appear here when posted.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => {
            const isRead = readIds.has(n.id);
            return (
              <Card
                key={n.id}
                className={`rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                  isRead ? "opacity-70" : "border-primary/20 shadow-sm"
                }`}
                onClick={() => markRead(n.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Unread dot */}
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${isRead ? "bg-muted" : "bg-primary animate-pulse"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-snug ${isRead ? "text-muted-foreground" : "text-foreground"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1 whitespace-pre-wrap">{n.body}</p>
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(n.created_at)}
                        {isRead && (
                          <span className="ml-2 flex items-center gap-0.5 text-emerald-500">
                            <CheckCheck className="h-3 w-3" /> Read
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
