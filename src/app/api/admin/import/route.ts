import { NextResponse } from "next/server";
import { getDb } from "../../../../server/config/db";
import { importConfig, isImportableConfig } from "../../../../server/config/import";

export async function POST(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json({ error: "ADMIN_TOKEN is not configured on the server" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
