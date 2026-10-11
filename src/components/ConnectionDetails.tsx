import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { rotateOAuthClientSecret } from "@/lib/identity.functions";

function Field({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <code className="block flex-1 overflow-x-auto rounded-md bg-secondary p-2 font-mono text-xs">
          {value}
        </code>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success(`${label} copied`);
          }}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function ConnectionDetails({
  client,
  issuer,
}: {
  client: { id: string; client_id: string; client_type: string; secret_last_four: string | null };
  issuer: string;
}) {
  const queryClient = useQueryClient();
  const rotate = useServerFn(rotateOAuthClientSecret);
  const [secret, setSecret] = useState<string | null>(null);
  const confidential = client.client_type === "confidential";

  const rotation = useMutation({
    mutationFn: () => rotate({ data: { clientId: client.id } }),
    onSuccess: (result) => {
      setSecret(result.secret);
      toast.success("New client secret generated");
      queryClient.invalidateQueries({ queryKey: ["developer", "clients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-semibold">Connection details</p>
        <p className="text-xs text-muted-foreground">
          Paste these three values into any platform that supports "Sign in with OpenID Connect".
        </p>
      </div>
      <Field
        label="OIDC issuer"
        hint="The provider's issuer URL. Discovery is served at /.well-known/openid-configuration."
        value={issuer}
      />
      <Field label="Client ID" hint="Public identifier of this application." value={client.client_id} />
      {confidential ? (
        secret ? (
          <div className="space-y-2">
            <Field
              label="Client secret"
              hint="Shown once. Store it now — it is never saved in plaintext."
              value={secret}
            />
            <Button size="sm" variant="outline" onClick={() => setSecret(null)}>
              I've stored it safely
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-medium">Client secret</p>
            <p className="text-xs text-muted-foreground">
              Hidden for safety. Generate a new one if you lost it.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded-md bg-secondary p-2 font-mono text-xs">
                ••••••••{client.secret_last_four ?? ""}
              </code>
              <Button
                size="sm"
                variant="outline"
                disabled={rotation.isPending}
                onClick={() => {
                  if (confirm("Generate a new secret? The current one stops working immediately."))
                    rotation.mutate();
                }}
              >
                {rotation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Generate new secret
              </Button>
            </div>
          </div>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          Public application — no client secret. Use PKCE (S256) instead.
        </p>
      )}
    </div>
  );
}
