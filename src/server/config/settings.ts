/**
 * Versioned settings: the server is the single source of truth. Every section has an integer
 * revision; a client writes a section with the revision it last saw (`baseRev`) and gets a conflict
 * (with the current value) when someone else wrote in between, instead of silently overwriting it.
 */

import type { SqliteDb } from "./db";
import { getConfig, getConfigValue } from "./import";
import { ensureToken, pruneTokens } from "../feeds/tokens";
import { pruneSnapshots } from "../aggregation/snapshot-store";
import type { Connection, Preset } from "../../types";

export const SECTIONS = ["connections", "eventTypes", "rules", "presets", "themes", "ui"] as const;
export type Section = (typeof SECTIONS)[number];

const ARRAY_SECTIONS: readonly Section[] = ["connections", "eventTypes", "rules", "presets"];
export const isSection = (value: string): value is Section => (SECTIONS as readonly string[]).includes(value);

export type Revs = Record<Section, number>;

export function getRevs(db: SqliteDb): Revs {
  const rows = db.prepare("SELECT key, rev FROM config_rev").all() as Array<{ key: string; rev: number }>;
  const revs = Object.fromEntries(SECTIONS.map((s) => [s, 0])) as Revs;
  for (const r of rows) if (isSection(r.key)) revs[r.key] = r.rev;
  return revs;
}

export function readSection(db: SqliteDb, section: Section): unknown {
  return section === "themes" || section === "ui" ? getConfigValue(db, section) : getConfig(db, section);
}

/** Whole settings document: what a client pulls on load. Endpoint credentials never leave the server. */
export function getSettings(db: SqliteDb) {
  const revs = getRevs(db);
  return {
    v: 2 as const,
    revs,
    connections: readSection(db, "connections"),
    eventTypes: readSection(db, "eventTypes"),
    rules: readSection(db, "rules"),
    presets: readSection(db, "presets"),
    themes: readSection(db, "themes"),
    ui: readSection(db, "ui"),
  };
}

export function isValidSection(section: Section, value: unknown): boolean {
  if (ARRAY_SECTIONS.includes(section)) return Array.isArray(value);
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export type PutResult = { ok: true; rev: number } | { ok: false; rev: number; value: unknown };

export function putSection(db: SqliteDb, section: Section, baseRev: number, value: unknown): PutResult {
  const write = db.transaction((): PutResult => {
    const current = getRevs(db)[section];
    if (current !== baseRev) return { ok: false, rev: current, value: readSection(db, section) };

    let next = value;
    if (section === "connections") {
      // A client only knows `serverOnly` sources by id: keep the server's own definition, drop the unknown ones.
      const existing = new Map((getConfig(db, "connections") as Connection[]).map((c) => [c.id, c]));
      next = (value as Connection[]).flatMap((c) => {
        if (!(c as { serverOnly?: boolean }).serverOnly) return [c];
        const known = existing.get(c.id);
        return known ? [known] : [];
      });
    }
    db.prepare("INSERT INTO config (key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json").run(section, JSON.stringify(next));
    db.prepare("INSERT INTO config_rev (key, rev) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET rev = rev + 1").run(section);
    return { ok: true, rev: current + 1 };
  });
  const result = write();

  if (result.ok && section === "connections") {
    pruneSnapshots(db, (getConfig(db, "connections") as Connection[]).map((c) => c.id));
  }
  if (result.ok && section === "presets") {
    const presets = getConfig(db, "presets") as Preset[];
    pruneTokens(db, presets.map((p) => p.id));
    for (const p of presets) ensureToken(db, p.id);
  }
  return result;
}
