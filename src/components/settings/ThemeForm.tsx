"use client";

/**
 * ThemeForm — create or edit a custom theme (name, base mode, accent
 * color), and delete it. Opened from the sidebar's "Thème" section / ThemesPanel.
 * Modeled after ConnectionForm (dialog chrome, step layout) and
 * EventTypeForm's color-picker + duplicate-name validation.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { choiceClass, cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { ColorPicker } from "./ColorPicker";
import { PatternPicker } from "./PatternPicker";
import { PanelHeader, PanelFooter } from "./PanelHeader";
import { useThemeStore } from "../../store";
import {
  THEME_ACCENT_PRESETS,
  THEME_ACCENT_SOFT_PRESETS,
  THEME_RADIUS_PRESETS,
  DEFAULT_BASE_COLORS,
  fontFamilyCssValue,
  loadGoogleFont,
} from "../../lib/theme";
import { GOOGLE_FONTS } from "../../lib/google-fonts";
import type { Theme, ThemeMode, ThemePattern } from "../../types";

const FONT_SAMPLE = "Réunion d'équipe · 14:30 — lun. 12 oct.";

const BASE_COLOR_FIELDS = [
  { key: "background", label: "Arrière-plan" },
  { key: "card", label: "Carte" },
  { key: "border", label: "Bordure" },
  { key: "muted", label: "Atténué" },
] as const;

export interface ThemeFormProps {
  /** Present when editing an existing custom theme; absent when creating. */
  theme?: Theme;
  /** Called to dismiss this panel (Cancel/X, or after a successful save/delete). */
  onClose: () => void;
}

/**
 * Form state is initialized lazily from `theme` and never reset via an effect —
 * SettingsDrawer remounts this component (via `key`) each time it's opened for a
 * new create/edit session, so fresh initial state is simply what mounting gives us.
 */
