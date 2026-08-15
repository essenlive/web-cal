"use client";

/**
 * ThemeEditorDialog — create or edit a custom theme (name, base mode, accent
 * color), and delete it. Opened from the sidebar's "Thème" section / ThemesPanel.
 * Modeled after AddConnectionModal (dialog chrome, step layout) and
 * EventTypeForm's color-picker + duplicate-name validation.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ActionButton } from "../ui/action-button";
import { ColorPicker } from "../settings/ColorPicker";
import { PanelHeader } from "../settings/PanelHeader";
import { useThemeStore } from "../../store";
import {
  getAllThemes,
  THEME_ACCENT_PRESETS,
  THEME_RADIUS_PRESETS,
  DEFAULT_BASE_COLORS,
  fontFamilyCssValue,
  loadGoogleFont,
} from "../../lib/theme";
import { GOOGLE_FONTS } from "../../lib/google-fonts";
import type { Theme, ThemeMode } from "../../types";

const BASE_COLOR_FIELDS = [
  { key: "background", label: "Arrière-plan" },
  { key: "card", label: "Carte" },
  { key: "border", label: "Bordure" },
  { key: "muted", label: "Atténué" },
] as const;

export interface ThemeEditorDialogProps {
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
export function ThemeEditorDialog({ theme, onClose }: ThemeEditorDialogProps) {
  const { customThemes, addTheme, updateTheme, removeTheme } = useThemeStore();

  const [name, setName] = useState(theme?.name ?? "");
  const [mode, setMode] = useState<ThemeMode>(theme?.mode ?? "light");
  const [accent, setAccent] = useState(theme?.accent ?? THEME_ACCENT_PRESETS[0]);
  const [fontFamily, setFontFamily] = useState(theme?.fontFamily ?? "DM Sans");
  const [fontQuery, setFontQuery] = useState(theme?.fontFamily ?? "DM Sans");
  const [fontOpen, setFontOpen] = useState(false);
  const [radius, setRadius] = useState(theme?.radius ?? THEME_RADIUS_PRESETS[2].value);
  const defaultBase = DEFAULT_BASE_COLORS[mode];
  const [background, setBackground] = useState(theme?.background ?? defaultBase.background);
  const [card, setCard] = useState(theme?.card ?? defaultBase.card);
  const [border, setBorder] = useState(theme?.border ?? defaultBase.border);
  const [muted, setMuted] = useState(theme?.muted ?? defaultBase.muted);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    loadGoogleFont(fontFamily);
  }, [fontFamily]);

  const fontMatches = useMemo(() => {
    const q = fontQuery.trim().toLowerCase();
    const results = q ? GOOGLE_FONTS.filter((f) => f.family.toLowerCase().includes(q)) : GOOGLE_FONTS;
    return results.slice(0, 8);
  }, [fontQuery]);

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
  const isDuplicate = getAllThemes(customThemes)
    .filter((t) => !theme || t.id !== theme.id)
    .some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !isDuplicate;

  function handleSave() {
    if (!canSave) return;
    const fields = { name: trimmed, mode, accent, fontFamily, radius, background, card, border, muted };
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
        description="Personnalisez le mode clair/sombre, la couleur d'accent, la police et l'arrondi."
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
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                      mode === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {m === "light" ? "Clair" : "Sombre"}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent */}
            <ColorPicker value={accent} onChange={setAccent} colors={THEME_ACCENT_PRESETS} label="Couleur d'accent" />

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
                        "block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted",
                        f.family === fontFamily && "text-primary"
                      )}
                    >
                      {f.family}
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
              <div className="grid grid-cols-4 gap-2">
                {THEME_RADIUS_PRESETS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRadius(r.value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-all",
                      radius === r.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <span className="size-5 border-2 border-current" style={{ borderRadius: r.value }} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {theme && (
                  <ActionButton
                    variant="ghost"
                    onAction={() => {
                      removeTheme(theme.id);
                      onClose();
                    }}
                    confirmChildren={
                      <>
                        <Trash2 size={13} />
                        Confirmer la suppression
                      </>
                    }
                    className="gap-1.5 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 size={13} />
                    Supprimer
                  </ActionButton>
                )}
              </div>
              <Button type="button" onClick={handleSave} disabled={!canSave} className="gap-1.5">
                <Check size={14} />
                {theme ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </div>
    </>
  );
}
