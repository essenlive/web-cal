import { NextResponse } from "next/server";
import { getDb } from "../../../server/config/db";
import { getConfig } from "../../../server/config/import";
import { checkAuth } from "../../../server/auth";

export const dynamic = "force-dynamic";

/** The server's configuration (connections, types, rules, presets) so a client can pull it. Endpoint credentials are never included. */
export async function GET(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;
  const db = getDb();
  return NextResponse.json({
    v: 1,
    connections: getConfig(db, "connections"),
    eventTypes: getConfig(db, "eventTypes"),
    rules: getConfig(db, "rules"),
    presets: getConfig(db, "presets"),
  });
}
