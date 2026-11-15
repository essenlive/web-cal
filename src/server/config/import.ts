/**
 * Loads a settings-export JSON (the same `SettingsBundle` shape the client's
 * own export/import/P2P-sync already produces — see src/lib/sync/bundle.ts)
 * into the server's SQLite store: replaces the whole configuration
 * (connections/eventTypes/rules/presets) wholesale, and ensures every preset
 * has a FeedToken while removing tokens/snapshots for anything no longer
 * present (data-model.md "Imported configuration").
 */

import type { SqliteDb } from "./db";
import { ensureToken, pruneTokens } from "../feeds/tokens";
import { pruneSnapshots } from "../aggregation/snapshot-store";
import type { Connection, EventType, Preset, Rule } from "../../types";

export const BUNDLE_VERSION = 1;

/** Subset of src/lib/sync/bundle.ts's SettingsBundle this server actually consumes. */
export interface ImportableConfig {
  v: typeof BUNDLE_VERSION;
  connections: Connection[];
  eventTypes: EventType[];
  rules: Rule[];
  presets: Preset[];
}

/**
 * Loose shape check — mirrors src/lib/sync/bundle.ts's isSettingsBundle (themes/ui
 * ignored here). Deliberately not imported directly: bundle.ts pulls in the Zustand
 * stores at module load time (same client-only coupling research.md Decision A
 * identified for EventChip.tsx), so this server module re-checks only the fields it
 * actually consumes instead.
 */
export function isImportableConfig(value: unknown): value is ImportableConfig {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    b.v === BUNDLE_VERSION &&
    Array.isArray(b.connections) &&
    Array.isArray(b.eventTypes) &&
    Array.isArray(b.rules) &&
    Array.isArray(b.presets)
  );
}

export interface ImportResult {
  importedPresets: number;
  importedConnections: number;
  feedUrls: Array<{ presetId: string; presetName: string; url: string }>;
}

export function getConfig(db: SqliteDb, key: "connections" | "eventTypes" | "rules" | "presets"): unknown[] {
  const row = db.prepare("SELECT json FROM config WHERE key = ?").get(key) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as unknown[]) : [];
}

export function importConfig(db: SqliteDb, config: ImportableConfig): ImportResult {
  const setConfig = db.transaction((cfg: ImportableConfig) => {
    const upsert = db.prepare("INSERT INTO config (key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json");
    upsert.run("connections", JSON.stringify(cfg.connections));
    upsert.run("eventTypes", JSON.stringify(cfg.eventTypes));
    upsert.run("rules", JSON.stringify(cfg.rules));
    upsert.run("presets", JSON.stringify(cfg.presets));
  });
  setConfig(config);

  pruneTokens(db, config.presets.map((p) => p.id));
  pruneSnapshots(db, config.connections.map((c) => c.id));

  const feedUrls = config.presets.map((preset) => {
    const { token } = ensureToken(db, preset.id);
    return { presetId: preset.id, presetName: preset.name, url: `/api/feed/${token}` };
  });

  return {
    importedPresets: config.presets.length,
    importedConnections: config.connections.length,
    feedUrls,
  };
}
