import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SqliteDb } from "../config/db";

export const SESSION_COOKIE = "overcal_session";
/** A pairing code (QR) is single-use and short-lived. */
export const PAIRING_TTL_MS = 5 * 60_000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export interface DeviceSession {
  id: string;
  deviceName: string;
  createdAt: number;
  lastUsedAt: number;
}

/** Sessions never expire: they last until revoked. Only a hash of the token is stored. */
export function createSession(db: SqliteDb, deviceName: string, now = Date.now()): { token: string; session: DeviceSession } {
  const token = randomBytes(32).toString("base64url");
  const session: DeviceSession = { id: randomUUID(), deviceName: deviceName.trim().slice(0, 60) || "Appareil", createdAt: now, lastUsedAt: now };
  db.prepare("INSERT INTO sessions (id, token_hash, device_name, created_at, last_used_at) VALUES (?, ?, ?, ?, ?)").run(session.id, sha256(token), session.deviceName, now, now);
  return { token, session };
}

export function findSession(db: SqliteDb, token: string, now = Date.now()): DeviceSession | null {
  const row = db.prepare("SELECT id, device_name, created_at, last_used_at FROM sessions WHERE token_hash = ?").get(sha256(token)) as
    | { id: string; device_name: string; created_at: number; last_used_at: number }
    | undefined;
  if (!row) return null;
  // Touch at most once a minute so a burst of requests doesn't write on each one.
  if (now - row.last_used_at > 60_000) db.prepare("UPDATE sessions SET last_used_at = ? WHERE id = ?").run(now, row.id);
  return { id: row.id, deviceName: row.device_name, createdAt: row.created_at, lastUsedAt: now - row.last_used_at > 60_000 ? now : row.last_used_at };
}

export function listSessions(db: SqliteDb): DeviceSession[] {
  return (db.prepare("SELECT id, device_name, created_at, last_used_at FROM sessions ORDER BY created_at").all() as Array<{ id: string; device_name: string; created_at: number; last_used_at: number }>).map((r) => ({
    id: r.id,
    deviceName: r.device_name,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));
}

export function revokeSession(db: SqliteDb, id: string): boolean {
  return db.prepare("DELETE FROM sessions WHERE id = ?").run(id).changes > 0;
}

/** A one-time code to pair another device (shown as a QR code). Returns the plain code once. */
export function createPairingCode(db: SqliteDb, now = Date.now()): { code: string; expiresAt: number } {
  db.prepare("DELETE FROM pairing_codes WHERE expires_at < ?").run(now);
  const code = randomBytes(24).toString("base64url");
  const expiresAt = now + PAIRING_TTL_MS;
  db.prepare("INSERT INTO pairing_codes (code_hash, expires_at) VALUES (?, ?)").run(sha256(code), expiresAt);
  return { code, expiresAt };
}

/** Consumes the code (single use). False if unknown, already used or expired. */
export function redeemPairingCode(db: SqliteDb, code: string, now = Date.now()): boolean {
  const row = db.prepare("SELECT expires_at FROM pairing_codes WHERE code_hash = ?").get(sha256(code)) as { expires_at: number } | undefined;
  if (!row) return false;
  db.prepare("DELETE FROM pairing_codes WHERE code_hash = ?").run(sha256(code));
  return row.expires_at >= now;
}
