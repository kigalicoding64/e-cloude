import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, ShieldCheck } from "lucide-react";

import { EgreedLogo } from "@/components/brand/EgreedLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  approveAuthorizationRequest,
  denyAuthorizationRequest,
  describeAuthorizationRequest,
  type AuthorizationRequest,
} from "@/lib/oauth.functions";

const TITLE = "Authorize application — EGREED Identity";
const DESCRIPTION =
  "Review what an application is asking for before granting it access to your EGREED ID.";

/** Plain-language labels for the scopes a client can request. */
const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm your EGREED ID",
  profile: "Your name, username, picture and locale",
  email: "Your email address and its verified status",
  phone: "Your phone number",
  offline_access: "Stay connected while you are away",
  "organizations:read": "The organizations you belong to and your role",
  "identity:read": "Read your identity data",
  "identity:write": "Update your identity data",
};

type Search = {
  client_id?: string | undefined;
  redirect_uri?: string | undefined;
  response_type?: string | undefined;
  scope?: string | undefined;
  state?: string | undefined;
  nonce?: string | undefined;
  code_challenge?: string | undefined;
  code_challenge_method?: "S256" | "plain" | undefined;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const Route = createFileRoute("/oauth/authorize")({
  // The consent decision depends on the browser session, so render client-side.
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    client_id: str(search["client_id"]),
    redirect_uri: str(search["redirect_uri"]),
    response_type: str(search["response_type"]) ?? "code",
    scope: str(search["scope"]),
    state: str(search["state"]),
    nonce: str(search["nonce"]),
    code_challenge: str(search["code_challenge"]),
    code_challenge_method:
      search["code_challenge_method"] === "plain"
        ? "plain"
        : search["code_challenge_method"] === "S256"
          ? "S256"
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AuthorizePage,
});

function AuthorizePage() {
  const search = Route.useSearch();
  const describe = useServerFn(describeAuthorizationRequest);
  const approve = useServerFn(approveAuthorizationRequest);
  const deny = useServerFn(denyAuthorizationRequest);

  const [request, setRequest] = useState<AuthorizationRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);

  const params = {
    client_id: search.client_id ?? "",
    redirect_uri: search.redirect_uri ?? "",
    response_type: search.response_type ?? "code",
    ...(search.scope ? { scope: search.scope } : {}),
    ...(search.state ? { state: search.state } : {}),
    ...(search.nonce ? { nonce: search.nonce } : {}),
    ...(search.code_challenge ? { code_challenge: search.code_challenge } : {}),
    ...(search.code_challenge_method
      ? { code_challenge_method: search.code_challenge_method }
      : {}),
  };

  const load = useCallback(async () => {
    if (!search.client_id || !search.redirect_uri) {
      setError("This authorization link is missing client_id or redirect_uri.");
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // Preserve the full consent URL so the user returns here after sign-in.
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/auth?next=${encodeURIComponent(next)}`);
      return;
    }
    setEmail(data.session.user.email ?? null);
    try {
      setRequest(await describe({ data: params }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This request could not be validated.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.client_id, search.redirect_uri]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleApprove() {
    setPending("approve");
    try {
      const { redirectTo } = await approve({ data: params });
      window.location.replace(redirectTo);
    } catch (cause) {
      setPending(null);
      setError(cause instanceof Error ? cause.message : "Authorization failed.");
    }
  }

  async function handleDeny() {
    setPending("deny");
    try {
      const { redirectTo } = await deny({
        data: {
          client_id: params.client_id,
          redirect_uri: params.redirect_uri,
          ...(search.state ? { state: search.state } : {}),
        },
      });
      window.location.replace(redirectTo);
    } catch (cause) {
      setPending(null);
      setError(cause instanceof Error ? cause.message : "Could not cancel the request.");
    }
  }

  return (
    <div className="bg-hero relative flex min-h-screen items-center justify-center px-4 py-14">
      <div className="bg-grid absolute inset-0 opacity-30" aria-hidden />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block" aria-label="EGREED Identity home">
            <EgreedLogo />
          </Link>
        </div>

        <div className="surface-panel p-6 sm:p-8">
          {error ? (
            <div className="text-center">
              <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden />
              <h1 className="mt-4 font-display text-xl font-semibold">Request not allowed</h1>
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link to="/account">Back to your account</Link>
              </Button>
            </div>
          ) : !request ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Validating request…
            </div>
          ) : (
            <>
              <ShieldCheck className="size-6 text-primary" aria-hidden />
              <h1 className="mt-4 font-display text-xl font-semibold">
                Connect {request.client.name} to your EGREED ID
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {request.client.name} will be able to use this app as you
                {email ? ` (${email})` : ""}.
              </p>
              {request.client.description && (
                <p className="mt-2 text-sm text-muted-foreground">{request.client.description}</p>
              )}

              <ul className="mt-6 space-y-2">
                {request.scopes.map((scope) => (
                  <li key={scope} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>
                      {SCOPE_LABELS[scope] ?? `Additional permission requested: ${scope}`}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="mt-6 space-y-1 border-t border-border pt-4 font-mono text-xs text-muted-foreground">
                <div className="break-all">client_id: {request.client.client_id}</div>
                <div className="break-all">redirect_uri: {request.redirectUri}</div>
                <div>scope: {request.scopes.join(" ")}</div>
              </dl>

              <p className="mt-4 text-xs text-muted-foreground">
                This does not bypass EGREED permissions or organization policies.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={handleDeny} disabled={pending !== null}>
                  {pending === "deny" && <Loader2 className="size-4 animate-spin" />}
                  Cancel
                </Button>
                <Button onClick={handleApprove} disabled={pending !== null}>
                  {pending === "approve" && <Loader2 className="size-4 animate-spin" />}
                  {request.previouslyApproved ? "Continue" : "Allow access"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
