import { NextResponse } from "next/server";

/** Null when the request carries the admin bearer token, otherwise the error response to return. */
export function checkAdmin(request: Request): NextResponse | null {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return NextResponse.json({ error: "ADMIN_TOKEN is not configured on the server" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
