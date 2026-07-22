# Quickstart: View Presets

## For developers

1. **Presets live in `usePresetStore`** (`src/store/index.ts`), persisted under `webcal:presets`. A preset is just `{ id, name, connections: Record<id, hidden>, eventTypes: Record<id, hidden> }` — it never stores anything about a connection/event type beyond its `hidden` boolean (see `data-model.md`).
2. **Capturing "current state"** always goes through `capturePresetState()` (`src/lib/presets.ts`) — never read `useConnectionStore`/`useEventTypeStore` ad hoc for this, so "what a preset saves" stays defined in exactly one place.
3. **Applying a preset** (`applyPreset(id)`) loops the *current* connections/event types and only touches the ones present as keys in the preset's maps — this single loop is what implements both "skip deleted references" (FR-004) and "leave new items untouched" (FR-005). Don't add special-case branches for those; the lookup-by-key already handles both.
4. **No new dependency was added.** No Radix Popover/Dialog for this feature — presets are a plain always-visible Sidebar section (like "Sources"/"Types"), not a popover like `ThemeSelector` (see `research.md` Decision 3/5 for why).
5. **Rename vs. update are both `updatePreset(preset)`** (full-object replace, same convention as `updateTheme`/`updateType`/`updateConnection`) — the caller decides which fields differ from the existing object; there's no separate `renamePreset`/`recapturePreset` action.

## For QA / manual verification

1. Hide a couple of connections/event types via the existing show/hide toggles. In the new "Presets" section, click "+", type "Work", submit → "Work" appears in the list.
2. Change visibility again (show what was hidden, hide something else). Save a second preset named "Personal".
3. Click "Work" → visibility flips back to exactly what was saved under "Work". Click "Personal" → flips to that saved state instead.
4. Try saving a new preset named "work" (different casing) → blocked/confirmed as an overwrite of the existing "Work", not a silent duplicate. Try saving with an empty name → blocked.
5. Rename "Personal" to "Home" → still applies the same visibility state as before under the new name.
6. Toggle a couple of things manually, then click the "update" icon on "Home" → "Home" now captures the new state; applying it again reflects the change.
7. Delete a connection or event type entirely (via existing settings), then apply a preset that referenced it → no error, everything else in the preset still applies.
8. Add a brand-new connection, then apply an older preset that predates it → the new connection's visibility is left as-is (not forced hidden or shown).
9. Reload the page → all saved presets are still listed and still apply correctly.
10. Delete "Work" via its delete icon (two-step confirm, same as deleting a custom theme) → it disappears from the list and can no longer be applied.

## Known pre-existing condition (not introduced by this feature)

`npm test` has no script configured in this repository (no test framework present). This plan does not add one — see `plan.md`'s Complexity Tracking section. `npm run lint` and `tsc -b` remain the enforced quality gates for this feature.
