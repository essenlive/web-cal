/**
 * SQLite-backed read/write of the last-aggregated-events snapshot per source
 * connection (data-model.md SourceSnapshot). Written only by the aggregation
 * scheduler, once per connection per cycle; read by the feed-generation path,
 * which never triggers a fetch itself.
 */

import type { SqliteDb } from "../config/db";
import type { CalendarEvent } from "../../types";

export interface SourceSnapshot {
  connectionId: string;
  events: CalendarEvent[];
  lastSyncedAt: number | null;
  lastError: string | null;
}

export function getSnapshot(db: SqliteDb, connectionId: string): SourceSnapshot | null {
  const row = db
    .prepare("SELECT connection_id, events_json, last_synced_at, last_error FROM source_snapshots WHERE connection_id = ?")
    .get(connectionId) as { connection_id: string; events_json: string; last_synced_at: number | null; last_error: string | null } | undefined;
  if (!row) return null;
  return {
    connectionId: row.connection_id,
    events: JSON.parse(row.events_json) as CalendarEvent[],
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  };
}

export function getAllSnapshots(db: SqliteDb): SourceSnapshot[] {
  const rows = db
    .prepare("SELECT connection_id, events_json, last_synced_at, last_error FROM source_snapshots")
    .all() as Array<{ connection_id: string; events_json: string; last_synced_at: number | null; last_error: string | null }>;
  return rows.map((row) => ({
    connectionId: row.connection_id,
    events: JSON.parse(row.events_json) as CalendarEvent[],
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
  }));
}

/** Atomically replaces a connection's events + lastSyncedAt on a successful fetch. */
export function recordSuccess(db: SqliteDb, connectionId: string, events: CalendarEvent[], syncedAt: number): void {
  db.prepare(
    `INSERT INTO source_snapshots (connection_id, events_json, last_synced_at, last_error)
     VALUES (?, ?, ?, NULL)
     ON CONFLICT(connection_id) DO UPDATE SET events_json = excluded.events_json, last_synced_at = excluded.last_synced_at, last_error = NULL`
  ).run(connectionId, JSON.stringify(events), syncedAt);
}

/** Records a failed fetch attempt — leaves `events`/`lastSyncedAt` from the previous successful cycle untouched (spec FR-010). */
export function recordFailure(db: SqliteDb, connectionId: string, error: string): void {
  const existing = getSnapshot(db, connectionId);
  if (existing) {
    db.prepare("UPDATE source_snapshots SET last_error = ? WHERE connection_id = ?").run(error, connectionId);
  } else {
    db.prepare(
      "INSERT INTO source_snapshots (connection_id, events_json, last_synced_at, last_error) VALUES (?, ?, NULL, ?)"
    ).run(connectionId, JSON.stringify([]), error);
  }
}

/** Removes snapshots for connections no longer present in the current config (called after a re-import). */
export function pruneSnapshots(db: SqliteDb, liveConnectionIds: string[]): void {
  const all = getAllSnapshots(db);
  const live = new Set(liveConnectionIds);
  for (const snap of all) {
    if (!live.has(snap.connectionId)) {
      db.prepare("DELETE FROM source_snapshots WHERE connection_id = ?").run(snap.connectionId);
    }
  }
}
