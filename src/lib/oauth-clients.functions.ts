/** Owner-scoped management of OAuth applications ("Sign in with EGREED"). RLS applies. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OAUTH_SCOPES } from "./egreed";

export type OAuthClient = {
  id: string;
  name: string;
  description: string | null;
  client_id: string;
  secret_last_four: string | null;
  client_type: string;
  redirect_uris: string[];
  scopes: string[];
  homepage_url: string | null;
  is_active: boolean;
  created_at: string;
};

const COLS =
  "id, name, description, client_id, secret_last_four, client_type, redirect_uris, scopes, homepage_url, is_active, created_at";

function randomToken(bytes: number) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
async function sha256(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}
async function credentials() {
  const clientId = `egr_client_${randomToken(12)}`;
  const secret = `egr_secret_${randomToken(24)}`;
  return { clientId, secret, hash: await sha256(secret), lastFour: secret.slice(-4) };
}

export const listOAuthClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OAuthClient[]> => {
    const { data, error } = await context.supabase
      .from("oauth_clients")
      .select(COLS)
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load your applications.");
    return (data ?? []) as OAuthClient[];
  });

export const createOAuthClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(280).optional().or(z.literal("")),
        client_type: z.enum(["confidential", "public"]),
        homepage_url: z.string().trim().url().max(200).optional().or(z.literal("")),
        redirect_uris: z.array(z.string().trim().url().max(300)).min(1).max(10),
        scopes: z.array(z.enum(OAUTH_SCOPES)).min(1).max(12),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ client: OAuthClient; secret: string | null }> => {
    const creds = await credentials();
    const confidential = data.client_type === "confidential";
    const { data: row, error } = await context.supabase
      .from("oauth_clients")
      .insert({
        owner_id: context.userId,
        name: data.name,
        description: data.description || null,
        client_id: creds.clientId,
        client_secret_hash: confidential ? creds.hash : null,
        secret_last_four: confidential ? creds.lastFour : null,
        client_type: data.client_type,
        homepage_url: data.homepage_url || null,
        redirect_uris: data.redirect_uris,
        scopes: data.scopes,
      })
      .select(COLS)
      .single();
    if (error) throw new Error("Could not register the application.");
    return { client: row as OAuthClient, secret: confidential ? creds.secret : null };
  });

export const setOAuthClientActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid(), active: z.boolean() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("oauth_clients")
      .update({ is_active: data.active })
      .eq("id", data.clientId)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not update the application.");
    return { ok: true };
  });

export const deleteOAuthClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("oauth_clients")
      .delete()
      .eq("id", data.clientId)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Could not delete the application.");
    return { ok: true };
  });

export const rotateOAuthClientSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ secret: string }> => {
    const creds = await credentials();
    const { data: row, error } = await context.supabase
      .from("oauth_clients")
      .update({ client_secret_hash: creds.hash, secret_last_four: creds.lastFour })
      .eq("id", data.clientId)
      .eq("owner_id", context.userId)
      .eq("client_type", "confidential")
      .select("name")
      .single();
    if (error || !row) throw new Error("Could not rotate the client secret.");
    return { secret: creds.secret };
  });
