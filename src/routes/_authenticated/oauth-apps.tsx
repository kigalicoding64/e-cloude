import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ConnectionDetails } from "@/components/developer/ConnectionDetails";
import { OAUTH_SCOPES, OAUTH_SCOPE_DESCRIPTIONS } from "@/lib/egreed";
import {
  createOAuthClient,
  deleteOAuthClient,
  listOAuthClients,
  setOAuthClientActive,
} from "@/lib/identity.functions";

export const Route = createFileRoute("/_authenticated/oauth-apps")({
  head: () => ({
    meta: [
      { title: "OAuth applications — EGREED Identity" },
      {
        name: "description",
        content: "Register and manage OAuth 2.1 clients that authenticate against EGREED Identity.",
      },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const fetchClients = useServerFn(listOAuthClients);
  const create = useServerFn(createOAuthClient);
  const setActive = useServerFn(setOAuthClientActive);
  const remove = useServerFn(deleteOAuthClient);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [homepage, setHomepage] = useState("");
  const [redirects, setRedirects] = useState("");
  const [clientType, setClientType] = useState<"confidential" | "public">("confidential");
  const [scopes, setScopes] = useState<string[]>(["openid", "profile", "email"]);
  const [secret, setSecret] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const { data, isPending } = useQuery({
    queryKey: ["developer", "clients"],
    queryFn: () => fetchClients(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["developer", "clients"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          name,
          description,
          client_type: clientType,
          homepage_url: homepage,
          redirect_uris: redirects
            .split(/[\n,]/)
            .map((uri) => uri.trim())
            .filter(Boolean),
          scopes,
        },
      }),
    onSuccess: (result) => {
      setSecret(result.secret);
      setName("");
      setDescription("");
      setHomepage("");
      setRedirects("");
      toast.success("Application registered");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { clientId: string; active: boolean }) => setActive({ data: vars }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (clientId: string) => remove({ data: { clientId } }),
    onSuccess: () => {
      toast.success("Application deleted");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">OAuth applications</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Register clients that delegate authentication to EGREED Identity.
        </p>
      </header>

      <section className="surface-panel p-6">
        <h2 className="font-display text-lg font-semibold">Integration endpoints</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Point any OAuth 2.1 / OIDC client library at the discovery document — everything else is
          resolved automatically.
        </p>
        <dl className="mt-4 space-y-2 font-mono text-xs">
          {[
            ["Discovery", "/.well-known/openid-configuration"],
            ["Authorization", "/oauth/authorize"],
            ["Token", "/api/public/oauth/token"],
            ["UserInfo", "/api/public/oauth/userinfo"],
            ["JWKS", "/api/public/oauth/jwks"],
            ["Introspection", "/api/public/oauth/introspect"],
            ["Revocation", "/api/public/oauth/revoke"],
            ["Identity REST", "/api/public/v1/me"],
            ["Organizations REST", "/api/public/v1/organizations"],
          ].map(([label, path]) => (
            <div key={path} className="flex flex-wrap gap-2">
              <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="break-all text-primary">
                {origin}
                {path}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Supported grants: authorization_code (PKCE), refresh_token, client_credentials. ID tokens
          are RS256 and verifiable offline via JWKS.
        </p>
      </section>


      {secret && (
        <div className="surface-panel border-primary/50 p-5">
          <p className="text-sm font-medium">Copy your client secret now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This value is shown once and never stored in plaintext.
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md bg-secondary p-3 font-mono text-xs">
            {secret}
          </code>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setSecret(null)}>
            I've stored it safely
          </Button>
        </div>
      )}

      <form
        className="surface-panel space-y-5 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate();
        }}
      >
        <h2 className="font-display text-lg font-semibold">Register an application</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="app-name">Name</Label>
            <Input
              id="app-name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-homepage">Homepage URL</Label>
            <Input
              id="app-homepage"
              type="url"
              placeholder="https://app.egreedtech.org"
              value={homepage}
              onChange={(e) => setHomepage(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-type">Client type</Label>
            <Select
              value={clientType}
              onValueChange={(value) => setClientType(value as "confidential" | "public")}
            >
              <SelectTrigger id="app-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidential">Confidential (server-side)</SelectItem>
                <SelectItem value="public">Public (SPA / mobile, PKCE)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="app-redirects">Redirect URIs</Label>
            <Textarea
              id="app-redirects"
              required
              rows={3}
              placeholder={"https://app.egreedtech.org/callback\nhttps://localhost:3000/callback"}
              value={redirects}
              onChange={(e) => setRedirects(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">One URI per line.</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="app-description">Description</Label>
            <Textarea
              id="app-description"
              rows={2}
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Requested scopes</legend>
          <p className="text-xs text-muted-foreground">
            Users see these on the consent screen. Tokens can never exceed them, and every API call is
            re-checked against them.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {OAUTH_SCOPES.map((scope) => {
              const active = scopes.includes(scope);
              return (
                <label
                  key={scope}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                    active ? "border-primary/60 bg-primary/5" : "border-border/60 hover:border-border"
                  }`}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={active}
                    onCheckedChange={(checked) =>
                      setScopes((prev) =>
                        checked ? [...new Set([...prev, scope])] : prev.filter((s) => s !== scope),
                      )
                    }
                  />
                  <span className="min-w-0 space-y-1">
                    <span className="block font-mono text-[11px]">{scope}</span>
                    <span className="block text-xs text-muted-foreground">
                      {OAUTH_SCOPE_DESCRIPTIONS[scope]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>


        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Register application
        </Button>
      </form>

      {isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((client) => (
            <li key={client.id} className="surface-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{client.name}</p>
                    <Badge variant={client.is_active ? "secondary" : "destructive"}>
                      {client.is_active ? "Active" : "Disabled"}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {client.client_type}
                    </Badge>
                  </div>
                  <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
                    client_id: {client.client_id}
                  </p>
                  {client.secret_last_four && (
                    <p className="font-mono text-xs text-muted-foreground">
                      secret: ••••{client.secret_last_four}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {client.scopes.join(" ")}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {client.redirect_uris.map((uri) => (
                      <li key={uri} className="font-mono text-xs break-all text-primary">
                        {uri}
                      </li>
                    ))}
                  </ul>
                  <ConnectionDetails client={client} issuer={origin} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggleMutation.isPending}
                    onClick={() =>
                      toggleMutation.mutate({ clientId: client.id, active: !client.is_active })
                    }
                  >
                    {client.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(client.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
          {(data ?? []).length === 0 && (
            <li className="surface-panel p-6 text-sm text-muted-foreground">
              No applications registered yet.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
