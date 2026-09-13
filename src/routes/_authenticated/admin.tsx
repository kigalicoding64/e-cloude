import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, Files as FilesIcon, HardDrive, KeyRound, Shield, ShieldOff } from "lucide-react";

import { formatBytes, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — E-Cloud" }] }),
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
    return { currentUserId: userRes.user.id };
  },
  component: AdminPage,
});

function AdminPage() {
  const { currentUserId } = Route.useRouteContext();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [users, files, keys, roles] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("files").select("size").eq("is_trashed", false),
        supabase.from("api_keys").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const totalStorage = (files.data ?? []).reduce((a, f) => a + Number(f.size), 0);
      const adminIds = new Set(
        (roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
      );
      return {
        users: users.data ?? [],
        totalFiles: files.data?.length ?? 0,
        totalStorage,
        totalKeys: keys.count ?? 0,
        adminIds,
      };
    },
  });

  const promote = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promoted to admin");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const demote = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admin role removed");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Admin panel</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/platform-health">
            <Activity className="mr-2 h-4 w-4" />
            Platform health &amp; live checks
          </Link>
        </Button>
      </div>



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
          <h2 className="font-display text-lg font-semibold">Users & roles</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Promote users to admin or revoke access. You can't remove your own admin role.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Storage used</th>
              <th className="px-4 py-3">Quota</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => {
              const isAdmin = data?.adminIds.has(u.id) ?? false;
              const isSelf = u.id === currentUserId;
              const busy = promote.isPending || demote.isPending;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    {u.display_name ?? u.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <Badge className="bg-primary-soft text-primary hover:bg-primary-soft">
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatBytes(Number(u.storage_used))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatBytes(Number(u.storage_quota))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSelf || busy}
                        title={isSelf ? "You can't demote yourself" : undefined}
                        onClick={() => demote.mutate(u.id)}
                      >
                        <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                        Revoke admin
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => promote.mutate(u.id)}>
                        <Shield className="mr-1.5 h-3.5 w-3.5" />
                        Make admin
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
