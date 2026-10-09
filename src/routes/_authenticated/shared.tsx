import { PUBLIC_BASE_URL } from "@/lib/site";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Trash2, Share2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shared")({
  head: () => ({ meta: [{ title: "Shared — E-Cloud" }] }),
  component: SharedPage,
});

function SharedPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: shares = [] } = useQuery({
    queryKey: ["shares", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("shares")
        .select("*, files(name, size, mime_type)")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Link revoked"); qc.invalidateQueries({ queryKey: ["shares"] }); },
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold">Shared links</h1>
      {shares.length === 0 ? (
        <Card className="p-16 text-center">
          <Share2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No shared links yet. Share a file from My Files to create one.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Permission</th>
                <th className="px-4 py-3 font-medium">Views</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => (
                <tr key={s.id} className="border-b border-border">
                  <td className="px-4 py-3 font-medium">{(s as { files: { name: string } | null }).files?.name ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{s.permission}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.view_count}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.expires_at ? formatDate(s.expires_at) : "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => {
                      navigator.clipboard.writeText(`${PUBLIC_BASE_URL}/s/${s.token}`);
                      toast.success("Copied");
                    }}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => del.mutate(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </Button>
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
