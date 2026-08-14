"use client";

/**
 * ThemesPanel — list wrapper for the "Thème" drawer, same list/edit composition
 * as the other panels. Built-in themes (Clair/Sombre) are pinned first and
 * excluded from drag-reorder — they never enter `customThemes`.
 */

import { useState } from "react";
import { useThemeStore } from "../../store";
import { useDragReorder } from "../../hooks/useDragReorder";
import { BUILTIN_THEMES } from "../../lib/theme";
import { ThemeRow } from "../sidebar/Sidebar";
import { ThemeEditorDialog } from "../sidebar/ThemeEditorDialog";
import { PanelHeader } from "./PanelHeader";
import type { Theme } from "../../types";

export function ThemesPanel({ initialEditId, openCreate }: { initialEditId?: string; openCreate?: boolean } = {}) {
  const { customThemes, selectedThemeId, selectTheme, reorderTheme } = useThemeStore();
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
      <PanelHeader title="Thème" action={{ label: "Nouveau thème", onClick: () => { setEditingTheme(null); setFormOpen(true); } }} />
      <div className="space-y-1.5 px-4 pb-4">
        {BUILTIN_THEMES.map((t) => (
          <ThemeRow key={t.id} theme={t} active={t.id === selectedThemeId} onSelect={() => selectTheme(t.id)} />
        ))}
        {customThemes.map((t, index) => (
          <ThemeRow
            key={t.id}
            theme={t}
            active={t.id === selectedThemeId}
            onSelect={() => selectTheme(t.id)}
            onEdit={() => { setEditingTheme(t); setFormOpen(true); }}
            dragProps={getDragProps(index)}
          />
        ))}
      </div>
    </>
  );
}
