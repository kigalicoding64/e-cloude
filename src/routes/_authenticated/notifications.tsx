import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — E-Cloud" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markAll() {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null);
    toast.success("All notifications marked as read");
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">{unread} unread</p>
          </div>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAll} className="gap-2">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </header>

      {(data ?? []).length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">You're all caught up.</Card>
      ) : (
        <Card className="divide-y divide-border">
          {(data ?? []).map((n) => (
            <div key={n.id} className={`flex items-start gap-4 p-4 ${!n.read_at ? "bg-primary-soft/30" : ""}`}>
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.read_at ? "bg-primary" : "bg-muted"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{n.title}</div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDate(n.created_at)}</span>
                </div>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
              </div>
              {!n.read_at && (
                <Button size="icon" variant="ghost" aria-label="Mark read" onClick={() => markRead(n.id)}>
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
