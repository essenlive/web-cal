/**
 * Snapshots the current hidden-state of every connection and event type (plus
 * the active theme), for use by usePresetStore's addPreset/updatePreset
 * actions. See specs/006-view-presets/data-model.md.
 *
 * Takes the live arrays/id as arguments (rather than reading the stores
 * itself) to avoid a circular import between this module and src/store/index.ts.
 */

import type { Connection, EventType, Preset } from "../types";

export function capturePresetState(
  connections: Connection[],
  types: EventType[],
  themeId: string
): Pick<Preset, "connections" | "eventTypes" | "themeId"> {
  return {
    connections: Object.fromEntries(connections.map((c) => [c.id, !!c.hidden])),
    eventTypes: Object.fromEntries(types.map((t) => [t.id, !!t.hidden])),
    themeId,
  };
}

/**
 * Whether every id `preset` actually captured still has the same value in
 * `current`. Deliberately one-directional: ids present in `current` but
 * absent from `preset` (e.g. a connection added after the preset was saved)
 * are ignored, matching applyPreset's own "absent id = not covered" rule —
 * comparing full key-set equality here would make a preset's "active" state
 * go permanently stale the moment any new connection/type is added.
 */
function presetCoversState(preset: Record<string, boolean>, current: Record<string, boolean>): boolean {
  return Object.entries(preset).every(([id, hidden]) => current[id] === hidden);
}

/** Whether the live hidden-state of every connection/type the preset captured, and its theme, still match — used to show which preset is currently applied. */
export function presetMatchesState(
  preset: Pick<Preset, "connections" | "eventTypes" | "themeId">,
  connections: Connection[],
  types: EventType[],
  themeId: string
): boolean {
  const current = capturePresetState(connections, types, themeId);
  return (
    presetCoversState(preset.connections, current.connections) &&
    presetCoversState(preset.eventTypes, current.eventTypes) &&
    (preset.themeId === undefined || preset.themeId === themeId)
  );
}

/** Builds the bookmarkable URL that re-applies `presetId` on load (see CalendarPage's `?preset=` hydration), copies it to the clipboard, and returns it. */
export async function copyPresetLink(presetId: string): Promise<string> {
  const url = `${window.location.origin}${window.location.pathname}?preset=${presetId}`;
  await navigator.clipboard.writeText(url);
  return url;
}
