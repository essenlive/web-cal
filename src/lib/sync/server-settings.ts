/**
 * Client side of the server-as-source-of-truth settings: when this browser is linked to an
 * Overcal server, the server's settings (see src/server/config/settings.ts) win. On start the
 * client pulls them into its stores; afterwards every local edit is pushed per section with the
 * revision it last saw, and a conflict (409) means "adopt the server's value".
 *
 * Local stores stay as an offline cache. Revisions + a hash of the last synced value live in
 * localStorage so an edit made offline is pushed on the next load instead of being overwritten.
 */

import { useConnectionStore, useEventTypeStore, useRuleStore, usePresetStore, useThemeStore, useUIStore } from "../../store";
import { serverHeaders } from "../server-api";

export const SECTIONS = ["connections", "eventTypes", "rules", "presets", "themes", "ui"] as const;
export type Section = (typeof SECTIONS)[number];

const META_KEY = "overcal:server-settings-meta";
type Meta = Partial<Record<Section, { rev: number; hash: string }>>;

function readMeta(): Meta {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "{}") as Meta;
  } catch {
    return {};
  }
}
function writeMeta(meta: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable: the next load falls back to "server wins" */
  }
}

export function hashOf(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}:${h}`;
}

/** The part of each store that travels, same subset as the export bundle (bundle.ts). */
export function readLocal(section: Section): unknown {
  switch (section) {
    case "connections": return useConnectionStore.getState().connections;
    case "eventTypes": return useEventTypeStore.getState().types;
    case "rules": return useRuleStore.getState().rules;
    case "presets": return usePresetStore.getState().presets;
    case "themes": {
      const t = useThemeStore.getState();
      return { customThemes: t.customThemes, selectedThemeId: t.selectedThemeId, themeOrder: t.themeOrder };
    }
    case "ui": {
      const u = useUIStore.getState();
      // `view` stays per device (phone vs desktop), as does everything session-local.
      return { weekStartsOnMonday: u.weekStartsOnMonday, use24h: u.use24h, dateFormatEU: u.dateFormatEU, collapsedSections: u.collapsedSections };
    }
  }
}

function writeLocal(section: Section, value: unknown) {
  switch (section) {
    case "connections": useConnectionStore.setState({ connections: value as never }); break;
    case "eventTypes": useEventTypeStore.setState({ types: value as never }); break;
    case "rules": useRuleStore.setState({ rules: value as never }); break;
    case "presets": usePresetStore.setState({ presets: value as never }); break;
    case "themes": useThemeStore.setState(value as never); break;
    case "ui": useUIStore.setState(value as never); break;
  }
}

let applying = false;
const pushing = new Set<Section>();

function adopt(section: Section, rev: number, value: unknown) {
  applying = true;
  try {
    writeLocal(section, value);
  } finally {
    applying = false;
  }
  const meta = readMeta();
  meta[section] = { rev, hash: hashOf(readLocal(section)) };
  writeMeta(meta);
}

async function putSection(section: Section, token: string): Promise<"ok" | "conflict" | "error"> {
  const meta = readMeta();
  const value = readLocal(section);
  let res: Response;
  try {
    res = await fetch(`/api/settings/${section}`, {
      method: "PUT",
      headers: serverHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ baseRev: meta[section]?.rev ?? 0, value }),
    });
  } catch {
    return "error";
  }
  if (res.status === 409) {
    const body = (await res.json()) as { rev: number; value: unknown };
    adopt(section, body.rev, body.value);
    return "conflict";
  }
  if (!res.ok) return "error";
  const { rev } = (await res.json()) as { rev: number };
  const next = readMeta();
  next[section] = { rev, hash: hashOf(value) };
  writeMeta(next);
  return "ok";
}

/** Pushes every section whose local value differs from what was last synced. Returns the sections the server overrode. */
export async function pushDirty(token: string): Promise<Section[]> {
  const overridden: Section[] = [];
  for (const section of SECTIONS) {
    if (pushing.has(section)) continue;
    if (hashOf(readLocal(section)) === readMeta()[section]?.hash) continue;
    pushing.add(section);
    try {
      if ((await putSection(section, token)) === "conflict") overridden.push(section);
    } finally {
      pushing.delete(section);
    }
  }
  return overridden;
}

interface ServerSettings {
  revs: Record<Section, number>;
  [key: string]: unknown;
}

/**
 * First sync of a page load. Per section: the server has nothing yet → push ours (first device
 * seeds the server); we never synced or the server moved on → adopt the server's value; we have
 * unsynced local edits and the server did not move → push them.
 * Returns the sections whose local value changed because of the server.
 */
export async function pullSettings(token: string): Promise<Section[] | null> {
  let res: Response;
  try {
    res = await fetch("/api/settings", { headers: serverHeaders(token), cache: "no-store" });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const server = (await res.json()) as ServerSettings;
  if (!server.revs) return null; // an older server without versioned settings

  const meta = readMeta();
  const changed: Section[] = [];
  for (const section of SECTIONS) {
    const rev = server.revs[section] ?? 0;
    const known = meta[section];
    const localHash = hashOf(readLocal(section));
    const dirty = known ? known.hash !== localHash : true;
    if (rev === 0) continue; // seeded by pushDirty below
    if (known && known.rev === rev && !dirty) continue;
    if (known && known.rev === rev && dirty) continue; // pushDirty sends our edits
    if (server[section] == null) continue;
    adopt(section, rev, server[section]);
    changed.push(section);
  }
  return changed;
}

/** Wires store changes to debounced pushes. Returns an unsubscribe function. */
export function watchLocalChanges(token: string, onOverridden: (sections: Section[]) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (applying) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      void pushDirty(token).then((overridden) => overridden.length && onOverridden(overridden));
    }, 800);
  };
  const unsubs = [useConnectionStore, useEventTypeStore, useRuleStore, usePresetStore, useThemeStore, useUIStore].map((s) =>
    (s as { subscribe: (fn: () => void) => () => void }).subscribe(schedule),
  );
  return () => {
    clearTimeout(timer);
    unsubs.forEach((u) => u());
  };
}
