import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, Files as FilesIcon, HardDrive, KeyRound } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — E-Cloud" }] }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

function AdminPage() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [users, files, keys] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("files").select("size").eq("is_trashed", false),
        supabase.from("api_keys").select("id", { count: "exact", head: true }),
      ]);
      const totalStorage = (files.data ?? []).reduce((a, f) => a + Number(f.size), 0);
      return {
        users: users.data ?? [],
        totalFiles: files.data?.length ?? 0,
        totalStorage,
        totalKeys: keys.count ?? 0,
      };
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold">Admin panel</h1>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Users", value: data?.users.length ?? 0, icon: Users },
          { label: "Files", value: data?.totalFiles ?? 0, icon: FilesIcon },
          { label: "Storage", value: formatBytes(data?.totalStorage ?? 0), icon: HardDrive },
          { label: "API keys", value: data?.totalKeys ?? 0, icon: KeyRound },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <s.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-display text-2xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Users</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Storage used</th><th className="px-4 py-3">Quota</th><th className="px-4 py-3">Joined</th></tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{u.display_name ?? u.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatBytes(Number(u.storage_used))}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatBytes(Number(u.storage_quota))}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
