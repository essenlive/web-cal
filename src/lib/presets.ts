/**
 * Snapshots the current hidden-state of every connection and event type, for
 * use by usePresetStore's addPreset/updatePreset actions. See
 * specs/006-view-presets/data-model.md.
 *
 * Takes the live arrays as arguments (rather than reading the stores itself)
 * to avoid a circular import between this module and src/store/index.ts.
 */

import type { Connection, EventType, Preset } from "../types";

export function capturePresetState(
  connections: Connection[],
  types: EventType[]
): Pick<Preset, "connections" | "eventTypes"> {
  return {
    connections: Object.fromEntries(connections.map((c) => [c.id, !!c.hidden])),
    eventTypes: Object.fromEntries(types.map((t) => [t.id, !!t.hidden])),
  };
}

function recordsEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((k) => a[k] === b[k]);
}

/** Whether the live hidden-state of every connection/type still matches what `preset` captured — used to show which preset is currently applied. */
export function presetMatchesState(
  preset: Pick<Preset, "connections" | "eventTypes">,
  connections: Connection[],
  types: EventType[]
): boolean {
  const current = capturePresetState(connections, types);
  return recordsEqual(preset.connections, current.connections) && recordsEqual(preset.eventTypes, current.eventTypes);
}
