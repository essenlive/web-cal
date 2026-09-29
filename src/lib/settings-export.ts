/**
 * Settings export/import — bundles every persisted Zustand key into one JSON
 * file and restores it later. Reuses each store's own localStorage blob
 * (already the shape zustand's `persist` middleware writes) instead of
 * defining a parallel schema.
 */

import { bumpSettingsUpdatedAt } from "./sync/clock";

export const EXPORT_SECTIONS = {
  presets: ["overcal:presets"],
  sources: ["overcal:connections"],
  rulesAndStyles: ["overcal:rules", "overcal:event-types"],
  themes: ["overcal:themes"],
  general: ["overcal:ui"],
} as const;

export type ExportSection = keyof typeof EXPORT_SECTIONS;

const SETTINGS_KEYS = Object.values(EXPORT_SECTIONS).flat();

interface SettingsExport {
  version: 1;
  exportedAt: string;
  data: Partial<Record<(typeof SETTINGS_KEYS)[number], unknown>>;
}

/** Reads the raw persisted blobs for the selected sections into one exportable object. */
export function buildSettingsExport(
  read: (key: string) => string | null,
  sections: readonly ExportSection[] = Object.keys(EXPORT_SECTIONS) as ExportSection[]
): SettingsExport {
  const keys = sections.flatMap((s) => EXPORT_SECTIONS[s]);
  const data: SettingsExport["data"] = {};
  for (const key of keys) {
    const raw = read(key);
    if (raw) data[key] = JSON.parse(raw);
  }
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

/** Parses an imported file's text and returns the localStorage writes to apply. Throws if the file isn't a recognizable export. */
export function parseSettingsImport(text: string): Array<[string, string]> {
  const parsed = JSON.parse(text);
  const data = parsed?.data;
  if (!data || typeof data !== "object") throw new Error("Fichier de paramètres invalide");

  const writes: Array<[string, string]> = [];
  for (const key of SETTINGS_KEYS) {
    if (key in data) writes.push([key, JSON.stringify(data[key])]);
  }
  if (writes.length === 0) throw new Error("Fichier de paramètres invalide");
  return writes;
}

export function downloadSettingsExport(sections?: readonly ExportSection[]): void {
  const json = JSON.stringify(
    buildSettingsExport((key) => localStorage.getItem(key), sections),
    null,
    2
  );
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `webcal-settings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Applies an imported file to localStorage and reloads so every store rehydrates. */
export async function importSettingsFile(file: File): Promise<void> {
  const writes = parseSettingsImport(await file.text());
  for (const [key, value] of writes) localStorage.setItem(key, value);
  // store/index.ts's clock-bump subscriber only fires on in-app setState, not on
  // rehydration from localStorage after reload — bump it here or this device's
  // sync clock stays stale despite the real change, and P2P sync silently drops it.
  bumpSettingsUpdatedAt();
  window.location.reload();
}

/** Wipes every persisted key and reloads, so every store re-seeds its defaults from scratch —
 *  including the "Bien démarrer" state (not exported, but a reset instance should start over). */
export function resetSettings(): void {
  for (const key of [...SETTINGS_KEYS, "webcal:onboarding"]) localStorage.removeItem(key);
  window.location.reload();
}
