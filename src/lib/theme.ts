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

import type { Theme, ThemePattern } from "../types";
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

// ── Default themes ────────────────────────────────────────────────────────────

/**
 * The two themes useThemeStore.customThemes is seeded with — on first load,
 * and again for any user who deletes/renames every theme down to none (the
 * store never allows removing the very last one, so this is also the "reset"
 * state). Like any theme, these are fully editable/renamable/deletable once
 * seeded. Accent values match the app's pre-existing default primary
 * hue/saturation/lightness (hsl(234 89% 60%) / hsl(234 89% 65%)) converted to
 * hex, so they render identically to the app's original (pre-theming) light/
 * dark appearance.
 */
export const BUILTIN_THEMES: Theme[] = [
  { id: "light", name: "Clair",  mode: "light", accent: "#3e50f4", fontFamily: "DM Sans", radius: "0.75rem" },
  { id: "dark",  name: "Sombre", mode: "dark",  accent: "#5666f5", fontFamily: "DM Sans", radius: "0.75rem" },
];

// ── Lookups ────────────────────────────────────────────────────────────────────

/** Sorts themes by a persisted id order (useThemeStore.themeOrder), appending any id missing from `order` — e.g. a just-created theme — at the end in its natural position. */
export function orderThemes(themes: Theme[], order: string[]): Theme[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...themes].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

/** Resolves the active theme by id, falling back to the default "Clair" theme (FR-011). */
export function getActiveTheme(customThemes: Theme[], selectedThemeId: string): Theme {
  return customThemes.find((t) => t.id === selectedThemeId) ?? BUILTIN_THEMES[0];
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
  "--pattern": string;
  "--pattern-size": string;
}

/** Ink for the theme's own pattern: its foreground (near-black on light, near-white on dark) at
 *  low opacity — black-and-white and subtle whatever the accent. */
const INK = "hsl(var(--foreground) / 0.07)";

/** Background textures, drawn in any `ink` color: the theme's (via .bg-pattern, globals.css) or a
 *  display type's own color (via patternStyle). */
export const THEME_PATTERNS: { value: ThemePattern; label: string; image: (ink: string) => string; size: string }[] = [
  { value: "none",     label: "Aucun",      image: () => "none", size: "auto" },
  { value: "dots",     label: "Points",     image: (ink) => `radial-gradient(${ink} 1px, transparent 1.5px)`, size: "14px 14px" },
  { value: "grid",     label: "Grille",     image: (ink) => `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`, size: "24px 24px" },
  { value: "diagonal", label: "Diagonales", image: (ink) => `repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px 9px)`, size: "auto" },
  { value: "ruled",    label: "Lignes",     image: (ink) => `linear-gradient(${ink} 1px, transparent 1px)`, size: "100% 22px" },
];

/** A display type's pattern, in its own color at ~35% alpha — on top of the "background" style's tint. */
export function typePatternStyle(type: { pattern?: ThemePattern; color: string } | undefined) {
  return type ? patternStyle(type.pattern, type.color + "59") : {};
}

/** Inline style drawing `pattern` in `ink` — {} for none/unset, so it can be spread unconditionally. */
export function patternStyle(pattern: ThemePattern | undefined, ink: string): { backgroundImage?: string; backgroundSize?: string } {
  const p = THEME_PATTERNS.find((x) => x.value === pattern);
  if (!p || p.value === "none") return {};
  return { backgroundImage: p.image(ink), backgroundSize: p.size };
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
  const pattern = THEME_PATTERNS.find((p) => p.value === theme.pattern) ?? THEME_PATTERNS[0];
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
    "--pattern": pattern.image(INK),
    "--pattern-size": pattern.size,
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

/** Softer row under the vivid one: same hues, half the saturation. resolveThemeCssVars keeps
 *  only hue + saturation, so these render as a genuinely calmer primary, not a lighter one. */
export const THEME_ACCENT_SOFT_PRESETS = THEME_ACCENT_PRESETS.map((hex) => {
  const { h, s } = hexToHsl(hex);
  return hslToHex(h, Math.round(s / 2), 65);
});

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

/**
 * Preset border-radius scale offered in ThemeEditorDialog. Every rounded-*
 * utility in the app (sm/md/lg/xl/2xl/3xl) derives from this single value
 * via globals.css's @theme block, so picking a tier here consistently
 * affects badges, inputs, buttons, cards and dialogs alike — not just the
 * elements that happen to use rounded-lg.
 */
export const THEME_RADIUS_PRESETS: { label: string; value: string }[] = [
  { label: "Aucun", value: "0rem" },
  { label: "Discret", value: "0.375rem" },
  { label: "Complet", value: "0.75rem" },
];
