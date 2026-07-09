import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex, randomToken } from "@/lib/hash";

// ---------- helpers ----------
async function ensureRow(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("user_security")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
}

function base32Encode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

async function grantSensitive(userId: string, scope = "all") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("sensitive_action_grants")
    .insert({ user_id: userId, scope });
}

// ---------- STATUS ----------
export const getSecurityStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sec } = await supabaseAdmin
      .from("user_security")
      .select("totp_enabled, app_pin_enabled, require_2fa_for_sensitive, backup_codes_hashed")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { count: passkeyCount } = await supabaseAdmin
      .from("user_passkeys")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId);
    const { data: grants } = await supabaseAdmin
      .from("sensitive_action_grants")
      .select("expires_at")
      .eq("user_id", context.userId)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    return {
      totp_enabled: !!sec?.totp_enabled,
      app_pin_enabled: !!sec?.app_pin_enabled,
      require_2fa_for_sensitive: sec?.require_2fa_for_sensitive ?? true,
      backup_codes_remaining: (sec?.backup_codes_hashed as string[] | null)?.length ?? 0,
      passkey_count: passkeyCount ?? 0,
      has_sensitive_grant: (grants?.length ?? 0) > 0,
    };
  });

// ---------- TOTP ----------
export const startTotpEnroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureRow(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rand = new Uint8Array(20);
    crypto.getRandomValues(rand);
    const secret = base32Encode(rand);
    const email = (context.claims as any)?.email ?? "user";
    const issuer = "E-Cloud";
    const otpauth = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
      email,
    )}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    await supabaseAdmin
      .from("user_security")
      .update({ totp_pending_secret: secret })
      .eq("user_id", context.userId);
    return { secret, otpauth_url: otpauth };
  });

export const verifyTotpEnroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_security")
      .select("totp_pending_secret")
      .eq("user_id", context.userId)
      .maybeSingle();
    const secret = (row as any)?.totp_pending_secret;
    if (!secret) throw new Error("No pending enrollment");
    const { TOTP, Secret } = await import("otpauth");
    const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 });
    const delta = totp.validate({ token: data.code.replace(/\s+/g, ""), window: 1 });
    if (delta === null) throw new Error("Invalid code");
    // Generate 10 backup codes
    const codes: string[] = [];
    const hashed: string[] = [];
    for (let i = 0; i < 10; i++) {
      const c = randomToken(5).toUpperCase().slice(0, 10);
      codes.push(c);
      hashed.push(await sha256Hex(`bc:${c}`));
    }
    await supabaseAdmin
      .from("user_security")
      .update({
        totp_secret: secret,
        totp_pending_secret: null,
        totp_enabled: true,
        backup_codes_hashed: hashed,
      })
      .eq("user_id", context.userId);
    await grantSensitive(context.userId);
    return { backup_codes: codes };
  });

export const verifyTotpForSensitive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_security")
      .select("totp_secret, backup_codes_hashed, totp_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    const r = row as any;
    if (!r?.totp_enabled) throw new Error("2FA not enabled");
    const code = data.code.replace(/\s+/g, "");
    // Try TOTP first
    const { TOTP, Secret } = await import("otpauth");
    const totp = new TOTP({ secret: Secret.fromBase32(r.totp_secret), digits: 6, period: 30 });
    if (totp.validate({ token: code, window: 1 }) !== null) {
      await grantSensitive(context.userId);
      return { ok: true, via: "totp" };
    }
    // Try backup codes
    const provided = await sha256Hex(`bc:${code.toUpperCase()}`);
    const remaining = (r.backup_codes_hashed as string[]) ?? [];
    const idx = remaining.indexOf(provided);
    if (idx >= 0) {
      remaining.splice(idx, 1);
      await supabaseAdmin
        .from("user_security")
        .update({ backup_codes_hashed: remaining })
        .eq("user_id", context.userId);
      await grantSensitive(context.userId);
      return { ok: true, via: "backup", remaining: remaining.length };
    }
    throw new Error("Invalid code");
  });

export const disableTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Require sensitive grant
    const { data: ok } = await supabaseAdmin.rpc("has_sensitive_grant", {
      _user_id: context.userId,
      _scope: "security_settings",
    });
    if (!ok) throw new Error("Verify 2FA first");
    await supabaseAdmin
      .from("user_security")
      .update({ totp_secret: null, totp_enabled: false, backup_codes_hashed: [] })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const regenerateBackupCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.rpc("has_sensitive_grant", {
      _user_id: context.userId,
      _scope: "all",
    });
    if (!ok) throw new Error("Verify 2FA first");
    const codes: string[] = [];
    const hashed: string[] = [];
    for (let i = 0; i < 10; i++) {
      const c = randomToken(5).toUpperCase().slice(0, 10);
      codes.push(c);
      hashed.push(await sha256Hex(`bc:${c}`));
    }
    await supabaseAdmin
      .from("user_security")
      .update({ backup_codes_hashed: hashed })
      .eq("user_id", context.userId);
    return { backup_codes: codes };
  });

// ---------- App PIN ----------
export const setAppPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pin: string }) => d)
  .handler(async ({ data, context }) => {
    if (!/^\d{4,8}$/.test(data.pin)) throw new Error("PIN must be 4-8 digits");
    await ensureRow(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await sha256Hex(`app-pin:${context.userId}:${data.pin}`);
    await supabaseAdmin
      .from("user_security")
      .update({ app_pin_hash: hash, app_pin_enabled: true })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const verifyAppPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pin: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_security")
      .select("app_pin_hash, app_pin_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    const r = row as any;
    if (!r?.app_pin_enabled) return { ok: true };
    const hash = await sha256Hex(`app-pin:${context.userId}:${data.pin}`);
    if (hash !== r.app_pin_hash) throw new Error("Wrong PIN");
    return { ok: true };
  });

export const disableAppPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pin: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_security")
      .select("app_pin_hash")
      .eq("user_id", context.userId)
      .maybeSingle();
    const r = row as any;
    if (r?.app_pin_hash) {
      const hash = await sha256Hex(`app-pin:${context.userId}:${data.pin}`);
      if (hash !== r.app_pin_hash) throw new Error("Wrong PIN");
    }
    await supabaseAdmin
      .from("user_security")
      .update({ app_pin_hash: null, app_pin_enabled: false })
      .eq("user_id", context.userId);
    return { ok: true };
  });

// ---------- Update settings ----------
export const updateSecurityPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { require_2fa_for_sensitive?: boolean }) => d)
  .handler(async ({ data, context }) => {
    await ensureRow(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { require_2fa_for_sensitive?: boolean } = {};
    if (typeof data.require_2fa_for_sensitive === "boolean") {
      patch.require_2fa_for_sensitive = data.require_2fa_for_sensitive;
    }
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("user_security").update(patch).eq("user_id", context.userId);
    }
    return { ok: true };
  });
