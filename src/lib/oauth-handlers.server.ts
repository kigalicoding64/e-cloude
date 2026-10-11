/**
 * Request handlers for the OAuth 2.1 / OIDC endpoints and the `/api/public/v1`
 * REST surface. The TanStack server routes delegate here, and the developer
 * console's integration test invokes these same functions in-process with
 * synthetic `Request` objects — so what the test verifies is exactly what an
 * external EGREED system hits over HTTP.
 */
import * as oauth from "./oauth.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ------------------------------------------------------------------ token */

export async function handleToken(request: Request): Promise<Response> {
  const supabaseAdmin = await admin();
  const issuer = oauth.issuerFromRequest(request);
  const params = await oauth.readRequestParams(request);

  const { clientId, clientSecret } = oauth.readClientCredentials(request, params);
  if (!clientId) return oauth.oauthError("invalid_client", "client_id is required", 401);

  const client = await oauth.findClient(clientId);
  if (!client || !client.is_active) {
    return oauth.oauthError("invalid_client", "Unknown or disabled client.", 401);
  }
  if (!oauth.clientSecretValid(client, clientSecret)) {
    return oauth.oauthError("invalid_client", "Client authentication failed.", 401);
  }

  const grantType = params["grant_type"];

  if (grantType === "authorization_code") {
    const code = params["code"];
    const redirectUri = params["redirect_uri"];
    if (!code || !redirectUri) {
      return oauth.oauthError("invalid_request", "code and redirect_uri are required.");
    }

    const { data: row } = await supabaseAdmin
      .from("oauth_authorization_codes")
      .select(
        "id, client_id, user_id, redirect_uri, scopes, nonce, code_challenge, code_challenge_method, expires_at, used_at",
      )
      .eq("code_hash", oauth.sha256hex(code))
      .maybeSingle();

    if (!row || row.client_id !== client.client_id) {
      return oauth.oauthError("invalid_grant", "Authorization code is not valid.");
    }
    if (row.used_at) {
      // Replay: revoke everything previously issued from this code path.
      await supabaseAdmin
        .from("oauth_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("client_id", client.client_id)
        .eq("user_id", row.user_id)
        .is("revoked_at", null);
      return oauth.oauthError("invalid_grant", "Authorization code was already used.");
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return oauth.oauthError("invalid_grant", "Authorization code has expired.");
    }
    if (row.redirect_uri !== redirectUri) {
      return oauth.oauthError("invalid_grant", "redirect_uri does not match the code.");
    }
    if (client.client_type === "public" && !row.code_challenge) {
      return oauth.oauthError("invalid_grant", "PKCE is required for public clients.");
    }
    if (!oauth.verifyPkce(params["code_verifier"], row.code_challenge, row.code_challenge_method)) {
      return oauth.oauthError("invalid_grant", "PKCE verification failed.");
    }

    await supabaseAdmin
      .from("oauth_authorization_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    const tokens = await oauth.issueTokens({
      clientId: client.client_id,
      userId: row.user_id,
      scopes: row.scopes ?? [],
      grantType: "authorization_code",
      issuer,
      nonce: row.nonce,
    });
    await oauth.logIntegrationEvent({
      request,
      userId: row.user_id,
      eventType: "oauth.token_issued",
      description: `${client.name} exchanged an authorization code for tokens`,
      metadata: {
        client_id: client.client_id,
        grant_type: "authorization_code",
        scopes: row.scopes ?? [],
      },
    });
    return oauth.jsonResponse(tokens);
  }

  if (grantType === "refresh_token") {
    const refreshToken = params["refresh_token"];
    if (!refreshToken) {
      return oauth.oauthError("invalid_request", "refresh_token is required.");
    }
    const { data: row } = await supabaseAdmin
      .from("oauth_tokens")
      .select("id, client_id, user_id, scopes, refresh_expires_at, revoked_at")
      .eq("refresh_token_hash", oauth.sha256hex(refreshToken))
      .maybeSingle();

    if (!row || row.client_id !== client.client_id || row.revoked_at) {
      await oauth.logIntegrationEvent({
        request,
        userId: row?.user_id ?? null,
        eventType: "oauth.refresh_rejected",
        status: "warning",
        description: `Rejected an invalid or already-rotated refresh token for ${client.name}`,
        metadata: { client_id: client.client_id, reason: row?.revoked_at ? "revoked" : "unknown_token" },
      });
      return oauth.oauthError("invalid_grant", "Refresh token is not valid.");
    }
    if (row.refresh_expires_at && new Date(row.refresh_expires_at).getTime() < Date.now()) {
      await oauth.logIntegrationEvent({
        request,
        userId: row.user_id,
        eventType: "oauth.refresh_rejected",
        status: "warning",
        description: `Refresh token for ${client.name} has expired`,
        metadata: { client_id: client.client_id, reason: "expired" },
      });
      return oauth.oauthError("invalid_grant", "Refresh token has expired.");
    }

    // Rotate: the presented refresh token is retired immediately.
    await supabaseAdmin
      .from("oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", row.id);

    const requested = (params["scope"] ?? "").split(" ").filter(Boolean);
    const scopes =
      requested.length > 0
        ? requested.filter((scope) => (row.scopes ?? []).includes(scope))
        : (row.scopes ?? []);

    const tokens = await oauth.issueTokens({
      clientId: client.client_id,
      userId: row.user_id,
      scopes,
      grantType: "refresh_token",
      issuer,
    });
    await oauth.logIntegrationEvent({
      request,
      userId: row.user_id,
      eventType: "oauth.refresh_used",
      description: `${client.name} refreshed its access without re-consent`,
      metadata: { client_id: client.client_id, grant_type: "refresh_token", scopes, rotated: true },
    });
    return oauth.jsonResponse(tokens);
  }

  if (grantType === "client_credentials") {
    if (client.client_type !== "confidential") {
      return oauth.oauthError(
        "unauthorized_client",
        "Only confidential clients may use client_credentials.",
      );
    }
    const requested = (params["scope"] ?? "").split(" ").filter(Boolean);
    const scopes = oauth
      .filterScopes(client, requested.length > 0 ? requested : [...client.scopes])
      .filter((scope) => scope !== "openid" && scope !== "offline_access");

    const tokens = await oauth.issueTokens({
      clientId: client.client_id,
      userId: null,
      scopes,
      grantType: "client_credentials",
      issuer,
    });
    await oauth.logIntegrationEvent({
      request,
      userId: client.owner_id,
      eventType: "oauth.token_issued",
      description: `${client.name} obtained a machine-to-machine token`,
      metadata: { client_id: client.client_id, grant_type: "client_credentials", scopes },
    });
    return oauth.jsonResponse(tokens);
  }


  return oauth.oauthError("unsupported_grant_type", `Unsupported grant_type: ${grantType}`);
}

