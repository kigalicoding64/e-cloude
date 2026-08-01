import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/hash";
import { isValidPin, lockHashInput } from "@/lib/file-lock";

export const setFileLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { file_id: string; password?: string; pin?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { password_hash?: string | null; pin_hash?: string | null } = {};
    if (data.password !== undefined) {
      patch.password_hash = data.password
        ? await sha256Hex(lockHashInput("password", data.password))
        : null;
    }
    if (data.pin !== undefined) {
      if (data.pin && !isValidPin(data.pin)) throw new Error("PIN must be 4-8 digits");
      patch.pin_hash = data.pin ? await sha256Hex(lockHashInput("pin", data.pin)) : null;
    }
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await supabaseAdmin
      .from("files")
      .update(patch)
      .eq("id", data.file_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyFileLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { file_id: string; secret: string; kind: "password" | "pin" }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("files")
      .select("password_hash, pin_hash, user_id")
      .eq("id", data.file_id)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("Not found");
    const target = data.kind === "pin" ? (row as any).pin_hash : (row as any).password_hash;
    if (!target) return { ok: true };
    const hash = await sha256Hex(lockHashInput(data.kind, data.secret));
    if (hash !== target) throw new Error(`Wrong ${data.kind}`);
    return { ok: true };
  });

