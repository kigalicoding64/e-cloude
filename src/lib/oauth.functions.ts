import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuthorizationRequest = {
  client: {
    name: string;
    description: string | null;
    homepage_url: string | null;
    client_id: string;
    client_type: string;
  };
  redirectUri: string;
  scopes: string[];
  state: string | null;
  previouslyApproved: boolean;
};

const authorizeInput = z.object({
  client_id: z.string().min(4).max(200),
  redirect_uri: z.string().url().max(500),
  response_type: z.string().max(40).default("code"),
  scope: z.string().max(300).optional(),
  state: z.string().max(500).optional(),
  nonce: z.string().max(300).optional(),
  code_challenge: z.string().max(300).optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),
});

/**
 * Validates an incoming authorization request so the consent screen can render
 * the real client identity and the scopes it may actually receive.
 */
export const describeAuthorizationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authorizeInput.parse(input))
  .handler(async ({ data, context }): Promise<AuthorizationRequest> => {
    const { findClient, filterScopes, redirectUriAllowed } = await import("./oauth.server");
    if (data.response_type !== "code") {
      throw new Error("Only the authorization code flow is supported.");
    }
    const client = await findClient(data.client_id);
    if (!client || !client.is_active) throw new Error("Unknown or disabled application.");
    if (!redirectUriAllowed(client, data.redirect_uri)) {
      throw new Error("This redirect URI is not registered for the application.");
    }
    if (client.client_type === "public" && !data.code_challenge) {
      throw new Error("This application must use PKCE (code_challenge).");
    }

    const requested = (data.scope ?? "openid profile email").split(" ").filter(Boolean);
    const scopes = filterScopes(client, requested);
    if (scopes.length === 0) throw new Error("None of the requested scopes are allowed.");

    const { data: consent } = await context.supabase
      .from("oauth_consents")
      .select("scopes")
      .eq("client_id", client.client_id)
      .maybeSingle();

    return {
      client: {
        name: client.name,
        description: client.description,
        homepage_url: client.homepage_url,
        client_id: client.client_id,
        client_type: client.client_type,
      },
      redirectUri: data.redirect_uri,
      scopes,
      state: data.state ?? null,
      previouslyApproved: scopes.every((scope) => (consent?.scopes ?? []).includes(scope)),
    };
  });

/** Records consent and mints a single-use authorization code. */
export const approveAuthorizationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authorizeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ redirectTo: string }> => {
    const { findClient, filterScopes, redirectUriAllowed, createAuthorizationCode } = await import(
      "./oauth.server"
    );
    const { writeAuditLog } = await import("./identity.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const client = await findClient(data.client_id);
    if (!client || !client.is_active) throw new Error("Unknown or disabled application.");
    if (!redirectUriAllowed(client, data.redirect_uri)) {
      throw new Error("This redirect URI is not registered for the application.");
    }
    const requested = (data.scope ?? "openid profile email").split(" ").filter(Boolean);
    const scopes = filterScopes(client, requested);
    if (scopes.length === 0) throw new Error("None of the requested scopes are allowed.");

    const code = await createAuthorizationCode({
      clientId: client.client_id,
      userId: context.userId,
      redirectUri: data.redirect_uri,
      scopes,
      nonce: data.nonce ?? null,
      codeChallenge: data.code_challenge ?? null,
      codeChallengeMethod: data.code_challenge_method ?? null,
    });

    await supabaseAdmin.from("oauth_consents").upsert(
      {
        user_id: context.userId,
        client_id: client.client_id,
        scopes,
      },
      { onConflict: "user_id,client_id" },
    );

    await writeAuditLog({
      userId: context.userId,
      eventType: "oauth.consent_granted",
      category: "security",
      description: `Granted ${client.name} access to ${scopes.join(", ")}`,
      metadata: { client_id: client.client_id, scopes },
    });

    const url = new URL(data.redirect_uri);
    url.searchParams.set("code", code);
    if (data.state) url.searchParams.set("state", data.state);
    return { redirectTo: url.toString() };
  });

/** Denies the request and returns the spec-compliant error redirect. */
export const denyAuthorizationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        client_id: z.string().min(4).max(200),
        redirect_uri: z.string().url().max(500),
        state: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ redirectTo: string }> => {
    const { findClient, redirectUriAllowed } = await import("./oauth.server");
    const { writeAuditLog } = await import("./identity.server");

    const client = await findClient(data.client_id);
    if (!client || !redirectUriAllowed(client, data.redirect_uri)) {
      throw new Error("This redirect URI is not registered for the application.");
    }

    await writeAuditLog({
      userId: context.userId,
      eventType: "oauth.consent_denied",
      category: "security",
      status: "warning",
      description: `Denied ${client.name} access`,
      metadata: { client_id: client.client_id },
    });

    const url = new URL(data.redirect_uri);
    url.searchParams.set("error", "access_denied");
    url.searchParams.set("error_description", "The user denied the authorization request.");
    if (data.state) url.searchParams.set("state", data.state);
    return { redirectTo: url.toString() };
  });

/** Connected applications shown in the account area, plus one-click revoke. */
export const listConnectedApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("oauth_consents")
      .select("id, client_id, scopes, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Could not load your connected applications.");
    return data ?? [];
  });

export const revokeConnectedApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().max(200) }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await context.supabase.from("oauth_consents").delete().eq("client_id", data.clientId);
    await supabaseAdmin
      .from("oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", data.clientId)
      .eq("user_id", context.userId)
      .is("revoked_at", null);
    return { ok: true };
  });
