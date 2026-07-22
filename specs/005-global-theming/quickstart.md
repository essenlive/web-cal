# Quickstart: Global Theming

## For developers

1. **Themes live in `useThemeStore`** (`src/store/index.ts`), persisted under `proton-cal:themes`. Built-in "Light"/"Dark" are **not** in this store — they're the constant `BUILTIN_THEMES` in `src/lib/theme.ts`. Always read the full list via `getAllThemes(customThemes)`, never `customThemes` alone.
2. **The active theme** is `getActiveTheme(customThemes, selectedThemeId)` — always use this helper rather than searching manually, since it has the fallback-to-Light behavior deletion relies on (FR-011).
3. **Applying a theme to the page** happens in exactly one place: `src/app/providers.tsx`. If you need the current theme elsewhere (e.g. to preview a color), read from `useThemeStore` directly — don't re-derive DOM state.
4. **Adding a new controllable token to a theme** (out of scope for this feature, but if a future feature wants it): extend the `Theme` interface, extend `resolveThemeCssVars`, extend `ThemeEditorDialog`'s form. Keep the "derive hue/sat from a picked color, keep the app's existing lightness curve" pattern from `resolveThemeCssVars` rather than storing raw HSL triples per token — it keeps the picker to "one color per theme" instead of ballooning into a token editor.
5. **No new dependency was added.** Accent picking uses `<input type="color">` plus the same preset-swatch pattern already used in `EventTypeForm`/`AddConnectionModal`.

## For QA / manual verification

1. Open the app. The header shows a theme selector (was: sun/moon toggle button).
2. Click it → see "Light" and "Dark" listed, with a check on the active one. Click "Dark" → whole app goes dark instantly, selector shows the check moved.
3. Reload the page → "Dark" is still selected.
4. Click "+ New theme" → name it "Forest", pick Dark mode, pick a green accent, save. It appears in the list.
5. Select "Forest" → background is dark, but primary buttons / active view-switcher tab / focus rings are green instead of indigo.
6. Reopen the selector, click the edit icon on "Forest" → change accent to a different color, save → if "Forest" is still selected, the app's accent updates immediately.
7. Delete "Forest" while it's selected → app falls back to "Light".
8. Try creating a theme named "Light" (any casing) → blocked with a duplicate-name error. Try saving with an empty name → blocked.
9. Confirm "Light" and "Dark" show no edit/delete affordance in the selector.

## Known pre-existing condition (not introduced by this feature)

`npm test` has no script configured in this repository (no test framework present). This plan does not add one — see `plan.md`'s Complexity Tracking section. `npm run lint` and `tsc -b` remain the enforced quality gates for this feature.
