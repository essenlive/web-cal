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
