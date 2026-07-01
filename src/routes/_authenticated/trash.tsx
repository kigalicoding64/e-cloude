import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw } from "lucide-react";
import { formatBytes, formatDate, iconForMime } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trash")({
  head: () => ({ meta: [{ title: "Trash — E-Cloud" }] }),
  component: TrashPage,
});

function TrashPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: files = [] } = useQuery({
    queryKey: ["trash", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("files").select("*").eq("user_id", user!.id).eq("is_trashed", true).order("trashed_at", { ascending: false });
      return data ?? [];
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("files").update({ is_trashed: false, trashed_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Restored"); qc.invalidateQueries({ queryKey: ["trash"] }); qc.invalidateQueries({ queryKey: ["files"] }); },
  });

  const purge = useMutation({
    mutationFn: async (file: { id: string; storage_path: string; size: number }) => {
      await supabase.storage.from("user-files").remove([file.storage_path]);
      const { error } = await supabase.from("files").delete().eq("id", file.id);
      if (error) throw error;
      const { data: prof } = await supabase.from("profiles").select("storage_used").eq("id", user!.id).maybeSingle();
      const newUsed = Math.max(0, Number(prof?.storage_used ?? 0) - Number(file.size));
      await supabase.from("profiles").update({ storage_used: newUsed }).eq("id", user!.id);
    },
    onSuccess: () => { toast.success("Deleted permanently"); qc.invalidateQueries({ queryKey: ["trash"] }); qc.invalidateQueries({ queryKey: ["profile"] }); },
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold">Trash</h1>
      {files.length === 0 ? (
        <Card className="p-16 text-center">
          <Trash2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">Trash is empty.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Trashed</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-border">
                  <td className="px-4 py-3 font-medium">
                    <span className="mr-2 rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] uppercase text-primary">{iconForMime(f.mime_type).slice(0, 3)}</span>
                    {f.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatBytes(Number(f.size))}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.trashed_at ? formatDate(f.trashed_at) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => restore.mutate(f.id)}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
                    <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={() => purge.mutate({ id: f.id, storage_path: f.storage_path, size: Number(f.size) })}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete forever
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
