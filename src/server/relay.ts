/**
 * In-memory mailbox for device-to-device settings sync ("client only" mode). Two devices
 * share a random room id and an AES-GCM key that both live in the pairing link's fragment;
 * the server only ever stores the opaque encrypted envelope, for a few minutes, and a slot
 * is deleted as soon as it is read. Nothing is persisted: a restart drops pending rooms.
 */

export type RelaySlot = "init" | "join";

const TTL_MS = 5 * 60 * 1000;
const MAX_ROOMS = 200;
export const MAX_RELAY_BYTES = 2 * 1024 * 1024;
const ROOM_RE = /^[A-Z2-9]{8,32}$/;

interface Entry {
  data: Partial<Record<RelaySlot, string>>;
  expires: number;
}

const rooms = new Map<string, Entry>();

function prune(now: number) {
  for (const [id, e] of rooms) if (e.expires <= now) rooms.delete(id);
}

export const isValidRoom = (room: string) => ROOM_RE.test(room);
export const isValidSlot = (slot: string): slot is RelaySlot => slot === "init" || slot === "join";

/** Returns false when the mailbox is full (too many pending rooms). */
export function putSlot(room: string, slot: RelaySlot, body: string, now = Date.now()): boolean {
  prune(now);
  let entry = rooms.get(room);
  if (!entry) {
    if (rooms.size >= MAX_ROOMS) return false;
    entry = { data: {}, expires: now + TTL_MS };
    rooms.set(room, entry);
  }
  entry.data[slot] = body;
  return true;
}

/** One-shot read: returns the stored envelope and removes it (the room goes once both slots are consumed). */
export function takeSlot(room: string, slot: RelaySlot, now = Date.now()): string | null {
  prune(now);
  const entry = rooms.get(room);
  const body = entry?.data[slot] ?? null;
  if (entry && body !== null) {
    delete entry.data[slot];
    if (!entry.data.init && !entry.data.join) rooms.delete(room);
  }
  return body;
}

export function resetRelay() {
  rooms.clear();
}
