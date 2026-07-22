# Phase 1 Data Model: View Presets

## Entity: `Preset`

Added to `src/types/index.ts`.

```ts
export interface Preset {
  /** Stable id, generated with crypto.randomUUID() — same convention as EventType/Connection/Theme ids. */
  id: string;
  /** Display name, shown in the selector. Unique case-insensitively across all presets. */
  name: string;
  /** Connection.id → hidden state, captured at save/update time. Absent id = not covered by this preset (FR-004/FR-005). */
  connections: Record<string, boolean>;
  /** EventType.id → hidden state, captured at save/update time. Absent id = not covered by this preset (FR-004/FR-005). */
  eventTypes: Record<string, boolean>;
}
```

**Field notes**:
- `id`: Always a generated UUID — there are no built-in presets (unlike `Theme`'s "light"/"dark"), so every preset follows the same lifecycle.
- `name`: Required, non-empty (trimmed), unique case-insensitively against all existing preset names (FR-009/FR-010).
- `connections` / `eventTypes`: Snapshots of the `hidden` boolean already present on `Connection` and `EventType` (see `specs/004-quick-hide/data-model.md`) — no other fields are copied. See research.md Decision 1 for why a keyed map (not an array or full-object snapshot).

**Validation rules** (enforced in `PresetSelector`, mirroring `ThemeEditorDialog`'s `isDuplicate` check):
- `name.trim().length > 0` (FR-009)
- On save-as-new with a name that collides (`allPresets.some(p => p.name.toLowerCase() === name.trim().toLowerCase())`): arm the two-step confirm (research.md Decision 4) before overwriting via `updatePreset` instead of silently creating a duplicate-named preset (FR-010).

**Lifecycle**: create (`addPreset`) → any number of (`renamePreset` | `updatePreset` | `applyPreset`) → `removePreset`. No other state transitions.

## Store Shape

New Zustand slice in `src/store/index.ts`, persisted key `webcal:presets` (new key, additive — does not touch `proton-cal:ui`, `proton-cal:event-types`, `proton-cal:themes`, or `webcal:connections`/`webcal:rules`):

```ts
interface PresetStore {
  presets: Preset[];
  addPreset: (name: string) => void;
  updatePreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
  applyPreset: (id: string) => void;
}
```

- `addPreset(name)`: generates `id`, calls `capturePresetState()` (see below) to fill `connections`/`eventTypes` from the *current* live state of `useConnectionStore`/`useEventTypeStore`, appends to `presets` (FR-001). Ordering is append-only — array order is save order, which is also the order the future keyboard-shortcut feature (1/2/3…) will map to (per spec's Key Entities note).
- `updatePreset(preset)`: replaces the matching entry in `presets` by `id` — a full-object replace, matching the existing `updateTheme`/`updateType`/`updateConnection` convention exactly. Used for both:
  - **Rename** (FR-006): caller passes `{ ...existing, name: newName }` — `connections`/`eventTypes` untouched.
  - **Update to current state** (FR-007): caller passes `{ ...existing, ...capturePresetState() }` — `name` untouched.
- `removePreset(id)`: filters the matching entry out of `presets` (FR-008).
- `applyPreset(id)`: finds the preset by `id`; if not found, no-op. Otherwise:
  1. Reads `useConnectionStore.getState().connections`. For each connection whose `id` is a key in `preset.connections`, calls `updateConnection({ ...connection, hidden: preset.connections[connection.id] })`. Connections not in the map are left untouched (FR-005); ids in the map with no matching live connection are simply never iterated, i.e. skipped (FR-004).
  2. Same loop for `useEventTypeStore.getState().types` against `preset.eventTypes`.
  3. Does **not** modify `presets` itself (FR-012 — applying never mutates the preset).

No `partialize` needed — the entire `PresetStore` state (`presets`) is meant to persist, matching the simplest existing stores (`useConnectionStore`, `useEventTypeStore`) rather than the stores that selectively persist a subset (`useUIStore`, `useThemeStore`).

## Derived / Non-Persisted Helper (`src/lib/presets.ts`)

```ts
/** Snapshots the current hidden-state of every connection and event type. */
export function capturePresetState(): Pick<Preset, "connections" | "eventTypes">;
```

```ts
export function capturePresetState(): Pick<Preset, "connections" | "eventTypes"> {
  return {
    connections: Object.fromEntries(
      useConnectionStore.getState().connections.map((c) => [c.id, !!c.hidden])
    ),
    eventTypes: Object.fromEntries(
      useEventTypeStore.getState().types.map((t) => [t.id, !!t.hidden])
    ),
  };
}
```

A pure read (no writes), reused by both `addPreset` and any `updatePreset` call site that needs "current state" (research.md Decision 2).
