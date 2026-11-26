import { NextResponse } from "next/server";
import { sessionCookie } from "../../../../server/auth";
import { getDb } from "../../../../server/config/db";
import { createSession, redeemPairingCode } from "../../../../server/auth/sessions";
import { clientKey, isLockedOut, recordFailure } from "../../../../server/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Exchanges a pairing code (from the QR code) for a device session on the scanning device. */
export async function POST(request: Request) {
  if (!process.env.ADMIN_TOKEN) return NextResponse.json({ error: "Server mode is off" }, { status: 503 });
  const key = clientKey(request);
  if (isLockedOut(key)) return NextResponse.json({ error: "Trop d’essais, réessaie dans quelques minutes" }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { code?: unknown; deviceName?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  const db = getDb();
  if (!code || !redeemPairingCode(db, code)) {
    recordFailure(key);
    return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 401 });
  }
  const { token, session } = createSession(db, typeof body?.deviceName === "string" ? body.deviceName : "");
  const res = NextResponse.json({ ok: true, session, token });
  res.headers.append("Set-Cookie", sessionCookie(request, token));
  return res;
}
