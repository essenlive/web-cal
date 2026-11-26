import { NextResponse } from "next/server";
import { checkAdmin, sessionCookie } from "../../../../server/auth";
import { getDb } from "../../../../server/config/db";
import { MIN_PASSPHRASE_LENGTH, setPassphrase } from "../../../../server/auth/passphrase";
import { createSession } from "../../../../server/auth/sessions";

export const dynamic = "force-dynamic";

/** Defines (or resets) the passphrase. Requires the admin token; also opens a session for this device. */
export async function POST(request: Request) {
  const denied = checkAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { passphrase?: unknown; deviceName?: unknown } | null;
  const passphrase = typeof body?.passphrase === "string" ? body.passphrase : "";
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return NextResponse.json({ error: `La passphrase doit faire au moins ${MIN_PASSPHRASE_LENGTH} caractères` }, { status: 400 });
  }
  const db = getDb();
  setPassphrase(db, passphrase);
  const { token, session } = createSession(db, typeof body?.deviceName === "string" ? body.deviceName : "");
  const res = NextResponse.json({ ok: true, session, token });
  res.headers.append("Set-Cookie", sessionCookie(request, token));
  return res;
}
