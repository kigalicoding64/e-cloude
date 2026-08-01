import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  APP_LOCK_INACTIVITY_MS,
  APP_LOCK_STORAGE_KEY,
  availableFactors,
  canLockAccount,
  createInactivityLock,
  initialUnlockMode,
  readLockedFlag,
  writeLockedFlag,
} from "@/lib/app-lock";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

describe("app-lock capability", () => {
  it("cannot lock without any factor", () => {
    expect(canLockAccount(null)).toBe(false);
    expect(canLockAccount({ app_pin_enabled: false, totp_enabled: false, passkey_count: 0 })).toBe(false);
  });

  it("can lock with pin, totp or a passkey", () => {
    expect(canLockAccount({ app_pin_enabled: true })).toBe(true);
    expect(canLockAccount({ totp_enabled: true })).toBe(true);
    expect(canLockAccount({ passkey_count: 2 })).toBe(true);
  });

  it("prefers PIN entry when a PIN exists", () => {
    expect(initialUnlockMode({ app_pin_enabled: true, totp_enabled: true })).toBe("pin");
    expect(initialUnlockMode({ totp_enabled: true })).toBe("totp");
  });

  it("reports every offered unlock factor", () => {
    expect(availableFactors({ app_pin_enabled: true, passkey_count: 1 })).toEqual({
      pin: true,
      totp: false,
      passkey: true,
    });
  });
});

describe("lock persistence", () => {
  it("round-trips the locked flag", () => {
    const s = memoryStorage();
    expect(readLockedFlag(s)).toBe(false);
    writeLockedFlag(s, true);
    expect(s._map.get(APP_LOCK_STORAGE_KEY)).toBe("1");
    expect(readLockedFlag(s)).toBe(true);
    writeLockedFlag(s, false);
    expect(readLockedFlag(s)).toBe(false);
  });

  it("never throws when storage is unavailable", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(readLockedFlag(broken)).toBe(false);
    expect(() => writeLockedFlag(broken, true)).not.toThrow();
  });
});

describe("inactivity lock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("locks after the inactivity window", () => {
    const onLock = vi.fn();
    const lock = createInactivityLock(onLock, APP_LOCK_INACTIVITY_MS);
    lock.arm();
    vi.advanceTimersByTime(APP_LOCK_INACTIVITY_MS - 1);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("activity resets the countdown", () => {
    const onLock = vi.fn();
    const lock = createInactivityLock(onLock, 1000);
    lock.arm();
    vi.advanceTimersByTime(900);
    lock.arm(); // user moved the mouse
    vi.advanceTimersByTime(900);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("fires at most once per armed window", () => {
    const onLock = vi.fn();
    const lock = createInactivityLock(onLock, 1000);
    lock.arm();
    vi.advanceTimersByTime(5000);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it("does not lock after dispose", () => {
    const onLock = vi.fn();
    const lock = createInactivityLock(onLock, 1000);
    lock.arm();
    lock.dispose();
    vi.advanceTimersByTime(5000);
    expect(onLock).not.toHaveBeenCalled();
    lock.arm();
    vi.advanceTimersByTime(5000);
    expect(onLock).not.toHaveBeenCalled();
  });
});
