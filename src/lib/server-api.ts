/**
 * Auth headers for calls to the Overcal server. A paired device relies on its httpOnly
 * session cookie (sent automatically, same origin); the admin token is only added when set.
 */
export function serverHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

/** Normalizes what a person typed into a server base URL ("" if empty). Null when it isn't an http(s) address. */
export function normalizeServerUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export interface ServerStatus {
  enabled: boolean;
  passphraseSet: boolean;
  authenticated: boolean;
  deviceName?: string | null;
}

export async function fetchServerStatus(base = "", token = ""): Promise<ServerStatus | null> {
  try {
    const res = await fetch(`${base}/api/server/status`, { cache: "no-store", headers: serverHeaders(token) });
    if (!res.ok) return null;
    return (await res.json()) as ServerStatus;
  } catch {
    return null;
  }
}

export function defaultDeviceName(): string {
  if (typeof navigator === "undefined") return "Appareil";
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Appareil";
  const browser = /Firefox/.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "";
  return browser ? `${browser} · ${os}` : os;
}
