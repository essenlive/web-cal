/**
 * SQLite-backed storage for the server's imported configuration, feed tokens,
 * and per-source aggregation snapshots. One file, synchronous API
 * (better-sqlite3) — see research.md Decision C.
 */

import Database from "better-sqlite3";
import path from "node:path";

export type SqliteDb = ReturnType<typeof openDb>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_tokens (
  preset_id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  connection_id TEXT PRIMARY KEY,
  events_json TEXT NOT NULL,
  last_synced_at INTEGER,
  last_error TEXT
);
`;

export function openDb(filePath: string) {
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

let singleton: ReturnType<typeof openDb> | undefined;

/** The server's default database file, resolved relative to the repo root. */
export function defaultDbPath(): string {
  return process.env.WEBCAL_SERVER_DB_PATH ?? path.join(process.cwd(), "webcal-server.sqlite");
}

/** Lazily-opened shared connection to the default database file. */
export function getDb(): ReturnType<typeof openDb> {
  if (!singleton) {
    singleton = openDb(defaultDbPath());
  }
  return singleton;
}

/** Test/diagnostic helper — forces the next getDb() call to open a fresh connection. */
export function resetDbSingleton(): void {
  singleton?.close();
  singleton = undefined;
}
