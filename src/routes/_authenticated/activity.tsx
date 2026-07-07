import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity Center — E-Cloud" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { user } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ["activity", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  // Group by day
  const groups: Record<string, typeof data> = {};
  (data ?? []).forEach((e) => {
    const day = new Date(e.created_at).toDateString();
    (groups[day] ||= []).push(e);
  });

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Activity Center</h1>
          <p className="text-sm text-muted-foreground">Everything that has happened in your workspace.</p>
        </div>
      </header>

      {isLoading ? (
        <Card className="p-10 text-center text-muted-foreground">Loading activity…</Card>
      ) : (data ?? []).length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No activity yet — actions will appear here as you use E-Cloud.</Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([day, items]) => (
            <div key={day}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</h3>
              <Card className="divide-y divide-border">
                {items!.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium capitalize">{e.type.replace(/_/g, " ")}</div>
                      {e.target_name && <div className="mt-0.5 truncate text-sm text-muted-foreground">{e.target_name}</div>}
                    </div>
                    <div className="shrink-0 font-mono text-xs text-muted-foreground">{formatDate(e.created_at)}</div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
