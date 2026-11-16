import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public, reveals nothing but whether this deployment runs in server mode (ADMIN_TOKEN set). */
export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.ADMIN_TOKEN) });
}
