import { NextResponse } from "next/server";
import { getDb } from "../../../server/config/db";
import { getSettings } from "../../../server/config/settings";
import { checkAuth } from "../../../server/auth";

export const dynamic = "force-dynamic";

/** The server's settings with one revision per section (see server/config/settings.ts). Endpoint credentials are never included. */
export async function GET(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;
  return NextResponse.json(getSettings(getDb()));
}
