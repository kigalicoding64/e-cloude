import { describe, expect, it } from "vitest";
import {
  fileLockState,
  isValidPin,
  lockHashInput,
  lockSummary,
  needsUnlock,
} from "@/lib/file-lock";
import { sha256Hex } from "@/lib/hash";

describe("fileLockState", () => {
  it("reports unlocked files", () => {
    const s = fileLockState({ password_hash: null, pin_hash: null });
    expect(s).toMatchObject({ locked: false, label: "Unlocked", promptKind: null });
    expect(lockSummary(null)).toBe("No lock");
  });

  it("reports password-locked files", () => {
    const s = fileLockState({ password_hash: "abc" });
    expect(s.locked).toBe(true);
    expect(s.label).toBe("Locked");
    expect(s.promptKind).toBe("password");
    expect(lockSummary({ password_hash: "abc" })).toBe("Protected by password");
  });

  it("reports pin-locked files", () => {
    const s = fileLockState({ pin_hash: "abc" });
    expect(s.promptKind).toBe("pin");
    expect(lockSummary({ pin_hash: "abc" })).toBe("Protected by PIN");
  });

  it("prefers the password prompt when both are set", () => {
    expect(fileLockState({ password_hash: "a", pin_hash: "b" }).promptKind).toBe("password");
    expect(lockSummary({ password_hash: "a", pin_hash: "b" })).toBe("Protected by password + PIN");
  });
});

describe("pin validation", () => {
  it("accepts 4-8 digits only", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12345678")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("123456789")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });
});

describe("lock hashing", () => {
  it("uses stable, kind-specific salt prefixes", () => {
    expect(lockHashInput("password", "s3cret")).toBe("file-lock:s3cret");
    expect(lockHashInput("pin", "1234")).toBe("file-pin:1234");
  });

  it("produces different hashes for password vs pin with the same secret", async () => {
    const a = await sha256Hex(lockHashInput("password", "1234"));
    const b = await sha256Hex(lockHashInput("pin", "1234"));
    expect(a).not.toBe(b);
  });

  it("verifies a matching secret and rejects a wrong one", async () => {
    const stored = await sha256Hex(lockHashInput("pin", "4821"));
    expect(await sha256Hex(lockHashInput("pin", "4821"))).toBe(stored);
    expect(await sha256Hex(lockHashInput("pin", "4822"))).not.toBe(stored);
  });
});

describe("needsUnlock", () => {
  const verified = new Set(["f1"]);
  it("skips unlocked files", () => {
    expect(needsUnlock({ password_hash: null, pin_hash: null }, verified, "f2")).toBe(false);
  });
  it("skips already-verified files in this session", () => {
    expect(needsUnlock({ password_hash: "x" }, verified, "f1")).toBe(false);
  });
  it("prompts for locked, unverified files", () => {
    expect(needsUnlock({ password_hash: "x" }, verified, "f2")).toBe(true);
    expect(needsUnlock({ pin_hash: "x" }, verified, "f2")).toBe(true);
  });
});
