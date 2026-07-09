import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield, KeyRound, Fingerprint, LockKeyhole, Copy, Trash2 } from "lucide-react";
import {
  getSecurityStatus,
  startTotpEnroll,
  verifyTotpEnroll,
  verifyTotpForSensitive,
  disableTotp,
  regenerateBackupCodes,
  setAppPin,
  disableAppPin,
  updateSecurityPrefs,
} from "@/lib/security.functions";
import {
  listPasskeys,
  startPasskeyRegistration,
  finishPasskeyRegistration,
  deletePasskey,
} from "@/lib/passkeys.functions";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({ meta: [{ title: "Security — E-Cloud" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getSecurityStatus);
  const getPasskeys = useServerFn(listPasskeys);
  const status = useQuery({ queryKey: ["sec-status"], queryFn: () => getStatus({ data: undefined as any }) });
  const passkeys = useQuery({ queryKey: ["passkeys"], queryFn: () => getPasskeys({ data: undefined as any }) });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Security</h1>
          <p className="text-sm text-muted-foreground">2FA, passkeys, app-lock, and file protection</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="2FA" value={status.data?.totp_enabled ? "On" : "Off"} on={!!status.data?.totp_enabled} />
        <StatCard label="Passkeys" value={String(status.data?.passkey_count ?? 0)} on={(status.data?.passkey_count ?? 0) > 0} />
        <StatCard label="App PIN" value={status.data?.app_pin_enabled ? "On" : "Off"} on={!!status.data?.app_pin_enabled} />
        <StatCard label="Backup codes" value={String(status.data?.backup_codes_remaining ?? 0)} on={(status.data?.backup_codes_remaining ?? 0) > 0} />
      </div>

      <Tabs defaultValue="totp" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="totp"><KeyRound className="mr-1 h-4 w-4" />2FA</TabsTrigger>
          <TabsTrigger value="passkeys"><Fingerprint className="mr-1 h-4 w-4" />Passkeys</TabsTrigger>
          <TabsTrigger value="pin"><LockKeyhole className="mr-1 h-4 w-4" />App PIN</TabsTrigger>
          <TabsTrigger value="prefs">Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="totp"><TotpPanel status={status.data} onChange={() => { qc.invalidateQueries({ queryKey: ["sec-status"] }); }} /></TabsContent>
        <TabsContent value="passkeys"><PasskeyPanel passkeys={passkeys.data ?? []} onChange={() => { qc.invalidateQueries({ queryKey: ["passkeys"] }); qc.invalidateQueries({ queryKey: ["sec-status"] }); }} /></TabsContent>
        <TabsContent value="pin"><PinPanel status={status.data} onChange={() => qc.invalidateQueries({ queryKey: ["sec-status"] })} /></TabsContent>
        <TabsContent value="prefs"><PrefsPanel status={status.data} onChange={() => qc.invalidateQueries({ queryKey: ["sec-status"] })} /></TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-center gap-2">
          <div className="text-xl font-semibold">{value}</div>
          {on && <Badge variant="secondary" className="text-[10px]">active</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function TotpPanel({ status, onChange }: { status: any; onChange: () => void }) {
  const start = useServerFn(startTotpEnroll);
  const verify = useServerFn(verifyTotpEnroll);
  const disable = useServerFn(disableTotp);
  const regen = useServerFn(regenerateBackupCodes);
  const verifyForSensitive = useServerFn(verifyTotpForSensitive);
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [stepUp, setStepUp] = useState<null | (() => Promise<void>)>(null);
  const [stepUpCode, setStepUpCode] = useState("");

  const beginEnroll = useMutation({
    mutationFn: () => start({ data: undefined as any }),
    onSuccess: (d) => setEnrollment(d),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const finishEnroll = useMutation({
    mutationFn: () => verify({ data: { code } }),
    onSuccess: (d) => { setCodes(d.backup_codes); setEnrollment(null); setCode(""); onChange(); toast.success("2FA enabled"); },
    onError: (e: any) => toast.error(e?.message ?? "Invalid code"),
  });

  async function requireStepUp(action: () => Promise<void>) {
    setStepUp(() => action);
  }

  async function doStepUp() {
    try {
      await verifyForSensitive({ data: { code: stepUpCode } });
      setStepUpCode("");
      const act = stepUp;
      setStepUp(null);
      if (act) await act();
    } catch (e: any) {
      toast.error(e?.message ?? "Invalid code");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication (TOTP)</CardTitle>
        <CardDescription>Use Google Authenticator, 1Password, Authy, or any TOTP app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status?.totp_enabled && !enrollment && (
          <Button onClick={() => beginEnroll.mutate()} disabled={beginEnroll.isPending}>Enable 2FA</Button>
        )}

        {enrollment && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="text-sm">Scan the QR in your authenticator app, or enter this secret manually:</div>
            <img
              alt="TOTP QR"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrollment.otpauth_url)}`}
              className="rounded border bg-white p-2"
            />
            <div className="font-mono text-xs break-all rounded bg-muted p-2">{enrollment.secret}</div>
            <div className="flex gap-2">
              <Input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
              <Button onClick={() => finishEnroll.mutate()} disabled={finishEnroll.isPending}>Verify</Button>
            </div>
          </div>
        )}

        {status?.totp_enabled && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => requireStepUp(async () => {
                const d = await regen({ data: undefined as any });
                setCodes(d.backup_codes);
                onChange();
              })}>Regenerate backup codes</Button>
              <Button variant="destructive" onClick={() => requireStepUp(async () => {
                await disable({ data: undefined as any });
                onChange();
                toast.success("2FA disabled");
              })}>Disable 2FA</Button>
            </div>
            <p className="text-xs text-muted-foreground">{status.backup_codes_remaining} backup code(s) remaining.</p>
          </div>
        )}

        <Dialog open={!!codes} onOpenChange={(o) => !o && setCodes(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save your backup codes</DialogTitle>
              <DialogDescription>Each code works once. Store them somewhere safe — they let you sign in if you lose your device.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {codes?.map((c) => <div key={c} className="rounded bg-muted p-2 text-center">{c}</div>)}
            </div>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(codes!.join("\n")); toast.success("Copied"); }}>
              <Copy className="mr-2 h-4 w-4" />Copy all
            </Button>
          </DialogContent>
        </Dialog>

        <Dialog open={!!stepUp} onOpenChange={(o) => !o && setStepUp(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify your identity</DialogTitle>
              <DialogDescription>Enter a code from your authenticator app or a backup code.</DialogDescription>
            </DialogHeader>
            <Input placeholder="6-digit code or backup code" value={stepUpCode} onChange={(e) => setStepUpCode(e.target.value)} />
            <Button onClick={doStepUp}>Verify</Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function PasskeyPanel({ passkeys, onChange }: { passkeys: any[]; onChange: () => void }) {
  const start = useServerFn(startPasskeyRegistration);
  const finish = useServerFn(finishPasskeyRegistration);
  const del = useServerFn(deletePasskey);
  const [name, setName] = useState("");

  async function enroll() {
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const { options } = await start({ data: { origin: window.location.origin } });
      const resp = await startRegistration({ optionsJSON: options as any });
      await finish({ data: { response: resp, name: name || "Passkey", origin: window.location.origin } });
      setName("");
      onChange();
      toast.success("Passkey added");
    } catch (e: any) {
      toast.error(e?.message ?? "Passkey enrollment failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>Face ID, Windows Hello, Touch ID, or a hardware key. Phishing-resistant sign-in.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Name (e.g. My MacBook)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={enroll}><Fingerprint className="mr-2 h-4 w-4" />Add passkey</Button>
        </div>
        <div className="space-y-2">
          {passkeys.length === 0 && <p className="text-sm text-muted-foreground">No passkeys yet.</p>}
          {passkeys.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.device_type ?? "unknown"} · {p.backed_up ? "synced" : "device-bound"} · added {new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={async () => { await del({ data: { id: p.id } }); onChange(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PinPanel({ status, onChange }: { status: any; onChange: () => void }) {
  const set = useServerFn(setAppPin);
  const disable = useServerFn(disableAppPin);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>App-lock PIN</CardTitle>
        <CardDescription>4–8 digit PIN required to re-open the dashboard after inactivity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!status?.app_pin_enabled ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>New PIN</Label><Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={8} /></div>
              <div><Label>Confirm</Label><Input type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value)} maxLength={8} /></div>
            </div>
            <Button
              onClick={async () => {
                if (pin !== confirm) return toast.error("PINs do not match");
                try { await set({ data: { pin } }); setPin(""); setConfirm(""); onChange(); toast.success("PIN set"); }
                catch (e: any) { toast.error(e?.message ?? "Failed"); }
              }}
            >Set PIN</Button>
          </>
        ) : (
          <>
            <Input placeholder="Current PIN" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={8} />
            <Button variant="destructive" onClick={async () => {
              try { await disable({ data: { pin } }); setPin(""); onChange(); toast.success("PIN disabled"); }
              catch (e: any) { toast.error(e?.message ?? "Failed"); }
            }}>Disable PIN</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PrefsPanel({ status, onChange }: { status: any; onChange: () => void }) {
  const update = useServerFn(updateSecurityPrefs);
  return (
    <Card>
      <CardHeader><CardTitle>Security policy</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Require 2FA for sensitive actions</Label>
            <p className="text-xs text-muted-foreground">Viewing API keys, deleting files, changing security settings.</p>
          </div>
          <Switch
            checked={!!status?.require_2fa_for_sensitive}
            onCheckedChange={async (v) => { await update({ data: { require_2fa_for_sensitive: v } }); onChange(); }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
