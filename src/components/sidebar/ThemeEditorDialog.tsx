"use client";

/**
 * ThemeEditorDialog — create or edit a custom theme (name, base mode, accent
 * color), and delete it. Opened from ThemeSelector. Modeled after
 * AddConnectionModal (dialog chrome, step layout) and EventTypeForm's
 * color-picker + duplicate-name validation.
 */

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { ActionButton } from "../ui/action-button";
import { DrawerHeader, DrawerTitle } from "../ui/drawer";
import { useThemeStore } from "../../store";
import { getAllThemes, THEME_ACCENT_PRESETS } from "../../lib/theme";
import type { Theme, ThemeMode } from "../../types";

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

  const trimmed = name.trim();
  const isDuplicate = getAllThemes(customThemes)
    .filter((t) => !theme || t.id !== theme.id)
    .some((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !isDuplicate;

  function handleSave() {
    if (!canSave) return;
    if (theme) {
      updateTheme({ ...theme, name: trimmed, mode, accent });
    } else {
      addTheme({ name: trimmed, mode, accent });
    }
    onClose();
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>
          {theme ? "Modifier le thème" : "Nouveau thème"}
        </DrawerTitle>
      </DrawerHeader>

      <div className="space-y-4 px-4 pb-4">
            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du thème"
                autoFocus
                className={cn(
                  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2",
                  isDuplicate ? "border-destructive focus:ring-destructive/30" : "border-border focus:ring-primary/30"
                )}
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
                    onClick={() => setMode(m)}
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
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Couleur d'accent</label>
              <div className="flex items-center gap-2 flex-wrap">
                {THEME_ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAccent(c)}
                    className="size-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: accent === c ? "var(--foreground)" : "transparent" }}
                  />
                ))}
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="size-6 rounded cursor-pointer border border-border"
                  aria-label="Couleur personnalisée"
                />
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
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
              >
                <Check size={14} className="inline mr-1.5" />
                {theme ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
    </>
  );
}
