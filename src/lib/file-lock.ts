// Pure, testable helpers for per-file password / PIN locks.

export type FileLockFields = {
  password_hash?: string | null;
  pin_hash?: string | null;
};

export type LockKind = "password" | "pin";

export type FileLockState = {
  locked: boolean;
  hasPassword: boolean;
  hasPin: boolean;
  /** Factor to prompt for when the file must be unlocked. */
  promptKind: LockKind | null;
  label: "Locked" | "Unlocked";
};

export function fileLockState(file: FileLockFields | null | undefined): FileLockState {
  const hasPassword = Boolean(file?.password_hash);
  const hasPin = Boolean(file?.pin_hash);
  const locked = hasPassword || hasPin;
  return {
    locked,
    hasPassword,
    hasPin,
    promptKind: hasPassword ? "password" : hasPin ? "pin" : null,
    label: locked ? "Locked" : "Unlocked",
  };
}

export function lockSummary(file: FileLockFields | null | undefined): string {
  const s = fileLockState(file);
  if (!s.locked) return "No lock";
  const parts: string[] = [];
  if (s.hasPassword) parts.push("password");
  if (s.hasPin) parts.push("PIN");
  return `Protected by ${parts.join(" + ")}`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

/** Salt prefixes must stay stable — changing them invalidates stored hashes. */
export function lockHashInput(kind: LockKind, secret: string): string {
  return kind === "pin" ? `file-pin:${secret}` : `file-lock:${secret}`;
}

/** True when the file requires a secret and it has not been verified yet. */
export function needsUnlock(
  file: FileLockFields | null | undefined,
  verifiedIds: ReadonlySet<string>,
  fileId: string,
): boolean {
  return fileLockState(file).locked && !verifiedIds.has(fileId);
}
