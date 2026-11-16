import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { SqliteDb } from "../config/db";

export const MIN_PASSPHRASE_LENGTH = 10;

const KEY_LENGTH = 32;

/** "scrypt$<salt hex>$<hash hex>" — salted, slow to brute-force; the passphrase itself is never stored. */
export function hashPassphrase(passphrase: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(passphrase, salt, KEY_LENGTH).toString("hex")}`;
}

export function verifyPassphraseHash(passphrase: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(passphrase, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function isPassphraseSet(db: SqliteDb): boolean {
  return Boolean(db.prepare("SELECT 1 FROM auth WHERE key = 'passphrase'").get());
}

export function setPassphrase(db: SqliteDb, passphrase: string): void {
  db.prepare("INSERT INTO auth (key, value) VALUES ('passphrase', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(hashPassphrase(passphrase));
}

export function checkPassphrase(db: SqliteDb, passphrase: string): boolean {
  const row = db.prepare("SELECT value FROM auth WHERE key = 'passphrase'").get() as { value: string } | undefined;
  return row ? verifyPassphraseHash(passphrase, row.value) : false;
}
