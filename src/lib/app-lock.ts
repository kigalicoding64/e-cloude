// Pure, testable logic for the app-lock inactivity overlay.
// Kept free of React/DOM imports so it can be unit-tested directly.

export const APP_LOCK_INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes
export const APP_LOCK_STORAGE_KEY = "ecloud:applock:locked";

export type SecurityStatus = {
  app_pin_enabled?: boolean | null;
  totp_enabled?: boolean | null;
  passkey_count?: number | null;
} | null | undefined;

export type UnlockMode = "pin" | "totp";

/** The overlay only makes sense when at least one unlock factor exists. */
export function canLockAccount(status: SecurityStatus): boolean {
  if (!status) return false;
  return Boolean(
    status.app_pin_enabled || status.totp_enabled || (status.passkey_count ?? 0) > 0,
  );
}

/** Preferred unlock method when the overlay appears. */
export function initialUnlockMode(status: SecurityStatus): UnlockMode {
  return status?.app_pin_enabled ? "pin" : "totp";
}

/** Which unlock factors should be offered as alternatives to `mode`. */
export function availableFactors(status: SecurityStatus) {
  return {
    pin: Boolean(status?.app_pin_enabled),
    totp: Boolean(status?.totp_enabled),
    passkey: (status?.passkey_count ?? 0) > 0,
  };
}

export type LockStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readLockedFlag(storage: LockStorage | null | undefined): boolean {
  try {
    return storage?.getItem(APP_LOCK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeLockedFlag(storage: LockStorage | null | undefined, locked: boolean) {
  try {
    if (locked) storage?.setItem(APP_LOCK_STORAGE_KEY, "1");
    else storage?.removeItem(APP_LOCK_STORAGE_KEY);
  } catch {
    /* storage unavailable — in-memory state still applies */
  }
}

export type InactivityLock = {
  /** Reset the countdown (call on any user activity). */
  arm: () => void;
  /** Stop all timers. */
  dispose: () => void;
};

/**
 * Framework-agnostic inactivity timer. Calls `onLock` once the user has been
 * idle for `timeoutMs`, and never fires again until `arm()` is called.
 */
export function createInactivityLock(
  onLock: () => void,
  timeoutMs: number = APP_LOCK_INACTIVITY_MS,
): InactivityLock {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const clear = () => {
    if (handle) clearTimeout(handle);
    handle = null;
  };

  return {
    arm() {
      if (disposed) return;
      clear();
      handle = setTimeout(() => {
        handle = null;
        onLock();
      }, timeoutMs);
    },
    dispose() {
      disposed = true;
      clear();
    },
  };
}

export const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
] as const;
