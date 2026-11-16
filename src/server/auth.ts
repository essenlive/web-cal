import { NextResponse } from "next/server";
import { getDb } from "./config/db";
import { findSession, SESSION_COOKIE, type DeviceSession } from "./auth/sessions";

function hasAdminToken(request: Request): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  return Boolean(adminToken) && request.headers.get("authorization") === `Bearer ${adminToken}`;
}

export function sessionTokenOf(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

/** The device session carried by the request's cookie, if it is still valid. */
export function currentSession(request: Request): DeviceSession | null {
  const token = sessionTokenOf(request);
  return token ? findSession(getDb(), token) : null;
}

/** True when the request carries the admin bearer token or a valid device-session cookie. */
export function isAuthenticated(request: Request): boolean {
  return hasAdminToken(request) || currentSession(request) !== null;
}

/** Null when the request is authenticated (admin token or device session), otherwise the error response to return. */
export function checkAuth(request: Request): NextResponse | null {
  if (!process.env.ADMIN_TOKEN) return NextResponse.json({ error: "ADMIN_TOKEN is not configured on the server" }, { status: 503 });
  if (isAuthenticated(request)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Null when the request carries the admin bearer token (bootstrap and scripts only — a device session is not enough). */
export function checkAdmin(request: Request): NextResponse | null {
  if (!process.env.ADMIN_TOKEN) return NextResponse.json({ error: "ADMIN_TOKEN is not configured on the server" }, { status: 503 });
  if (hasAdminToken(request)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Set-Cookie value for a device session: HttpOnly, no expiry on the server, ~400 days in the browser. */
export function sessionCookie(request: Request, token: string): string {
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=34560000${secure ? "; Secure" : ""}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
