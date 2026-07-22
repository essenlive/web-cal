# Phase 0 Research: Global Theming

No `NEEDS CLARIFICATION` markers remain in the Technical Context (the stack is fully known from the existing codebase). This document instead records the design decisions needed to turn a user-picked accent color + mode into the app's existing CSS variable set, and how to migrate the legacy `darkMode` boolean.

## Decision 1: How an accent color becomes `--primary` / `--accent` / `--ring`

**Decision**: Convert the user's picked accent hex to HSL, take its **hue** and **saturation**, and recombine them with the **lightness values the app already uses per token per mode** (i.e., keep the existing design system's contrast/lightness scale, just swap in the user's hue+saturation instead of the hardcoded `234, 89%`).

Concretely, `globals.css` today defines (hue 234, saturation 89% throughout):

| Token | Light | Dark |
|---|---|---|
| `--primary` | `234 89% 60%` | `234 89% 65%` |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--accent` | `234 89% 96%` | `234 40% 18%` |
| `--accent-foreground` | `234 89% 40%` | `234 89% 75%` |
| `--ring` | `234 89% 60%` | `234 89% 65%` |

`resolveThemeCssVars(theme)` in `src/lib/theme.ts` extracts `{h, s}` from `theme.accent` (ignoring the picked lightness) and reconstructs each token using the **lightness figures above**, selected by `theme.mode`. `--primary-foreground` stays `0 0% 100%` (white) always — it is not derived from the accent, since it must stay readable against any hue. `--accent`'s saturation in dark mode (40%) is a deliberate desaturation baked into the existing design and is preserved as-is (only hue changes), rather than reusing the picked `s`, so accent panels don't become oversaturated in dark mode for very saturated user picks.

**Rationale**: This is the minimal change that lets any accent color "just work" everywhere `--primary`/`--accent`/`--ring` are already used (buttons, active tabs, focus rings, badges) without touching `--background`/`--foreground`/`--card`/etc., and without inventing a new token or theming API. It guarantees the same contrast/legibility the app already ships with, because only hue (and primary's saturation) change — lightness curves are untouched.

**Alternatives considered**:
- *Use the picked color verbatim as `--primary` (H, S, and L all from the picked color)*: Rejected — an arbitrary user-picked lightness could produce poor contrast against `--primary-foreground: white` (e.g., a very light accent pick would be nearly invisible), and would require per-pick contrast-checking logic that doesn't exist anywhere else in this codebase (YAGNI).
- *Store the picked color as a raw hex and apply it only via inline `style` on specific elements (like `EventType.color` is used)*: Rejected — that pattern works for small badges/chips where one color is set inline, but "global theming" per the spec (FR-004) must affect `--primary`/`--ring` app-wide (buttons, focus states, active nav), which is only practical via CSS custom properties, not per-element inline styles.
- *Introduce a proper design-token/theming library (e.g., a token JSON schema, multiple derived shades)*: Rejected per task constraint — scope must stay proportional to the CSS variables already in `globals.css`; no new token system.

## Decision 2: Applying theme CSS variables at runtime

**Decision**: In `src/app/providers.tsx`, replace the current effect:

```ts
useEffect(() => {
  document.documentElement.classList.toggle("dark", darkMode);
}, [darkMode]);
```

with one that (a) still toggles the `.dark` class based on `activeTheme.mode` (so all the existing non-primary tokens defined under `.dark { ... }` in `globals.css` keep working unchanged), and (b) calls `document.documentElement.style.setProperty(varName, value)` for each of the 5 tokens returned by `resolveThemeCssVars(activeTheme)`. Inline styles on `<html>` win over the stylesheet's `:root`/`.dark` rules for those 5 properties, which is exactly the override mechanism needed — no CSS-in-JS, no `<style>` tag injection.

**Rationale**: Smallest possible change to the existing, working mechanism (`.dark` class + CSS custom properties already defined in `globals.css`). No new runtime dependency, no hydration-mismatch risk beyond what already exists for `darkMode` (App Router client component, effect runs post-mount).

**Alternatives considered**:
- *Inject a `<style>` tag with a dynamic `:root` override*: Rejected — more moving parts than `style.setProperty` for the same result.
- *CSS-in-JS / styled-components dynamic theming*: Rejected — new dependency, against constraints.

## Decision 3: Migrating the legacy `darkMode` boolean

**Decision**: `useThemeStore`'s initial-state factory performs a one-time, guarded `localStorage.getItem("proton-cal:ui")` read (browser-only, `typeof window !== "undefined"` guarded) to seed `selectedThemeId` the first time the new `proton-cal:themes` key doesn't yet exist. If `proton-cal:ui`'s persisted `state.darkMode === true`, seed `"dark"`; otherwise (including absent/malformed) seed `"light"`. This is a read-only migration — `useUIStore.darkMode`/`toggleDark` are left in place but become dead code no longer wired to any UI (removed from `Header.tsx`); they are not deleted from the store in this feature to avoid an unrelated, riskier `partialize`/schema edit to `useUIStore`'s existing persisted shape.

**Rationale**: Satisfies FR-014 (`/speckit.clarify` decision) — preserves existing users' preference — with a minimal, one-directional, one-time read. Leaving the old field in place (rather than deleting it from `UIStore`) avoids any persist-migration edge cases on the *existing* `proton-cal:ui` key, which is out of scope for this feature to touch.

**Alternatives considered**:
- *Delete `darkMode`/`toggleDark` from `useUIStore` entirely*: Rejected for this pass — deleting a field from an already-`partialize`d persisted store either needs a Zustand `migrate` function or silently leaves an orphaned key in old clients' localStorage; neither is necessary to satisfy the spec, and removing dead code here is a nice-to-have, not a requirement. (Left as a follow-up note in `quickstart.md`.)
- *Two-way sync between `darkMode` and the new theme mode*: Rejected — the toggle no longer exists in the UI after this feature, so there is nothing to keep in sync after the one-time read.

## Decision 4: Built-in theme representation

**Decision**: `BUILTIN_THEMES: Theme[]` is a hardcoded constant in `src/lib/theme.ts` (`id: "light"`, `id: "dark"`), **not** persisted in the `useThemeStore.customThemes` array. `useThemeStore` only ever persists `customThemes` (user-created) and `selectedThemeId`. Any lookup of "all themes" (for the selector list) is `[...BUILTIN_THEMES, ...customThemes]` computed at read time, never stored pre-merged. Deletion/edit affordances in the UI are gated on `!BUILTIN_THEMES.some(t => t.id === theme.id)`.

**Rationale**: Matches FR-002 (built-ins always present, never editable/deletable) trivially — there is no code path that can mutate or remove them, because they're not in the mutable array at all. Matches the existing codebase convention of hardcoded defaults (`DEFAULT_EVENT_TYPES`, `DEFAULT_BACKEND` in `src/store/index.ts`) living as constants rather than seeded-then-persisted data.

**Alternatives considered**:
- *Seed `customThemes` with the two built-ins on first run, flagged `builtin: true`*: Rejected — adds a field and a guard-everywhere burden (every edit/delete call site must check the flag) for no behavioral gain over simply never putting them in the mutable array.
