import { NextResponse } from "next/server";
import { clearedSessionCookie, currentSession } from "../../../../server/auth";
import { getDb } from "../../../../server/config/db";
import { revokeSession } from "../../../../server/auth/sessions";

export const dynamic = "force-dynamic";

/** Ends this device's session (revokes it server-side and clears the cookie). */
export async function POST(request: Request) {
  const session = currentSession(request);
  if (session) revokeSession(getDb(), session.id);
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearedSessionCookie());
  return res;
}
