import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sha256Hex } from "@/lib/hash";

// Passwordless sign-in paths (passkey, backup code) and recovery email settings.
// Sign-in functions are public: they verify proof first, then mint a one-time
// sign-in token the browser exchanges for a session.

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function rpFromOrigin(origin: string) {
  const url = new URL(origin);
  return { rpID: url.hostname, origin };
}

async function mintSignInToken(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !u.user?.email) throw new Error("Account not found");
  const { data, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: u.user.email,
  });
  if (linkErr || !data.properties?.hashed_token) throw new Error("Could not sign in");
  return { email: u.user.email, token_hash: data.properties.hashed_token };
}

// ---------- Passkey sign-in ----------
export const startPasskeySignIn = createServerFn({ method: "POST" })
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data }) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = rpFromOrigin(data.origin);
    const opts = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });
    const { data: row, error } = await supabaseAdmin
      .from("webauthn_challenges")
      .insert({ user_id: null, challenge: opts.challenge, purpose: "login" })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not start passkey sign-in");
    return { options: opts, challengeId: row.id as string };
  });

export const finishPasskeySignIn = createServerFn({ method: "POST" })
  .inputValidator((d: { origin: string; challengeId: string; response: any }) => d)
  .handler(async ({ data }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = rpFromOrigin(data.origin);
    const { data: chal } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge")
      .eq("id", data.challengeId)
      .eq("purpose", "login")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!chal) throw new Error("Sign-in expired, try again");
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", chal.id);
    const { data: cred } = await supabaseAdmin
      .from("user_passkeys")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("credential_id", String(data.response?.id ?? ""))
      .maybeSingle();
    if (!cred) throw new Error("This passkey is not registered");
    const pk = Uint8Array.from(atob(cred.public_key), (c) => c.charCodeAt(0));
    const v = await verifyAuthenticationResponse({
      response: data.response,
      expectedChallenge: chal.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey: pk,
        counter: Number(cred.counter ?? 0),
        transports: (cred.transports ?? []) as any[],
      },
    });
    if (!v.verified) throw new Error("Passkey check failed");
    await supabaseAdmin
      .from("user_passkeys")
      .update({ counter: v.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", cred.id);
    return mintSignInToken(cred.user_id);
  });

// ---------- Backup code sign-in ----------
export const backupCodeSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; code: string }) => ({
    email: String(d.email ?? "").trim().slice(0, 255),
    code: String(d.code ?? "").replace(/\s+/g, "").toUpperCase().slice(0, 32),
  }))
  .handler(async ({ data }) => {
    const generic = new Error("Email or backup code is wrong");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userId } = await supabaseAdmin.rpc("find_user_id_by_email", { _email: data.email });
    if (!userId) throw generic;
    const { data: sec } = await supabaseAdmin
      .from("user_security")
      .select("backup_codes_hashed, recovery_failed_attempts, recovery_locked_until")
      .eq("user_id", userId as string)
      .maybeSingle();
    if (!sec) throw generic;
    if (sec.recovery_locked_until && new Date(sec.recovery_locked_until).getTime() > Date.now()) {
      throw new Error(`Too many attempts. Try again in ${LOCK_MINUTES} minutes.`);
    }
    const hash = await sha256Hex(`bc:${data.code}`);
    const codes = (sec.backup_codes_hashed as string[]) ?? [];
    const idx = codes.indexOf(hash);
    if (idx < 0) {
      const attempts = (sec.recovery_failed_attempts ?? 0) + 1;
      await supabaseAdmin
        .from("user_security")
        .update({
          recovery_failed_attempts: attempts >= MAX_FAILED ? 0 : attempts,
          recovery_locked_until:
            attempts >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
        })
        .eq("user_id", userId as string);
      throw generic;
    }
    codes.splice(idx, 1);
    await supabaseAdmin
      .from("user_security")
      .update({ backup_codes_hashed: codes, recovery_failed_attempts: 0, recovery_locked_until: null })
      .eq("user_id", userId as string);
    const tok = await mintSignInToken(userId as string);
    return { ...tok, remaining: codes.length };
  });

// ---------- Recovery email ----------
export const getRecoveryEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_security")
      .select("recovery_email")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { recovery_email: data?.recovery_email ?? null };
  });

export const setRecoveryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string | null }) => d)
  .handler(async ({ data, context }) => {
    const email = data.email ? data.email.trim().toLowerCase() : null;
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)) {
      throw new Error("Enter a valid email");
    }
    const own = String((context.claims as any)?.email ?? "").toLowerCase();
    if (email && email === own) throw new Error("Use a different email than your sign-in email");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_security").upsert({ user_id: context.userId }, { onConflict: "user_id" });
    await supabaseAdmin.from("user_security").update({ recovery_email: email }).eq("user_id", context.userId);
    return { ok: true };
  });
