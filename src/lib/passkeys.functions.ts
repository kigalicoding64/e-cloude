import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// WebAuthn / passkeys.
// RP config: derived from request origin at call time so it works on any host.

function rpFromOrigin(origin: string) {
  const url = new URL(origin);
  return { rpID: url.hostname, origin };
}

export const listPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_passkeys")
      .select("id, name, device_type, backed_up, transports, last_used_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const startPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = rpFromOrigin(data.origin);
    const { data: existing } = await supabaseAdmin
      .from("user_passkeys")
      .select("credential_id, transports")
      .eq("user_id", context.userId);
    const email = (context.claims as any)?.email ?? "user";
    const opts = await generateRegistrationOptions({
      rpName: "E-Cloud",
      rpID,
      userID: new TextEncoder().encode(context.userId),
      userName: email,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: (existing ?? []).map((c: any) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as any[],
      })),
    });
    await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: context.userId,
      challenge: opts.challenge,
      purpose: "register",
    });
    return { options: opts, origin };
  });

export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: any; name: string; origin: string }) => d)
  .handler(async ({ data, context }) => {
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = rpFromOrigin(data.origin);
    const { data: chalRows } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge")
      .eq("user_id", context.userId)
      .eq("purpose", "register")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    const chal = chalRows?.[0];
    if (!chal) throw new Error("No challenge");
    const verification = await verifyRegistrationResponse({
      response: data.response,
      expectedChallenge: chal.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Verification failed");
    }
    const info: any = verification.registrationInfo;
    const cred = info.credential ?? info;
    const credentialId: string = cred.id;
    const publicKey: Uint8Array = cred.publicKey ?? info.credentialPublicKey;
    const counter: number = cred.counter ?? info.counter ?? 0;
    const publicKeyB64 = btoa(String.fromCharCode(...publicKey));

    await supabaseAdmin.from("user_passkeys").insert({
      user_id: context.userId,
      name: data.name || "Passkey",
      credential_id: credentialId,
      public_key: publicKeyB64,
      counter,
      transports: data.response?.response?.transports ?? [],
      device_type: info.credentialDeviceType ?? null,
      backed_up: info.credentialBackedUp ?? false,
    });
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", chal.id);
    return { ok: true };
  });

export const deletePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_passkeys")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

// Verify a passkey assertion as proof for sensitive actions (step-up).
export const verifyPasskeyForSensitive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { origin: string }) => d)
  .handler(async ({ data, context }) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID } = rpFromOrigin(data.origin);
    const { data: creds } = await supabaseAdmin
      .from("user_passkeys")
      .select("credential_id, transports")
      .eq("user_id", context.userId);
    const opts = await generateAuthenticationOptions({
      rpID,
      allowCredentials: (creds ?? []).map((c: any) => ({
        id: c.credential_id,
        transports: (c.transports ?? []) as any[],
      })),
      userVerification: "preferred",
    });
    await supabaseAdmin.from("webauthn_challenges").insert({
      user_id: context.userId,
      challenge: opts.challenge,
      purpose: "authenticate",
    });
    return { options: opts };
  });

export const completePasskeySensitive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: any; origin: string }) => d)
  .handler(async ({ data, context }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rpID, origin } = rpFromOrigin(data.origin);
    const { data: chalRows } = await supabaseAdmin
      .from("webauthn_challenges")
      .select("id, challenge")
      .eq("user_id", context.userId)
      .eq("purpose", "authenticate")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    const chal = chalRows?.[0];
    if (!chal) throw new Error("No challenge");
    const credentialId = data.response?.id;
    const { data: cred } = await supabaseAdmin
      .from("user_passkeys")
      .select("id, credential_id, public_key, counter, transports")
      .eq("credential_id", credentialId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!cred) throw new Error("Unknown passkey");
    const pkBytes = Uint8Array.from(atob((cred as any).public_key), (c) => c.charCodeAt(0));
    const verification = await verifyAuthenticationResponse({
      response: data.response,
      expectedChallenge: chal.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: (cred as any).credential_id,
        publicKey: pkBytes,
        counter: Number((cred as any).counter ?? 0),
        transports: ((cred as any).transports ?? []) as any[],
      },
    });
    if (!verification.verified) throw new Error("Verification failed");
    await supabaseAdmin
      .from("user_passkeys")
      .update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", (cred as any).id);
    await supabaseAdmin.from("webauthn_challenges").delete().eq("id", chal.id);
    await supabaseAdmin
      .from("sensitive_action_grants")
      .insert({ user_id: context.userId, scope: "all" });
    return { ok: true };
  });
