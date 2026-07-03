import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ai/deployments")({
  head: () => ({ meta: [{ title: "Deployments — E-Cloud" }] }),
  component: DeploymentsPage,
});

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  building: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  running: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  stopped: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive",
};

function DeploymentsPage() {
  const { data: rows = [] } = useQuery({
    queryKey: ["ai-all-deployments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_deployments")
        .select("*, ai_models(name, slug), ai_orchestrators(name, region, gpu_type)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    refetchInterval: 5000,
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Deployments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every deployment across all your registered models. Live GPU metrics stream from the runner.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="p-16 text-center">
          <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No deployments yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Runner</th>
                <th className="px-4 py-3">GPU util</th>
                <th className="px-4 py-3">Memory</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{d.ai_models?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_TONE[d.status] ?? "bg-muted"}>{d.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.ai_orchestrators?.name ?? <span className="italic">unassigned</span>}
                    {d.ai_orchestrators?.region && <span className="ml-1 text-xs">· {d.ai_orchestrators.region}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.gpu_util != null ? `${Number(d.gpu_util).toFixed(0)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.memory_used_mb ? `${d.memory_used_mb} MB` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.started_at ? formatDate(d.started_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.ai_models?.slug && (
                      <Link
                        to="/ai/models/$slug"
                        params={{ slug: d.ai_models.slug }}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Open <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
