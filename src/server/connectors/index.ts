import type { SqliteDb } from "../config/db";
import { getEndpoints } from "../config/import";
import type { Connection } from "../../types";
import { createCaldavConnector } from "./caldav";
import { createIcsConnector } from "./ics";
import type { Connector } from "./types";

/** CalDAV endpoint attached to the connection if any, otherwise a read-only ICS connector on its URL. */
export function connectorFor(db: SqliteDb, conn: Connection): Connector | null {
  const endpoint = getEndpoints(db).find((e) => e.connectionId === conn.id);
  if (endpoint) return createCaldavConnector(endpoint);
  if (conn.type === "webcal") return createIcsConnector(conn.url, conn.name);
  return null;
}
