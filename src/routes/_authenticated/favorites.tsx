import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Star } from "lucide-react";
import { formatBytes, iconForMime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favorites — E-Cloud" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useSession();
  const { data: files = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("files").select("*").eq("user_id", user!.id).eq("is_favorite", true).eq("is_trashed", false).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <h1 className="mb-6 font-display text-3xl font-bold">Favorites</h1>
      {files.length === 0 ? (
        <Card className="p-16 text-center">
          <Star className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No favorites yet. Star files from My Files.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {files.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-xs font-mono uppercase text-primary">
                  {iconForMime(f.mime_type).slice(0, 3)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{formatBytes(Number(f.size))}</div>
                </div>
                <Star className="h-4 w-4 fill-primary text-primary" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
