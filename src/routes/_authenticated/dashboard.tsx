import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { FolderOpen, Files as FilesIcon, KeyRound, HardDrive, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDate, iconForMime } from "@/lib/format";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — E-Cloud" }] }),
  component: Dashboard,
});

function Stat({ icon: Icon, label, value, sub }: { icon: typeof FilesIcon; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-display text-3xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Dashboard() {
  const { user } = useSession();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profile, filesCount, foldersCount, apiKeysCount, recent] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("files").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("is_trashed", false),
        supabase.from("folders").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("is_active", true),
        supabase.from("files").select("*").eq("user_id", user!.id).eq("is_trashed", false).order("created_at", { ascending: false }).limit(6),
      ]);
      return {
        profile: profile.data,
        files: filesCount.count ?? 0,
        folders: foldersCount.count ?? 0,
        apiKeys: apiKeysCount.count ?? 0,
        recent: recent.data ?? [],
      };
    },
  });

  const used = Number(stats?.profile?.storage_used ?? 0);
  const quota = Number(stats?.profile?.storage_quota ?? 10 * 1024 ** 3);
  const pct = Math.min(100, (used / quota) * 100);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl font-bold">{stats?.profile?.display_name || "Your workspace"}</h1>
        </div>
        <Link to="/files"><Button className="gap-2">Open My Files <ArrowRight className="h-4 w-4" /></Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat icon={FilesIcon} label="Files" value={String(stats?.files ?? 0)} />
        <Stat icon={FolderOpen} label="Folders" value={String(stats?.folders ?? 0)} />
        <Stat icon={KeyRound} label="Active API keys" value={String(stats?.apiKeys ?? 0)} />
        <Stat icon={HardDrive} label="Storage used" value={formatBytes(used)} sub={`of ${formatBytes(quota)}`} />
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Storage</h3>
          <span className="text-sm text-muted-foreground">{pct.toFixed(1)}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </Card>

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Recent files</h2>
          <Link to="/files" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        {stats?.recent.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            No files yet. <Link to="/files" className="text-primary hover:underline">Upload your first file</Link>.
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {stats?.recent.map((f) => (
              <Card key={f.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary text-xs font-mono uppercase">
                    {iconForMime(f.mime_type).slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{f.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatBytes(Number(f.size))} · {formatDate(f.created_at)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
