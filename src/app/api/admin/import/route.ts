import { NextResponse } from "next/server";
import { getDb } from "../../../../server/config/db";
import { importConfig, isImportableConfig } from "../../../../server/config/import";
import { checkAuth } from "../../../../server/auth";

export async function POST(request: Request) {
  const denied = checkAuth(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!isImportableConfig(body)) {
    return NextResponse.json(
      { error: "Request body does not match the expected settings-export shape" },
      { status: 400 }
    );
  }

  const db = getDb();
  const result = importConfig(db, body);
  return NextResponse.json(result, { status: 200 });
}
