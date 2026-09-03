/**
 * Pairing link generation/parsing for device-to-device sync. `roomId` and `key` live
 * only in the URL fragment (after #) — fragments are never sent in any HTTP request,
 * including to the PeerJS signaling broker, so neither ever reaches a third party.
 */

const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — read off a QR/screen by eye if needed

export function generateRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ROOM_ID_CHARS[b % ROOM_ID_CHARS.length]).join("");
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function importKey(base64url: string): Promise<CryptoKey> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export async function buildSyncLink(roomId: string, key: CryptoKey): Promise<string> {
  const keyParam = await exportKey(key);
  return `${window.location.origin}/data#room=${roomId}&key=${keyParam}`;
}

/** Parses `room`/`key` out of `hash` (e.g. `location.hash`, leading "#" optional). Returns null if either is missing. */
export function parseSyncHash(hash: string): { roomId: string; keyParam: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const roomId = params.get("room");
  const keyParam = params.get("key");
  if (!roomId || !keyParam) return null;
  return { roomId, keyParam };
}
