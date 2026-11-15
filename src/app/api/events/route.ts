import { NextResponse } from "next/server";
import { getDb } from "../../../server/config/db";
import { getConfig } from "../../../server/config/import";
import { connectorFor } from "../../../server/connectors";
import { refreshConnection } from "../../../server/aggregation/scheduler";
import type { Connection } from "../../../types";

export const dynamic = "force-dynamic";

/** Creates an event on a connection's endpoint. Body: { connectionId, calendarId?, event }. */
export async function POST(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return NextResponse.json({ error: "ADMIN_TOKEN is not configured on the server" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
