import { NextResponse } from "next/server";
import { getDb } from "../../../../server/config/db";
import { isPassphraseSet } from "../../../../server/auth/passphrase";
import { currentSession } from "../../../../server/auth";

export const dynamic = "force-dynamic";

/**
 * Public. Tells the client whether this deployment runs in server mode (ADMIN_TOKEN set),
 * whether a passphrase was defined yet, and whether this browser holds a valid device session.
 */
export async function GET(request: Request) {
  const enabled = Boolean(process.env.ADMIN_TOKEN);
  if (!enabled) return NextResponse.json({ enabled, passphraseSet: false, authenticated: false });
  const db = getDb();
  const session = currentSession(request);
  return NextResponse.json({
    enabled,
    passphraseSet: isPassphraseSet(db),
    authenticated: session !== null,
    deviceName: session?.deviceName ?? null,
  });
}
