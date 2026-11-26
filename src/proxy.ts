import { NextResponse, type NextRequest } from "next/server";

/**
 * Opt-in CORS for the JSON API, so a client served from another origin (a static host, another
 * Overcal) can use this server. Off unless CORS_ORIGINS lists origins (comma-separated, or "*").
 * Authentication is by `Authorization: Bearer` only — cookies are never sent cross-origin because
 * the client doesn't ask for credentials — so allowing an origin grants no ambient access.
 */
function allowedOrigin(request: NextRequest): string | null {
  const configured = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  if (configured.length === 0) return null;
  if (configured.includes("*")) return "*";
  const origin = request.headers.get("origin");
  return origin && configured.includes(origin) ? origin : null;
}

export function proxy(request: NextRequest) {
  const origin = allowedOrigin(request);
  if (!origin) return NextResponse.next();

  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

export const config = { matcher: "/api/:path*" };