export function ThemeForm({ theme, onClose }: ThemeFormProps) {
  const { customThemes, addTheme, updateTheme, removeTheme, setPreviewTheme } = useThemeStore();

  const [name, setName] = useState(theme?.name ?? "");
  const [mode, setMode] = useState<ThemeMode>(theme?.mode ?? "light");
  const [accent, setAccent] = useState(theme?.accent ?? THEME_ACCENT_PRESETS[0]);
  const [fontFamily, setFontFamily] = useState(theme?.fontFamily ?? "DM Sans");
  const [fontQuery, setFontQuery] = useState(theme?.fontFamily ?? "DM Sans");
  const [fontOpen, setFontOpen] = useState(false);
  const [radius, setRadius] = useState(theme?.radius ?? THEME_RADIUS_PRESETS[2].value);
  const [pattern, setPattern] = useState<ThemePattern>(theme?.pattern ?? "none");
  const defaultBase = DEFAULT_BASE_COLORS[mode];
  const [background, setBackground] = useState(theme?.background ?? defaultBase.background);
  const [card, setCard] = useState(theme?.card ?? defaultBase.card);
  const [border, setBorder] = useState(theme?.border ?? defaultBase.border);
  const [muted, setMuted] = useState(theme?.muted ?? defaultBase.muted);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    loadGoogleFont(fontFamily);
  }, [fontFamily]);

  // Live preview: the whole app wears the draft while this form is open; unmounting (save,
  // cancel, back, closing the drawer) drops it and the selected theme comes back.
  useEffect(() => {
    setPreviewTheme({ id: theme?.id ?? "preview", name, mode, accent, fontFamily, radius, pattern, background, card, border, muted });
  }, [setPreviewTheme, theme?.id, name, mode, accent, fontFamily, radius, pattern, background, card, border, muted]);
  useEffect(() => () => setPreviewTheme(null), [setPreviewTheme]);

  const fontMatches = useMemo(() => {
    // The box shows the chosen family; until the user types something else, list everything.
    const q = fontQuery === fontFamily ? "" : fontQuery.trim().toLowerCase();
    const results = q ? GOOGLE_FONTS.filter((f) => f.family.toLowerCase().includes(q)) : GOOGLE_FONTS;
    return results.slice(0, 8);
  }, [fontQuery, fontFamily]);

  // Load every suggested family so the dropdown shows each one in its own face, not a fallback.
  useEffect(() => {
    if (fontOpen) fontMatches.forEach((f) => loadGoogleFont(f.family));
  }, [fontOpen, fontMatches]);

  /**
   * Base-color defaults differ wildly between light/dark (e.g. near-white vs
   * near-black background) — switching mode always resets the four base
   * colors to that mode's defaults so a mode flip can never leave a saved
   * theme with light-mode colors applied under `.dark` (or vice versa).
   */
  function handleModeChange(m: ThemeMode) {
    setMode(m);
    const d = DEFAULT_BASE_COLORS[m];
    setBackground(d.background);
    setCard(d.card);
    setBorder(d.border);
    setMuted(d.muted);
  }

  const trimmed = name.trim();
  const isDuplicate = customThemes
    .filter((t) => !theme || t.id !== theme.id)
    .some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !isDuplicate;

  function handleSave() {
    if (!canSave) return;
    const fields = { name: trimmed, mode, accent, fontFamily, radius, pattern, background, card, border, muted };
    if (theme) {
      updateTheme({ ...theme, ...fields });
    } else {
      addTheme(fields);
    }
    onClose();
  }

  return (
    <>
      <PanelHeader
        title={theme ? "Modifier le thème" : "Nouveau thème"}
        onBack={onClose}
        description="Les changements s'appliquent en direct à toute l'application ; enregistrez pour les garder."
      />

      <div className="space-y-4 px-4 pb-4">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du thème"
                autoFocus
                className={cn("rounded-xl px-3 py-2 h-auto text-sm", isDuplicate && "border-destructive")}
              />
              {isDuplicate && trimmed.length > 0 && (
                <p className="text-xs text-destructive mt-1">Ce nom est déjà utilisé.</p>
              )}
            </div>

            {/* Mode */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {(["light", "dark"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModeChange(m)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium",
                      choiceClass(mode === m)
                    )}
                  >
                    {m === "light" ? "Clair" : "Sombre"}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent */}
            <ColorPicker value={accent} onChange={setAccent} colors={THEME_ACCENT_PRESETS} softColors={THEME_ACCENT_SOFT_PRESETS} label="Couleur d'accent" />

            {/* Font */}
            <div className="relative">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Police</label>
              <div className="flex items-center gap-2">
                <Input
                  value={fontQuery}
                  onChange={(e) => { setFontQuery(e.target.value); setFontOpen(true); }}
                  onFocus={() => setFontOpen(true)}
                  onBlur={() => setTimeout(() => setFontOpen(false), 150)}
                  placeholder="Rechercher une police…"
                  className="rounded-xl px-3 py-2 h-auto text-sm"
                />
                <span
                  className="shrink-0 text-lg text-muted-foreground w-9 text-center"
                  style={{ fontFamily: fontFamilyCssValue(fontFamily) }}
                >
                  Aa
                </span>
              </div>
              <p className="mt-1.5 truncate text-sm text-muted-foreground" style={{ fontFamily: fontFamilyCssValue(fontFamily) }}>
                {FONT_SAMPLE}
              </p>
              {fontOpen && fontMatches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
                  {fontMatches.map((f) => (
                    <button
                      key={f.family}
                      type="button"
                      onClick={() => {
                        setFontFamily(f.family);
                        setFontQuery(f.family);
                        setFontOpen(false);
                        loadGoogleFont(f.family);
                      }}
                      style={{ fontFamily: fontFamilyCssValue(f.family) }}
                      className={cn(
                        "block w-full px-3 py-2 text-left hover:bg-muted",
                        f.family === fontFamily && "text-primary"
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm">{f.family}</span>
                        <span className="shrink-0 font-sans text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-sans)" }}>{f.category}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{FONT_SAMPLE}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Base colors — behind an accordion, same "Avancé" pattern as the connection form's proxy field */}
            <div>
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {advancedOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Avancé — couleurs personnalisées
              </button>
              {advancedOpen && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {BASE_COLOR_FIELDS.map(({ key, label }) => {
                    const value = { background, card, border, muted }[key];
                    const setValue = { background: setBackground, card: setCard, border: setBorder, muted: setMuted }[key];
                    return (
                      <div key={key} className="flex flex-col items-center gap-1">
                        <input
                          type="color"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          className="size-8 rounded cursor-pointer border border-border"
                          aria-label={label}
                        />
                        <span className="text-[10px] text-muted-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Radius */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Arrondi</label>
              <div className="grid grid-cols-3 gap-2">
                {THEME_RADIUS_PRESETS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRadius(r.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg px-2 py-2 text-xs",
                      choiceClass(radius === r.value)
                    )}
                  >
                    <span className="size-5 border-2 border-current" style={{ borderRadius: r.value }} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background pattern — tiles use stronger ink than the real 0.07 so the texture reads at tile size */}
            <PatternPicker value={pattern} onChange={setPattern} ink="hsl(var(--foreground) / 0.3)" />

            <PanelFooter
              onDelete={theme && customThemes.length > 1 ? () => { removeTheme(theme.id); onClose(); } : undefined}
              onCancel={onClose}
              onSave={handleSave}
              saveDisabled={!canSave}
              saveLabel={theme ? "Enregistrer" : "Créer"}
            />
          </div>
    </>
  );
}
