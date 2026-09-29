"use client";

/**
 * ThemesPanel — list wrapper for the "Thème" drawer, same list/edit composition
 * as the other panels. Every theme is editable and reorderable; delete is
 * hidden on the last remaining theme since at least one must always exist.
 */

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../store";
import { useDragReorder } from "../../hooks/useDragReorder";
import { orderThemes } from "../../lib/theme";
import { ItemBadge } from "../sidebar/ItemRow";
import { ThemeEditorDialog } from "../sidebar/ThemeEditorDialog";
import { DrawerItemRow, AddItemButton } from "./DrawerItemRow";
import { Switch } from "../ui/switch";
import { PanelHeader } from "./PanelHeader";
import type { Theme } from "../../types";

function themeBadge(theme: Theme) {
  return <ItemBadge color={theme.accent}>{theme.mode === "dark" ? <Moon size={10} color="#fff" /> : <Sun size={10} color="#fff" />}</ItemBadge>;
}

export function ThemesPanel({ initialEditId, openCreate }: { initialEditId?: string; openCreate?: boolean } = {}) {
  const { customThemes, themeOrder, reorderTheme, addTheme, removeTheme, systemThemes, setSystemThemes } = useThemeStore();
  const themes = orderThemes(customThemes, themeOrder);
  const { getDragProps } = useDragReorder(themes, (t) => t.id, reorderTheme);

  const initialTheme = initialEditId ? customThemes.find((t) => t.id === initialEditId) ?? null : null;
  const [formOpen, setFormOpen] = useState(!!initialTheme || !!openCreate);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(initialTheme);

  function back() {
    setFormOpen(false);
    setEditingTheme(null);
  }

  if (formOpen) {
    return <ThemeEditorDialog key={editingTheme?.id ?? "new-theme"} theme={editingTheme ?? undefined} onClose={back} />;
  }

  return (
    <>
      <PanelHeader
        title="Thème"
        description="Un thème règle le mode clair ou sombre, la couleur d'accent, la police et les arrondis. Au moins un thème doit toujours exister."
      />
      <div className="space-y-1.5 px-4 pb-4">
        <SystemThemeRow themes={themes} value={systemThemes} onChange={setSystemThemes} />
        {themes.map((t, index) => (
          <DrawerItemRow
            key={t.id}
            badge={themeBadge(t)}
            name={t.name}
            onEdit={() => { setEditingTheme(t); setFormOpen(true); }}
            onDuplicate={() => { const { id, ...rest } = t; addTheme({ ...rest, name: `${rest.name} (copie)` }); }}
            onDelete={themes.length > 1 ? () => removeTheme(t.id) : undefined}
            dragProps={getDragProps(index)}
          />
        ))}
        <AddItemButton label="Nouveau thème" onClick={() => { setEditingTheme(null); setFormOpen(true); }} />
      </div>
    </>
  );
}

/** "Suivre le système": pick one theme per OS color scheme; Providers switches between them. */
function SystemThemeRow({ themes, value, onChange }: {
  themes: Theme[];
  value: { light: string; dark: string } | null;
  onChange: (v: { light: string; dark: string } | null) => void;
}) {
  const firstOf = (mode: Theme["mode"]) => (themes.find((t) => t.mode === mode) ?? themes[0]).id;
  const select = "min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs";
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5 mb-3 space-y-2">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span>
          <span className="block text-sm font-medium text-foreground">Suivre le système</span>
          <span className="block text-xs text-muted-foreground">Bascule selon le mode clair/sombre de l&apos;appareil</span>
        </span>
        <Switch
          checked={!!value}
          onCheckedChange={(on) => onChange(on ? { light: firstOf("light"), dark: firstOf("dark") } : null)}
        />
      </label>
      {value && (
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((mode) => (
            <label key={mode} className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
              {mode === "light" ? <Sun size={12} /> : <Moon size={12} />}
              <select className={select} value={value[mode]} onChange={(e) => onChange({ ...value, [mode]: e.target.value })} aria-label={mode === "light" ? "Thème clair" : "Thème sombre"}>
                {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
