import { NextResponse } from "next/server";
import { checkAuth, currentSession } from "../../../../server/auth";
import { getDb } from "../../../../server/config/db";
import { listSessions, revokeSession } from "../../../../server/auth/sessions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;
  return NextResponse.json({ sessions: listSessions(getDb()), currentId: currentSession(request)?.id ?? null });
}

/** Revokes one device session: DELETE /api/auth/sessions?id=… */
export async function DELETE(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !revokeSession(getDb(), id)) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
