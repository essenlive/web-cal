import { NextResponse } from "next/server";
import { getDb } from "../../../server/config/db";
import { getConfig } from "../../../server/config/import";
import { connectorFor } from "../../../server/connectors";
import { refreshConnection } from "../../../server/aggregation/scheduler";
import { checkAuth } from "../../../server/auth";
import { listServerEvents } from "../../../server/events/query";
import { ConnectorError, type EventPatch } from "../../../server/connectors/types";
import type { Connection } from "../../../types";

export const dynamic = "force-dynamic";

/** Snapshot events per connection for ?from=&to= (ISO), optionally limited to ?connectionId=. */
export async function GET(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const start = new Date(params.get("from") ?? "");
  const end = new Date(params.get("to") ?? "");
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Expected ?from=<ISO date>&to=<ISO date>" }, { status: 400 });
  }
  const connections = listServerEvents(getDb(), { start, end }, params.get("connectionId") ?? undefined);
  return NextResponse.json({ connections });
}

/** Creates an event on a connection's endpoint. Body: { connectionId, calendarId?, event }. */
export async function POST(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;

  let body: { connectionId?: unknown; calendarId?: unknown; event?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const e = body.event;
  if (typeof body.connectionId !== "string" || !e || typeof e.title !== "string" || typeof e.start !== "string" || typeof e.end !== "string") {
    return NextResponse.json({ error: "Expected { connectionId, event: { title, start, end, allDay? } }" }, { status: 400 });
  }

  const db = getDb();
  const conn = (getConfig(db, "connections") as Connection[]).find((c) => c.id === body.connectionId);
  if (!conn) return NextResponse.json({ error: "Unknown connection" }, { status: 404 });
  const connector = connectorFor(db, conn);
  if (!connector?.createEvent) return NextResponse.json({ error: "This connection is read-only" }, { status: 405 });

  try {
    const uid = await connector.createEvent(
      { title: e.title, start: e.start, end: e.end, allDay: e.allDay === true, location: e.location as string | undefined, notes: e.notes as string | undefined },
      typeof body.calendarId === "string" ? body.calendarId : undefined,
    );
    await refreshConnection(db, conn);
    return NextResponse.json({ uid }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

/** The uid a connection's connector knows an event by (client ids are "<connection>::<uid>"). */
function uidOf(connectionId: string, id: string): string {
  const prefix = `${connectionId}::`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

function failure(err: unknown) {
  const status = err instanceof ConnectorError ? err.status : 502;
  return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status });
}

async function writableConnector(request: Request, connectionId: unknown, op: "updateEvent" | "deleteEvent") {
  if (typeof connectionId !== "string") return { error: NextResponse.json({ error: "Expected { connectionId, id, ... }" }, { status: 400 }) };
  const db = getDb();
  const conn = (getConfig(db, "connections") as Connection[]).find((c) => c.id === connectionId);
  if (!conn) return { error: NextResponse.json({ error: "Unknown connection" }, { status: 404 }) };
  const connector = connectorFor(db, conn);
  if (!connector?.[op]) return { error: NextResponse.json({ error: "This connection is read-only" }, { status: 405 }) };
  return { db, conn, connector };
}

/** Edits an event. Body: { connectionId, id, etag?, patch }. 412 when the event changed since `etag`; recurring events answer 422. */
export async function PATCH(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { connectionId?: unknown; id?: unknown; etag?: unknown; patch?: EventPatch } | null;
  if (!body || typeof body.id !== "string" || !body.patch || typeof body.patch !== "object") {
    return NextResponse.json({ error: "Expected { connectionId, id, etag?, patch }" }, { status: 400 });
  }
  const target = await writableConnector(request, body.connectionId, "updateEvent");
  if ("error" in target) return target.error;
  try {
    await target.connector.updateEvent!(uidOf(target.conn.id, body.id), body.patch, typeof body.etag === "string" ? body.etag : undefined);
    await refreshConnection(target.db, target.conn);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failure(err);
  }
}

/** Deletes an event. Body: { connectionId, id, etag? }. */
export async function DELETE(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { connectionId?: unknown; id?: unknown; etag?: unknown } | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Expected { connectionId, id, etag? }" }, { status: 400 });
  const target = await writableConnector(request, body.connectionId, "deleteEvent");
  if ("error" in target) return target.error;
  try {
    await target.connector.deleteEvent!(uidOf(target.conn.id, body.id), typeof body.etag === "string" ? body.etag : undefined);
    await refreshConnection(target.db, target.conn);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failure(err);
  }
}
