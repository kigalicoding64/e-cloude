import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import { BarChart3, HardDrive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/storage-analytics")({
  head: () => ({ meta: [{ title: "Storage Analytics — E-Cloud" }] }),
  component: StorageAnalytics,
});

function categoryFor(mime: string | null): string {
  if (!mime) return "Other";
  if (mime.startsWith("image/")) return "Images";
  if (mime.startsWith("video/")) return "Video";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime === "application/pdf" || mime.includes("document") || mime.includes("word") || mime.includes("text")) return "Documents";
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("compress")) return "Archives";
  if (mime.includes("json") || mime.includes("javascript") || mime.includes("xml")) return "Code";
  return "Other";
}

const CATEGORY_COLORS: Record<string, string> = {
  Images: "bg-blue-500",
  Video: "bg-purple-500",
  Audio: "bg-pink-500",
  Documents: "bg-emerald-500",
  Archives: "bg-amber-500",
  Code: "bg-cyan-500",
  Other: "bg-muted-foreground",
};

function StorageAnalytics() {
  const { user } = useSession();

  const { data } = useQuery({
    queryKey: ["storage-analytics", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [profileRes, filesRes] = await Promise.all([
        supabase.from("profiles").select("storage_used, storage_quota").eq("id", user!.id).maybeSingle(),
        supabase.from("files").select("name,size,mime_type").eq("user_id", user!.id).eq("is_trashed", false),
      ]);
      const files = filesRes.data ?? [];
      const byCat: Record<string, { size: number; count: number }> = {};
      let total = 0;
      for (const f of files) {
        const c = categoryFor(f.mime_type);
        (byCat[c] ||= { size: 0, count: 0 }).size += Number(f.size ?? 0);
        byCat[c].count += 1;
        total += Number(f.size ?? 0);
      }
      const largest = [...files].sort((a, b) => Number(b.size) - Number(a.size)).slice(0, 8);
      return {
        used: Number(profileRes.data?.storage_used ?? total),
        quota: Number(profileRes.data?.storage_quota ?? 10 * 1024 ** 3),
        total,
        byCat,
        largest,
        fileCount: files.length,
      };
    },
  });

  const pct = data ? Math.min(100, (data.used / data.quota) * 100) : 0;
  const cats = data ? Object.entries(data.byCat).sort((a, b) => b[1].size - a[1].size) : [];

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Storage Analytics</h1>
          <p className="text-sm text-muted-foreground">Breakdown of your cloud storage.</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Total used</div>
              <div className="mt-1 font-display text-3xl font-bold">{data ? formatBytes(data.used) : "—"}</div>
              <div className="text-xs text-muted-foreground">of {data ? formatBytes(data.quota) : "—"} ({pct.toFixed(1)}%)</div>
            </div>
            <HardDrive className="h-8 w-8 text-primary/40" />
          </div>
          <Progress value={pct} className="h-2" />
          <div className="mt-6 space-y-3">
            {cats.map(([name, { size, count }]) => {
              const p = data && data.total > 0 ? (size / data.total) * 100 : 0;
              return (
                <div key={name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${CATEGORY_COLORS[name]}`} />
                      <span className="font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </div>
                    <span className="font-mono text-xs">{formatBytes(size)} · {p.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${CATEGORY_COLORS[name]}`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="mb-4 font-semibold">Largest files</h3>
          {data?.largest.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files yet.</p>
          ) : (
            <ul className="space-y-3">
              {data?.largest.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">{f.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatBytes(Number(f.size))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
