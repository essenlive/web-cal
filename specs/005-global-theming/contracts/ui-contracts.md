# UI / TypeScript Interface Contracts: Global Theming

This app has no server API; "contracts" here are the TypeScript interfaces new/changed components and store hooks expose to each other, per the project's existing convention (see `specs/002-custom-display-types/contracts/ui-contracts.md`).

## `src/types/index.ts`

```ts
export type ThemeMode = "light" | "dark";

export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  accent: string; // "#rrggbb"
}
```

## `src/lib/theme.ts`

```ts
export const BUILTIN_THEMES: Theme[];

export function getAllThemes(customThemes: Theme[]): Theme[];

export function getActiveTheme(customThemes: Theme[], selectedThemeId: string): Theme;

/** Returns the 5 CSS custom property overrides for the given theme. */
export function resolveThemeCssVars(theme: Theme): {
  "--primary": string;
  "--primary-foreground": string;
  "--accent": string;
  "--accent-foreground": string;
  "--ring": string;
};

export function hexToHsl(hex: string): { h: number; s: number; l: number };
export function hslToHex(h: number, s: number, l: number): string;
```

## `src/store/index.ts` — `useThemeStore`

```ts
export interface ThemeStore {
  customThemes: Theme[];
  selectedThemeId: string;
  addTheme: (t: Omit<Theme, "id">) => void;
  updateTheme: (t: Theme) => void;
  removeTheme: (id: string) => void;
  selectTheme: (id: string) => void;
}

export const useThemeStore: UseBoundStore<...>; // Zustand store, persisted "proton-cal:themes"
```

Consumers select what they need, matching existing call-site style (e.g. `const { customThemes, selectedThemeId, selectTheme } = useThemeStore();`).

## `src/app/providers.tsx`

No exported contract change (still `Providers({ children }): JSX.Element`), but its internal effect changes from reading `useUIStore().darkMode` to:

```ts
const { customThemes, selectedThemeId } = useThemeStore();
const activeTheme = getActiveTheme(customThemes, selectedThemeId);
useEffect(() => {
  const root = document.documentElement;
  root.classList.toggle("dark", activeTheme.mode === "dark");
  const vars = resolveThemeCssVars(activeTheme);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}, [activeTheme.id, activeTheme.mode, activeTheme.accent]);
```

## `src/components/sidebar/ThemeSelector.tsx` (new)

```ts
export interface ThemeSelectorProps {} // no props — reads useThemeStore directly, like the old toggleDark button read useUIStore directly

export function ThemeSelector(): JSX.Element;
```

Renders a `Popover.Root` (Radix) whose trigger replaces the old Sun/Moon toggle button in `Header.tsx`. Popover content:
- One row per `getAllThemes(customThemes)` entry: a swatch (accent color dot), the theme name, a check icon when `theme.id === selectedThemeId`, clicking the row calls `selectTheme(theme.id)`.
- Custom-theme rows additionally show a small edit (pencil) icon button that opens `ThemeEditorDialog` in edit mode for that theme.
- A trailing "+ New theme" row/button that opens `ThemeEditorDialog` in create mode.

## `src/components/sidebar/ThemeEditorDialog.tsx` (new)

```ts
export interface ThemeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing an existing custom theme; absent when creating. */
  theme?: Theme;
}

export function ThemeEditorDialog(props: ThemeEditorDialogProps): JSX.Element;
```

Behavior:
- Fields: Name (`<input>`), Mode (two-button light/dark toggle, à la the existing WebCal/CalDAV type picker in `AddConnectionModal`), Accent (preset swatches + native `<input type="color">`, à la `EventTypeForm`'s `ColorPicker`).
- On save: calls `addTheme(...)` (no `theme` prop) or `updateTheme({ ...theme, ...formState })` (has `theme` prop) from `useThemeStore`.
- When `theme` is provided (edit mode), a "Delete" button is shown, calling `removeTheme(theme.id)` after an inline confirm step (same lightweight pattern as `SettingsPage`'s `deletingTypeId`, without the "used by N" messaging since themes have no cross-references — see spec.md Assumptions).
- Duplicate-name and empty-name validation exactly as described in `data-model.md`.

## `src/components/sidebar/Header.tsx` (modified)

- Removes: `darkMode`, `toggleDark` destructuring from `useUIStore()`; removes the `Sun`/`Moon` toggle `<button>`.
- Adds: `<ThemeSelector />` in the same position (Right section, before the Settings link).
