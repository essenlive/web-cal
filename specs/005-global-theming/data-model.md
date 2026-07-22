# Phase 1 Data Model: Global Theming

## Entity: `Theme`

Added to `src/types/index.ts`.

```ts
export type ThemeMode = "light" | "dark";

export interface Theme {
  /** Stable id. "light" / "dark" for built-ins; generated UUID for custom themes. */
  id: string;
  /** Display name, shown in the selector. Unique case-insensitively across all themes. */
  name: string;
  /** Base appearance driving the existing `.dark` class + non-accent CSS tokens. */
  mode: ThemeMode;
  /** Hex color (e.g. "#6366f1") driving `--primary` / `--accent` / `--ring` hue+saturation. */
  accent: string;
}
```

**Field notes**:
- `id`: Built-ins use the literal ids `"light"` and `"dark"` (never regenerated, never persisted as data — see research.md Decision 4). Custom themes get a generated id (`crypto.randomUUID()`, same approach as existing `EventType`/`Connection` id generation elsewhere in the codebase).
- `name`: Required, non-empty, trimmed. Uniqueness enforced case-insensitively against **all** theme names currently in scope (built-ins + custom), per FR-009.
- `mode`: One of exactly two values. No "system/auto" mode in this feature's scope (not requested; existing app has no `prefers-color-scheme` wiring to extend).
- `accent`: A `#rrggbb` hex string, as produced by `<input type="color">`. Stored verbatim; hue/saturation extracted at render time by `resolveThemeCssVars` (see research.md Decision 1), not pre-computed/stored.

**Validation rules** (enforced in `ThemeEditorDialog`, mirroring `EventTypeForm`'s existing `isDuplicate` pattern):
- `name.trim().length > 0` (FR-010)
- `!allThemes.some(t => t.id !== editingId && t.name.toLowerCase() === name.trim().toLowerCase())` (FR-009)

**No state transitions** beyond create → (edit)* → delete for custom themes; built-ins have no lifecycle (always present, immutable).

## Entity: Theme Selection (part of `ThemeStore`)

Not a separate persisted entity — a single field:

```ts
selectedThemeId: string; // FK-like reference into BUILTIN_THEMES ∪ customThemes, by id
```

**Rules**:
- MUST always resolve to an existing theme. If `selectedThemeId` points at a theme that no longer exists (e.g. the active custom theme was just deleted), the resolution helper (`getActiveTheme`) falls back to the built-in `"light"` theme (FR-011) — this is a read-time fallback, not a write-time one, so `removeTheme` doesn't need to know whether the theme it's deleting is currently active.

## Store Shape

New Zustand slice in `src/store/index.ts`, persisted key `proton-cal:themes` (new key, additive — does not touch `proton-cal:ui`, `proton-cal:event-types`, or `webcal:connections`):

```ts
interface ThemeStore {
  customThemes: Theme[];
  selectedThemeId: string;
  addTheme: (t: Omit<Theme, "id">) => void;
  updateTheme: (t: Theme) => void;
  removeTheme: (id: string) => void;
  selectTheme: (id: string) => void;
}
```

- `addTheme`: generates `id`, appends to `customThemes`. Does not auto-select the new theme (US2 acceptance scenarios describe "appears in the selector" and "can be selected" as separate steps — creating doesn't force-switch the user's current appearance out from under them).
- `updateTheme`: replaces the matching entry in `customThemes` by `id`. No-op (or guarded/disabled at the UI layer) if `id` matches a built-in.
- `removeTheme`: filters the matching entry out of `customThemes` by `id`. No-op if `id` matches a built-in (defense in depth; UI never offers delete for built-ins per FR-002).
- `selectTheme`: sets `selectedThemeId`. No validation needed here — it's only ever called with an id currently shown in the selector, which is always valid at click time.

`partialize`: `{ customThemes: s.customThemes, selectedThemeId: s.selectedThemeId }` (both fields, matching the existing per-store `partialize` convention where the whole persisted shape is explicit rather than persisting everything).

## Derived / Non-Persisted Helpers (`src/lib/theme.ts`)

- `BUILTIN_THEMES: Theme[]` — constant, see research.md Decision 4.
- `getAllThemes(customThemes: Theme[]): Theme[]` → `[...BUILTIN_THEMES, ...customThemes]`
- `getActiveTheme(customThemes: Theme[], selectedThemeId: string): Theme` → finds by id in `getAllThemes(...)`, falls back to `BUILTIN_THEMES[0]` (Light) if not found.
- `resolveThemeCssVars(theme: Theme): Record<string, string>` → returns the 5 CSS custom property values (`--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--ring`) per research.md Decision 1.
- `hexToHsl(hex: string): { h: number; s: number; l: number }` and the reverse `hslToHex` — small pure utility functions, no dependency.

## Migration Data Flow (one-time, read-only)

```text
localStorage["proton-cal:ui"]  (existing, untouched)
  └─ state.darkMode: boolean
        │  read once, only when localStorage["proton-cal:themes"] does not yet exist
        ▼
useThemeStore initial state . selectedThemeId = darkMode ? "dark" : "light"
```

No new field is added to `UIStore`; `darkMode`/`toggleDark` remain in `useUIStore` as unused-by-UI dead code after this feature (see research.md Decision 3 for why removal is out of scope).
