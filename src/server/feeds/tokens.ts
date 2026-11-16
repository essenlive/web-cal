/**
 * Per-preset opaque feed token generation/lookup (data-model.md FeedToken,
 * research.md Decision E). A token is never the preset's own id — it's a
 * separate random identifier, so a working feed URL isn't leaked merely by
 * seeing an exported settings file or a preset name.
 */

import { randomBytes } from "node:crypto";
import type { SqliteDb } from "../config/db";

export interface FeedToken {
  presetId: string;
  token: string;
  createdAt: number;
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export function getTokenByPresetId(db: SqliteDb, presetId: string): FeedToken | null {
  const row = db.prepare("SELECT preset_id, token, created_at FROM feed_tokens WHERE preset_id = ?").get(presetId) as
    | { preset_id: string; token: string; created_at: number }
    | undefined;
  if (!row) return null;
  return { presetId: row.preset_id, token: row.token, createdAt: row.created_at };
}

export function getPresetIdByToken(db: SqliteDb, token: string): string | null {
  const row = db.prepare("SELECT preset_id FROM feed_tokens WHERE token = ?").get(token) as { preset_id: string } | undefined;
  return row?.preset_id ?? null;
}

function tokenExists(db: SqliteDb, token: string): boolean {
  return db.prepare("SELECT 1 FROM feed_tokens WHERE token = ?").get(token) !== undefined;
}

/** Returns the preset's existing token, or creates one (regenerating on the rare collision). */
export function ensureToken(db: SqliteDb, presetId: string): FeedToken {
  const existing = getTokenByPresetId(db, presetId);
  if (existing) return existing;

  let token = generateToken();
  while (tokenExists(db, token)) {
    token = generateToken();
  }
  const createdAt = Date.now();
  db.prepare("INSERT INTO feed_tokens (preset_id, token, created_at) VALUES (?, ?, ?)").run(presetId, token, createdAt);
  return { presetId, token, createdAt };
}

/** Removes tokens for presets no longer present in the current config (spec FR-008). */
export function pruneTokens(db: SqliteDb, livePresetIds: string[]): void {
  const live = new Set(livePresetIds);
  const rows = db.prepare("SELECT preset_id FROM feed_tokens").all() as Array<{ preset_id: string }>;
  for (const row of rows) {
    if (!live.has(row.preset_id)) {
      db.prepare("DELETE FROM feed_tokens WHERE preset_id = ?").run(row.preset_id);
    }
  }
}
