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
  { id: "light", name: "Light", mode: "light", accent: "#3e50f4" },
  { id: "dark",  name: "Dark",  mode: "dark",  accent: "#5666f5" },
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
}

/**
 * Derives the 5 CSS custom property overrides for a theme. Only hue and
 * saturation come from the picked accent color; lightness values are the
 * app's existing per-mode design constants (see research.md Decision 1).
 * `--accent`'s saturation in dark mode stays fixed at 40% (matching the
 * existing hand-tuned dark palette) rather than following the picked
 * saturation, so highly saturated accent picks don't overwhelm dark-mode
 * accent surfaces.
 */
export function resolveThemeCssVars(theme: Theme): ThemeCssVars {
  const { h, s } = hexToHsl(theme.accent);

  if (theme.mode === "dark") {
    return {
      "--primary": `${h} ${s}% 65%`,
      "--primary-foreground": "0 0% 100%",
      "--accent": `${h} 40% 18%`,
      "--accent-foreground": `${h} ${s}% 75%`,
      "--ring": `${h} ${s}% 65%`,
    };
  }

  return {
    "--primary": `${h} ${s}% 60%`,
    "--primary-foreground": "0 0% 100%",
    "--accent": `${h} ${s}% 96%`,
    "--accent-foreground": `${h} ${s}% 40%`,
    "--ring": `${h} ${s}% 60%`,
  };
}

/** Preset accent swatches offered in ThemeEditorDialog, matching the palette used elsewhere (SettingsPage, AddConnectionModal). */
export const THEME_ACCENT_PRESETS = [
  "#6366f1", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#14b8a6", "#06b6d4", "#64748b",
];
