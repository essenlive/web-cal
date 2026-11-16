import { NextResponse } from "next/server";
import { checkAuth } from "../../../../server/auth";
import { getDb } from "../../../../server/config/db";
import { createPairingCode } from "../../../../server/auth/sessions";

export const dynamic = "force-dynamic";

/** Creates a single-use pairing code (valid 5 minutes) for another device — shown as a QR code. */
export async function POST(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;
  return NextResponse.json(createPairingCode(getDb()));
}