/* --------------------------------------------------------------- userinfo */

export async function handleUserinfo(request: Request): Promise<Response> {
  const identity = await oauth.authenticateBearer(request);
  if (!identity) {
    return oauth.oauthError("invalid_token", "A valid access token is required.", 401, {
      "www-authenticate": 'Bearer error="invalid_token"',
    });
  }
  if (!identity.userId) {
    return oauth.oauthError("invalid_token", "This token is not bound to a user.", 403);
  }
  if (!identity.scopes.includes("openid")) {
    return oauth.oauthError("insufficient_scope", "openid scope required.", 403, {
      "www-authenticate": 'Bearer error="insufficient_scope", scope="openid"',
    });
  }
  const claims = await oauth.userinfoClaims(identity.userId, identity.scopes);
  return oauth.jsonResponse(claims);
}

/* -------------------------------------------------------------- introspect */

export async function handleIntrospect(request: Request): Promise<Response> {
  const supabaseAdmin = await admin();
  const params = await oauth.readRequestParams(request);
  const { clientId, clientSecret } = oauth.readClientCredentials(request, params);

  if (!clientId) return oauth.oauthError("invalid_client", "client_id is required", 401);
  const client = await oauth.findClient(clientId);
  if (!client || !client.is_active || !oauth.clientSecretValid(client, clientSecret)) {
    return oauth.oauthError("invalid_client", "Client authentication failed.", 401);
  }

  const token = params["token"];
  if (!token) return oauth.oauthError("invalid_request", "token is required.");

  const hash = oauth.sha256hex(token);
  const { data: row } = await supabaseAdmin
    .from("oauth_tokens")
    .select("client_id, user_id, scopes, expires_at, revoked_at, grant_type, created_at")
    .or(`access_token_hash.eq.${hash},refresh_token_hash.eq.${hash}`)
    .maybeSingle();

  const active =
    Boolean(row) &&
    row!.client_id === client.client_id &&
    !row!.revoked_at &&
    new Date(row!.expires_at).getTime() > Date.now();

  if (!active) return oauth.jsonResponse({ active: false });

  return oauth.jsonResponse({
    active: true,
    client_id: row!.client_id,
    sub: row!.user_id,
    scope: (row!.scopes ?? []).join(" "),
    token_type: "Bearer",
    exp: Math.floor(new Date(row!.expires_at).getTime() / 1000),
    iat: Math.floor(new Date(row!.created_at).getTime() / 1000),
    grant_type: row!.grant_type,
  });
}

/* ------------------------------------------------------------------ revoke */

export async function handleRevoke(request: Request): Promise<Response> {
  const supabaseAdmin = await admin();
  const params = await oauth.readRequestParams(request);
  const { clientId, clientSecret } = oauth.readClientCredentials(request, params);

  if (!clientId) return oauth.oauthError("invalid_client", "client_id is required", 401);
  const client = await oauth.findClient(clientId);
  if (!client || !oauth.clientSecretValid(client, clientSecret)) {
    return oauth.oauthError("invalid_client", "Client authentication failed.", 401);
  }

  const token = params["token"];
  if (!token) return oauth.oauthError("invalid_request", "token is required.");
  const hash = oauth.sha256hex(token);
  const revokedAt = new Date().toISOString();

  await supabaseAdmin
    .from("oauth_tokens")
    .update({ revoked_at: revokedAt })
    .eq("client_id", client.client_id)
    .eq("access_token_hash", hash)
    .is("revoked_at", null);

  await supabaseAdmin
    .from("oauth_tokens")
    .update({ revoked_at: revokedAt })
    .eq("client_id", client.client_id)
    .eq("refresh_token_hash", hash)
    .is("revoked_at", null);

  return oauth.jsonResponse({ revoked: true });
}

