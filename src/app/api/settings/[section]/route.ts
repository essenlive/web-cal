import { NextResponse } from "next/server";
import { getDb } from "../../../../server/config/db";
import { checkAuth } from "../../../../server/auth";
import { isSection, isValidSection, putSection } from "../../../../server/config/settings";

export const dynamic = "force-dynamic";

/**
 * Writes one settings section. Body: { baseRev, value } where baseRev is the revision the client
 * last read. 200 { rev } on success, 409 { rev, value } when the section changed since — the
 * client then adopts `value` and re-applies its edit.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ section: string }> }) {
  const denied = checkAuth(request);
  if (denied) return denied;
  const { section } = await params;
  if (!isSection(section)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  let body: { baseRev?: unknown; value?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (!Number.isInteger(body.baseRev) || !isValidSection(section, body.value)) {
    return NextResponse.json({ error: "Expected { baseRev: integer, value }" }, { status: 400 });
  }
  const result = putSection(getDb(), section, body.baseRev as number, body.value);
  if (!result.ok) return NextResponse.json({ rev: result.rev, value: result.value }, { status: 409 });
  return NextResponse.json({ rev: result.rev });
}
