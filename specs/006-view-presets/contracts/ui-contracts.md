# UI / TypeScript Interface Contracts: View Presets

This app has no server API; "contracts" here are the TypeScript interfaces new/changed components and store hooks expose to each other, per the project's existing convention (see `specs/005-global-theming/contracts/ui-contracts.md`).

## `src/types/index.ts`

```ts
export interface Preset {
  id: string;
  name: string;
  connections: Record<string, boolean>;
  eventTypes: Record<string, boolean>;
}
```

## `src/lib/presets.ts`

```ts
export function capturePresetState(): Pick<Preset, "connections" | "eventTypes">;
```

## `src/store/index.ts` — `usePresetStore`

```ts
export interface PresetStore {
  presets: Preset[];
  addPreset: (name: string) => void;
  updatePreset: (preset: Preset) => void;
  removePreset: (id: string) => void;
  applyPreset: (id: string) => void;
}

export const usePresetStore: UseBoundStore<...>; // Zustand store, persisted "webcal:presets"
```

Consumers select what they need, matching existing call-site style (e.g. `const { presets, addPreset, applyPreset } = usePresetStore();`).

## `src/components/sidebar/PresetSelector.tsx` (new)

```ts
export interface PresetSelectorProps {} // no props — reads usePresetStore/useConnectionStore/useEventTypeStore directly

export function PresetSelector(): JSX.Element;
```

Not a dialog or popover (research.md Decision 3) — a plain section, structured like the existing "Sources"/"Types" sections:
- Uses the existing `SectionHeader` component (label "Presets"); its `onAdd` (the "+" button) expands an inline `<input>` for a new preset's name in place of the button. Submitting (Enter/blur) with a valid, non-colliding name calls `addPreset(name)`. A case-insensitive name collision against `presets` arms the existing two-step `confirmingDelete`-style confirm (research.md Decision 4); confirming calls `updatePreset({ ...matchedPreset, ...capturePresetState() })` instead (FR-010: overwrite rather than silently duplicate). Empty/whitespace-only names are rejected client-side (FR-009) — submit is a no-op and the input stays open.
- One `PresetRow` per `preset` in `presets`, styled like `ConnectionRow`/`TypeRow`: click the row → `applyPreset(preset.id)`; a rename icon turns the row into an inline `<input>` (Enter/blur → `updatePreset({ ...preset, name })`, Escape → cancel); an "update to current state" icon button → `updatePreset({ ...preset, ...capturePresetState() })` (no confirmation needed — it doesn't destroy a differently-named preset); a delete icon using the existing two-step `confirmingDelete` pattern (see `ThemeEditorDialog.tsx`) → `removePreset(preset.id)`.

## `src/components/sidebar/Sidebar.tsx` (modified)

- Adds a new section rendering `<PresetSelector />`, positioned above the existing "Sources" section per research.md Decision 5.
