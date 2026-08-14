"use client";

/**
 * ThemesPanel — list wrapper for the "Thème" drawer, same list/edit composition
 * as the other panels. Built-in themes (Clair/Sombre) are pinned first, get no
 * action buttons at all (can't be edited, deleted, or reordered — they never
 * enter `customThemes`), and are unmanaged; only custom themes are.
 */

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../store";
import { useDragReorder } from "../../hooks/useDragReorder";
import { BUILTIN_THEMES } from "../../lib/theme";
import { ItemBadge } from "../sidebar/ItemRow";
import { ThemeEditorDialog } from "../sidebar/ThemeEditorDialog";
import { DrawerItemRow, AddItemButton } from "./DrawerItemRow";
import { PanelHeader } from "./PanelHeader";
import type { Theme } from "../../types";

function themeBadge(theme: Theme) {
  return <ItemBadge color={theme.accent}>{theme.mode === "dark" ? <Moon size={10} color="#fff" /> : <Sun size={10} color="#fff" />}</ItemBadge>;
}

export function ThemesPanel({ initialEditId, openCreate }: { initialEditId?: string; openCreate?: boolean } = {}) {
  const { customThemes, reorderTheme, removeTheme } = useThemeStore();
  const { getDragProps } = useDragReorder(customThemes, (t) => t.id, reorderTheme);

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
        description="Les thèmes permettent de personnaliser certains réglages de base comme la version claire ou sombre, la police, les arrondis et la couleur d'accroche. Cette personnalisation reste minime pour l'instant. Les thèmes de base ne peuvent ni être modifiés, ni être supprimés."
      />
      <div className="space-y-1.5 px-4 pb-4">
        {BUILTIN_THEMES.map((t) => (
          <DrawerItemRow key={t.id} badge={themeBadge(t)} name={t.name} />
        ))}
        {customThemes.map((t, index) => (
          <DrawerItemRow
            key={t.id}
            badge={themeBadge(t)}
            name={t.name}
            onEdit={() => { setEditingTheme(t); setFormOpen(true); }}
            onDelete={() => removeTheme(t.id)}
            dragProps={getDragProps(index)}
          />
        ))}
        <AddItemButton label="Nouveau thème" onClick={() => { setEditingTheme(null); setFormOpen(true); }} />
      </div>
    </>
  );
}
