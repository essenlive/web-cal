# Phase 0 Research: View Presets

No `NEEDS CLARIFICATION` markers remain in the Technical Context (the stack is fully known from the existing codebase, and the spec's checklist already passed with zero markers). This document records the design decisions needed to turn "save/apply a named visibility combination" into concrete store shape and UI, reusing patterns already established by `004-quick-hide` and `005-global-theming`.

## Decision 1: Snapshot shape — `Record<id, hidden>`, not an array or a copy of full objects

**Decision**: A preset stores `connections: Record<string, boolean>` and `eventTypes: Record<string, boolean>`, mapping each connection/event-type id to its `hidden` state at save time. Only the id and the boolean are captured — no name, color, or other fields are duplicated into the preset.

**Rationale**: The spec's edge cases (FR-004: skip deleted references, FR-005: leave new items untouched) reduce to a single, natural check when the state is a lookup map: iterate the *current* connections/event types and, for each, check `id in preset.connections` / `id in preset.eventTypes` — present means apply the stored boolean, absent means leave alone. An array of `{id, hidden}` pairs would need a `.find()` per item for the same result; a plain object is the simplest structure that makes "not in the preset" a free by-product of the lookup rather than a special case to code around.

**Alternatives considered**:
- *Array of `{id, hidden}`*: Rejected — no benefit over a keyed object for this access pattern, and Object key lookup (`in`) reads more directly as "is this item covered by the preset."
- *Store the full connection/event-type object at save time (a true snapshot)*: Rejected — massively overspecified for what the feature needs (just a boolean), and would let a preset silently reintroduce a connection's stale name/color/URL if ever misused for restore — the spec only asks for visibility, not object restoration.

## Decision 2: Cross-store reads/writes — same pattern as existing `removeRulesForConnection`

**Decision**: `usePresetStore`'s `addPreset`/`applyPreset` actions reach into `useConnectionStore.getState()` and `useEventTypeStore.getState()` directly (read current `connections`/`types`, call their `updateConnection`/`updateType` actions), exactly like `useConnectionStore.removeConnection` already calls `useRuleStore.getState().removeRulesForConnection(id)` today (`src/store/index.ts:82`).

**Rationale**: This is the only cross-store interaction pattern that already exists in this codebase — reusing it means no new architectural concept (no event bus, no selector-passing) is introduced for what is fundamentally "one store needs to read/write two others."

**Alternatives considered**:
- *Have the UI component orchestrate the loop (read all three stores in the component, write back)*: Rejected — puts business logic (the skip-missing / leave-new-items-alone rules) in a component instead of the store, harder to keep correct as the only place that does this, and inconsistent with how `removeConnection` already keeps its cross-store side effect inside the store action.

## Decision 3: No dialog, no popover — a plain inline section like "Sources"/"Types"

**Decision**: Unlike `ThemeEditorDialog` (needed because a theme has three fields: name, mode, accent color) or `ThemeSelector` (a Radix Popover), a Preset has exactly one editable field — its name — and is expected to be used often (research.md Decision 5). So `PresetSelector.tsx` is not a dialog or popover at all: it's a plain section in `Sidebar.tsx`, built the same way as the existing "Sources"/"Types" sections — the existing `SectionHeader` component (its "+" button expands an inline `<input>` for a new preset's name, submitting calls `addPreset`) plus a list of `PresetRow` rows (one per preset), styled like `ConnectionRow`/`TypeRow`. Each row: click to `applyPreset`, a rename affordance (turns the row into an inline `<input>`, Enter/blur commits via `updatePreset`, Escape cancels), an "update to current state" icon button (`updatePreset` with `capturePresetState()`), and a delete icon using the existing two-step `confirmingDelete` pattern.

**Rationale**: A modal or popover adds a click just to see/use something meant to be reached for constantly (once keyboard shortcuts land, presets are used as often as switching calendar views). Matching the always-visible "Sources"/"Types" section pattern keeps presets one glance and one click away, reuses the existing `SectionHeader` component outright, and needs no new Radix usage or dialog component (Simplicity & YAGNI).

**Alternatives considered**:
- *Radix Popover, like `ThemeSelector`*: Rejected — appropriate for a rarely-touched global setting (appearance), but adds a hidden step for what this feature frames as a frequent, primary action (research.md Decision 5).
- *Reuse the `ThemeEditorDialog` pattern verbatim (separate dialog component)*: Rejected — that pattern earns its complexity for 3 fields including a color picker; for 1 text field it would just be an empty dialog wrapping an `<input>`.

## Decision 4: Delete and duplicate-name-overwrite both reuse the existing `confirmingDelete` two-step pattern

**Decision**: Both destructive/overwriting actions — deleting a preset, and saving a new preset under a name that already exists — use the same two-step "arm on first click, confirm on second click" boolean-flag pattern already used by `EventTypeModal.tsx` and `ThemeEditorDialog.tsx` (`confirmingDelete` state: first click swaps the button to a "confirm?" state, second click while armed performs the action, any other interaction resets it).

**Rationale**: This is the established in-codebase idiom for "are you sure" without a nested modal or `window.confirm()` (which appears nowhere else in this codebase and would be visually inconsistent with the existing inline-confirm rows). Reusing it means zero new interaction pattern to learn or maintain.

**Alternatives considered**:
- *`window.confirm()`*: Rejected — never used elsewhere in this codebase; breaks visual consistency (native browser dialog vs. the app's own confirm-in-place rows) for no benefit.

## Decision 5: Placement in the Sidebar — its own section above "Sources", not bundled into the bottom bar with `ThemeSelector`

**Decision**: `PresetSelector` gets its own section in `Sidebar.tsx`, positioned above the "Sources" section (before the mini-calendar's sibling sections), rather than being placed in the bottom-bar row next to `ThemeSelector`/Settings.

**Rationale**: The spec explicitly frames presets as the foundation for a future keyboard-shortcut feature (1/2/3…) for fast, frequent switching between contexts (Work/Personal) — this is expected to be a high-frequency, primary interaction, unlike the theme selector (a rarely-changed global appearance setting that fits naturally in a low-emphasis bottom-bar icon). Giving it a visible top-level section matches its intended usage frequency.

**Alternatives considered**:
- *Bottom bar, next to `ThemeSelector`*: Rejected — would visually equate a frequent, content-changing action with a rare, appearance-only one; also crowds a row that's already tight (theme selector + settings link).
