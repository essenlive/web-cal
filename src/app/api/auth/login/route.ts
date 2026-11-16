import { NextResponse } from "next/server";
import { sessionCookie } from "../../../../server/auth";
import { getDb } from "../../../../server/config/db";
import { checkPassphrase, isPassphraseSet } from "../../../../server/auth/passphrase";
import { createSession } from "../../../../server/auth/sessions";
import { clearFailures, clientKey, isLockedOut, recordFailure } from "../../../../server/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Passphrase login: opens a device session that never expires (until revoked). */
export async function POST(request: Request) {
  if (!process.env.ADMIN_TOKEN) return NextResponse.json({ error: "Server mode is off" }, { status: 503 });
  const key = clientKey(request);
  if (isLockedOut(key)) return NextResponse.json({ error: "Trop d’essais, réessaie dans quelques minutes" }, { status: 429 });

  const db = getDb();
  const body = (await request.json().catch(() => null)) as { passphrase?: unknown; deviceName?: unknown } | null;
  const passphrase = typeof body?.passphrase === "string" ? body.passphrase : "";
  if (!isPassphraseSet(db) || !checkPassphrase(db, passphrase)) {
    recordFailure(key);
    return NextResponse.json({ error: "Passphrase incorrecte" }, { status: 401 });
  }
  clearFailures(key);
  const { token, session } = createSession(db, typeof body?.deviceName === "string" ? body.deviceName : "");
  const res = NextResponse.json({ ok: true, session });
  res.headers.append("Set-Cookie", sessionCookie(request, token));
  return res;
}
