/**
 * Theme resolution helpers.
 *
 * A Theme is a name + base mode (light/dark) + a single accent hex color.
 * Applying a theme means: (1) toggling the existing `.dark` class on <html>
 * for the base mode, and (2) overriding the app's existing --primary/--accent/
 * --ring CSS custom properties (defined in src/app/globals.css) by re-deriving
 * their hue+saturation from the picked accent color while keeping the exact
 * lightness values the design already uses per token per mode. See
 * specs/005-global-theming/research.md (Decision 1) for the full rationale.
 */

import type { Theme } from "../types";
import { GOOGLE_FONTS } from "./google-fonts";

// ── Hex <-> HSL ────────────────────────────────────────────────────────────────

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };

  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d) % 6; break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4; break;
  }
  h *= 60;
  if (h < 0) h += 360;

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// ── Built-in themes ────────────────────────────────────────────────────────────

/**
 * "light"/"dark" ids are reserved: never editable/deletable, never stored in
 * useThemeStore.customThemes. Accent values match the app's pre-existing
 * default primary hue/saturation/lightness (hsl(234 89% 60%) / hsl(234 89% 65%))
 * converted to hex, so the built-ins render identically to the app's original
 * (pre-theming) light/dark appearance.
 */
export const BUILTIN_THEMES: Theme[] = [
  { id: "light", name: "Clair",  mode: "light", accent: "#3e50f4", fontFamily: "DM Sans", radius: "0.75rem" },
  { id: "dark",  name: "Sombre", mode: "dark",  accent: "#5666f5", fontFamily: "DM Sans", radius: "0.75rem" },
];

const BUILTIN_IDS = new Set(BUILTIN_THEMES.map((t) => t.id));

export function isBuiltinTheme(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

// ── Lookups ────────────────────────────────────────────────────────────────────

export function getAllThemes(customThemes: Theme[]): Theme[] {
  return [...BUILTIN_THEMES, ...customThemes];
}

/** Resolves the active theme by id, falling back to the built-in "Light" theme (FR-011). */
export function getActiveTheme(customThemes: Theme[], selectedThemeId: string): Theme {
  return getAllThemes(customThemes).find((t) => t.id === selectedThemeId) ?? BUILTIN_THEMES[0];
}

// ── CSS variable resolution ──────────────────────────────────────────────────────

export interface ThemeCssVars {
  "--primary": string;
  "--primary-foreground": string;
  "--accent": string;
  "--accent-foreground": string;
  "--ring": string;
  "--font-sans": string;
  "--radius": string;
  "--background": string;
  "--card": string;
  "--popover": string;
  "--border": string;
  "--input": string;
  "--muted": string;
  "--secondary": string;
}

const DEFAULT_RADIUS = "0.75rem";

/** Per-mode defaults for the base-color pickers, derived from the app's original hand-tuned HSL constants (src/app/globals.css). */
export const DEFAULT_BASE_COLORS: Record<Theme["mode"], { background: string; card: string; border: string; muted: string }> = {
  light: {
    background: hslToHex(0, 0, 98),
    card: hslToHex(0, 0, 100),
    border: hslToHex(220, 13, 90),
    muted: hslToHex(220, 14, 94),
  },
  dark: {
    background: hslToHex(224, 20, 9),
    card: hslToHex(224, 18, 12),
    border: hslToHex(224, 15, 18),
    muted: hslToHex(224, 15, 16),
  },
};

function hexToHslString(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return `${h} ${s}% ${l}%`;
}

/**
 * Derives the CSS custom property overrides for a theme. Accent hue/saturation
 * drive --primary/--accent/--ring, keeping the app's existing per-mode
 * lightness constants (see research.md Decision 1); --accent's saturation in
 * dark mode stays fixed at 40% so highly saturated accent picks don't
 * overwhelm dark-mode accent surfaces. background/card/border/muted each fall
 * back to DEFAULT_BASE_COLORS[mode] when unset; --popover mirrors card and
 * --input/--secondary mirror border/muted, matching how those pairs already
 * share a single value in globals.css. fontFamily/radius fall back to the
 * app's original defaults for themes persisted before those fields existed.
 */
export function resolveThemeCssVars(theme: Theme): ThemeCssVars {
  const { h, s } = hexToHsl(theme.accent);
  const defaults = DEFAULT_BASE_COLORS[theme.mode];
  const shared = {
    "--font-sans": fontFamilyCssValue(theme.fontFamily ?? "DM Sans"),
    "--radius": theme.radius ?? DEFAULT_RADIUS,
    "--background": hexToHslString(theme.background ?? defaults.background),
    "--card": hexToHslString(theme.card ?? defaults.card),
    "--popover": hexToHslString(theme.card ?? defaults.card),
    "--border": hexToHslString(theme.border ?? defaults.border),
    "--input": hexToHslString(theme.border ?? defaults.border),
    "--muted": hexToHslString(theme.muted ?? defaults.muted),
    "--secondary": hexToHslString(theme.muted ?? defaults.muted),
  };

  if (theme.mode === "dark") {
    return {
      "--primary": `${h} ${s}% 65%`,
      "--primary-foreground": "0 0% 100%",
      "--accent": `${h} 40% 18%`,
      "--accent-foreground": `${h} ${s}% 75%`,
      "--ring": `${h} ${s}% 65%`,
      ...shared,
    };
  }

  return {
    "--primary": `${h} ${s}% 60%`,
    "--primary-foreground": "0 0% 100%",
    "--accent": `${h} ${s}% 96%`,
    "--accent-foreground": `${h} ${s}% 40%`,
    "--ring": `${h} ${s}% 60%`,
    ...shared,
  };
}

/** Preset accent swatches offered in ThemeEditorDialog, matching the palette used elsewhere (SettingsPage, AddConnectionModal). */
export const THEME_ACCENT_PRESETS = [
  "#6366f1", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#14b8a6", "#06b6d4", "#64748b",
];

// ── Fonts ──────────────────────────────────────────────────────────────────────

/**
 * `Theme.fontFamily` is a plain Google Fonts family name (e.g. "Roboto").
 * Themes saved before this field existed may instead hold a full CSS
 * font-family stack (e.g. "'DM Sans', sans-serif") — this strips that down
 * to just the family name so both formats resolve the same way.
 */
function rawFamilyName(input: string): string {
  return input.includes(",") ? input.split(",")[0].replace(/['"]/g, "").trim() : input;
}

/** Builds the `font-family` CSS value for a Google Fonts family name, with a category-appropriate generic fallback. */
export function fontFamilyCssValue(rawFamily: string): string {
  const family = rawFamilyName(rawFamily);
  const entry = GOOGLE_FONTS.find((f) => f.family === family);
  return `'${family}', ${entry?.category ?? "sans-serif"}`;
}

const loadedFonts = new Set(["DM Sans", "DM Mono"]); // preloaded statically in globals.css

/** Injects a <link> for the given Google Fonts family the first time it's needed (search preview or applying a theme). No-ops on the server and for already-loaded families. */
export function loadGoogleFont(rawFamily: string): void {
  if (typeof document === "undefined") return;
  const family = rawFamilyName(rawFamily);
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
  document.head.appendChild(link);
}

/** Preset border-radius scale offered in ThemeEditorDialog. */
export const THEME_RADIUS_PRESETS: { label: string; value: string }[] = [
  { label: "Aucun", value: "0rem" },
  { label: "Discret", value: "0.375rem" },
  { label: "Défaut", value: "0.75rem" },
  { label: "Arrondi", value: "1.25rem" },
];
