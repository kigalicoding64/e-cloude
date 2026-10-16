import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}

// Any signed-in user: is video upload to Streamtape active?
export const getStorageMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { streamtapeEnabled } = await import("@/lib/streamtape.server");
    return { streamtape: await streamtapeEnabled() };
  });

export const getStreamtapeAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const st = await import("@/lib/streamtape.server");
    const configured = !!st.streamtapeCreds();
    let enabled = false;
    const { data } = await context.supabase.from("app_settings").select("value").eq("key", "streamtape").maybeSingle();
    enabled = !!(data?.value as any)?.enabled;
    let check: { ok: boolean; message: string } | null = null;
    if (configured) {
      try { await st.streamtapeCheck(); check = { ok: true, message: "Connected to Streamtape" }; }
      catch (e) { check = { ok: false, message: (e as Error).message }; }
    }
    return {
      configured,
      enabled,
      missing: [!process.env["STREAMTAPE_LOGIN"] && "STREAMTAPE_LOGIN", !process.env["STREAMTAPE_KEY"] && "STREAMTAPE_KEY"].filter(Boolean) as string[],
      check,
    };
  });

export const setStreamtapeEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => ({ enabled: !!d.enabled }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "streamtape", value: { enabled: data.enabled }, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Owner gets a playable + downloadable link for a Streamtape-stored file.
export const getStreamtapeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string; withDownload?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: f } = await context.supabase
      .from("files")
      .select("id, storage_provider, external_id")
      .eq("id", data.fileId)
      .maybeSingle();
    if (!f || f.storage_provider !== "streamtape" || !f.external_id) throw new Error("File not found");
    const st = await import("@/lib/streamtape.server");
    return {
      embed_url: st.streamtapeEmbedUrl(f.external_id),
      download_url: data.withDownload ? await st.streamtapeDownloadUrl(f.external_id) : null,
    };
  });
