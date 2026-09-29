import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin fetch relay for WebCal (.ics) sources that don't send CORS
 * headers. Only reachable targets are public http(s) hosts — anything that
 * looks like it points back into this server's own network is rejected so
 * the route can't be used to probe internal infrastructure or the cloud
 * metadata endpoint.
 *
 * ponytail: hostname-string matching, not a resolved-IP check — a DNS name
 * that resolves to a private IP at request time would slip through. Add a
 * resolve-then-check step if that ever becomes a real threat here.
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "::1" || h === "0.0.0.0") return true;

  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1, 3).map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  }

  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true; // IPv6 link-local/ULA

  return false;
}

function validateTarget(raw: string | null): URL {
  if (!raw) throw new Error("Missing url");
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw new Error("Invalid url");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }
  if (isBlockedHost(target.hostname)) {
    throw new Error("Target host not allowed");
  }
  return target;
}

/** Plain GET passthrough — used for WebCal .ics subscriptions. */
export async function GET(req: NextRequest) {
  let target: URL;
  try {
    target = validateTarget(req.nextUrl.searchParams.get("url"));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const upstream = await fetch(target);
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: relayHeaders(upstream, "text/plain"),
  });
}

/** Content-Type plus Retry-After (429/503 backoff hint) from the upstream response, when present. */
function relayHeaders(upstream: Response, defaultContentType: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") ?? defaultContentType,
  };
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers["Retry-After"] = retryAfter;
  return headers;
}
