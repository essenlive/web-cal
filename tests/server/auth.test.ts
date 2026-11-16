import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "../../src/server/config/db";
import { checkPassphrase, hashPassphrase, isPassphraseSet, setPassphrase, verifyPassphraseHash } from "../../src/server/auth/passphrase";
import { createPairingCode, createSession, findSession, listSessions, PAIRING_TTL_MS, redeemPairingCode, revokeSession } from "../../src/server/auth/sessions";
import { clearFailures, isLockedOut, recordFailure } from "../../src/server/auth/rate-limit";

describe("passphrase", () => {
  it("hashes with a salt and verifies", () => {
    const a = hashPassphrase("correct horse battery");
    expect(a).not.toContain("correct horse");
    expect(a).not.toBe(hashPassphrase("correct horse battery"));
    expect(verifyPassphraseHash("correct horse battery", a)).toBe(true);
    expect(verifyPassphraseHash("wrong passphrase!", a)).toBe(false);
    expect(verifyPassphraseHash("x", "garbage")).toBe(false);
  });

  it("is stored once and can be reset", () => {
    const db = openDb(":memory:");
    expect(isPassphraseSet(db)).toBe(false);
    expect(checkPassphrase(db, "whatever pass")).toBe(false);
    setPassphrase(db, "first passphrase");
    expect(isPassphraseSet(db)).toBe(true);
    expect(checkPassphrase(db, "first passphrase")).toBe(true);
    setPassphrase(db, "second passphrase");
    expect(checkPassphrase(db, "first passphrase")).toBe(false);
    expect(checkPassphrase(db, "second passphrase")).toBe(true);
  });
});

describe("sessions", () => {
  it("never expire, are per device and revocable", () => {
    const db = openDb(":memory:");
    const a = createSession(db, "Mac · Firefox", 1_000);
    const b = createSession(db, "", 2_000);
    expect(b.session.deviceName).toBe("Appareil");
    // Far in the future (years later) the session is still valid.
    expect(findSession(db, a.token, 1_000 + 5 * 365 * 86_400_000)?.id).toBe(a.session.id);
    expect(findSession(db, "nope")).toBeNull();
    expect(listSessions(db).map((s) => s.deviceName)).toEqual(["Mac · Firefox", "Appareil"]);
    expect(revokeSession(db, a.session.id)).toBe(true);
    expect(findSession(db, a.token)).toBeNull();
    expect(findSession(db, b.token)?.id).toBe(b.session.id);
    expect(revokeSession(db, a.session.id)).toBe(false);
  });

  it("stores only a hash of the token", () => {
    const db = openDb(":memory:");
    const { token } = createSession(db, "d");
    const rows = db.prepare("SELECT token_hash FROM sessions").all() as Array<{ token_hash: string }>;
    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toHaveLength(64);
  });
});

describe("pairing codes", () => {
  let db: ReturnType<typeof openDb>;
  beforeEach(() => {
    db = openDb(":memory:");
  });

  it("are single-use", () => {
    const { code } = createPairingCode(db, 0);
    expect(redeemPairingCode(db, code, 1_000)).toBe(true);
    expect(redeemPairingCode(db, code, 1_000)).toBe(false);
  });

  it("expire after 5 minutes", () => {
    const { code, expiresAt } = createPairingCode(db, 0);
    expect(expiresAt).toBe(PAIRING_TTL_MS);
    expect(redeemPairingCode(db, code, PAIRING_TTL_MS + 1)).toBe(false);
    // …and an expired code is consumed too.
    expect(redeemPairingCode(db, code, 1)).toBe(false);
  });

  it("rejects unknown codes", () => {
    expect(redeemPairingCode(db, "unknown")).toBe(false);
  });
});

describe("login rate limit", () => {
  it("locks out after 5 failures in the window and resets on success", () => {
    const key = "1.2.3.4";
    for (let i = 0; i < 5; i++) recordFailure(key, 1_000 + i);
    expect(isLockedOut(key, 2_000)).toBe(true);
    expect(isLockedOut(key, 1_000 + 11 * 60_000)).toBe(false);
    recordFailure(key, 3_000);
    clearFailures(key);
    expect(isLockedOut(key, 3_001)).toBe(false);
  });
});
