import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSecurityStatus, verifyAppPin, verifyTotpForSensitive } from "@/lib/security.functions";
import {
  verifyPasskeyForSensitive,
  completePasskeySensitive,
} from "@/lib/passkeys.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Lock, Fingerprint, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTIVITY_EVENTS,
  APP_LOCK_INACTIVITY_MS,
  availableFactors,
  canLockAccount,
  createInactivityLock,
  initialUnlockMode,
  readLockedFlag,
  writeLockedFlag,
  type InactivityLock,
} from "@/lib/app-lock";

export function AppLock() {
  const getStatus = useServerFn(getSecurityStatus);
  const vPin = useServerFn(verifyAppPin);
  const vTotp = useServerFn(verifyTotpForSensitive);
  const startPasskey = useServerFn(verifyPasskeyForSensitive);
  const finishPasskey = useServerFn(completePasskeySensitive);

  const { data: status } = useQuery({
    queryKey: ["security-status-lock"],
    queryFn: () => getStatus(),
    staleTime: 60_000,
  });

  const canLock = canLockAccount(status);
  const factors = availableFactors(status);
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<"pin" | "totp">("pin");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const lockRef = useRef<InactivityLock | null>(null);

  // Restore locked state across reloads.
  useEffect(() => {
    if (!canLock) return;
    if (typeof window !== "undefined" && readLockedFlag(window.sessionStorage)) {
      setLocked(true);
    }
    setMode(initialUnlockMode(status));
  }, [canLock, status]);

  // Inactivity watcher.
  useEffect(() => {
    if (!canLock || locked) return;
    const lock = createInactivityLock(() => {
      setLocked(true);
      writeLockedFlag(window.sessionStorage, true);
    }, APP_LOCK_INACTIVITY_MS);
    lockRef.current = lock;
    const arm = () => lock.arm();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    const onVisibility = () => { if (document.hidden) arm(); };
    document.addEventListener("visibilitychange", onVisibility);
    arm();
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, arm));
      document.removeEventListener("visibilitychange", onVisibility);
      lock.dispose();
      lockRef.current = null;
    };
  }, [canLock, locked]);

  const unlock = () => {
    setLocked(false);
    setValue("");
    writeLockedFlag(typeof window !== "undefined" ? window.sessionStorage : null, false);
  };


  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    try {
      await vPin({ data: { pin: value } });
      unlock();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wrong PIN");
    } finally { setBusy(false); }
  };

  const submitTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    try {
      await vTotp({ data: { code: value } });
      unlock();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally { setBusy(false); }
  };

  const submitPasskey = async () => {
    setBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const { options } = await startPasskey({ data: { origin: window.location.origin } });
      const response = await startAuthentication({ optionsJSON: options as any });
      await finishPasskey({ data: { response, origin: window.location.origin } });
      unlock();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Passkey failed");
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    writeLockedFlag(window.sessionStorage, false);
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  if (!canLock || !locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl">
      <Card className="w-full max-w-md p-8 shadow-elegant">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="text-center">
            <h2 className="font-display text-xl font-bold">App locked</h2>
            <p className="text-sm text-muted-foreground">Verify to continue where you left off.</p>
          </div>
        </div>

        {mode === "pin" && status?.app_pin_enabled ? (
          <form onSubmit={submitPin} className="space-y-3">
            <Label htmlFor="lockpin">App PIN</Label>
            <Input
              id="lockpin" type="password" inputMode="numeric" autoFocus
              value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
              maxLength={8}
            />
            <Button type="submit" className="w-full" disabled={busy}>Unlock</Button>
          </form>
        ) : (
          <form onSubmit={submitTotp} className="space-y-3">
            <Label htmlFor="locktotp">6-digit code or backup code</Label>
            <Input id="locktotp" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
            <Button type="submit" className="w-full" disabled={busy}>Unlock</Button>
          </form>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
          {factors.pin && mode !== "pin" && (
            <Button variant="ghost" size="sm" onClick={() => { setMode("pin"); setValue(""); }}>
              <Lock className="mr-1 h-3 w-3" /> Use PIN
            </Button>
          )}
          {factors.totp && mode !== "totp" && (
            <Button variant="ghost" size="sm" onClick={() => { setMode("totp"); setValue(""); }}>
              <KeyRound className="mr-1 h-3 w-3" /> Use 2FA code
            </Button>
          )}
          {factors.passkey && (

            <Button variant="ghost" size="sm" onClick={submitPasskey} disabled={busy}>
              <Fingerprint className="mr-1 h-3 w-3" /> Use passkey
            </Button>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-4 text-center">
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-foreground">
            Sign out instead
          </button>
        </div>
      </Card>
    </div>
  );
}
