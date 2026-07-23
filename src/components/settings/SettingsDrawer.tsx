"use client";

/**
 * SettingsDrawer — single shell for every settings surface (Preferences,
 * Connections, Event Types, Rules, Theme). Which panel shows is driven by
 * `useUIStore().activeDrawer`; opening a different panel replaces this
 * drawer's content instead of stacking a second one (spec FR-005).
 */

import { Drawer, DrawerContent } from "../ui/drawer";
import { useUIStore, useConnectionStore, useEventTypeStore, useThemeStore } from "../../store";
import { AddConnectionModal } from "./AddConnectionModal";
import { EventTypeModal } from "./EventTypeModal";
import { RulesPanel } from "../../views/RulesPage";
import { ThemeEditorDialog } from "../sidebar/ThemeEditorDialog";
import { PreferencesPanel } from "../../views/SettingsPage";
import { ShortcutsPanel } from "../sidebar/ShortcutsHelp";
import type { EventType } from "../../types";

export function SettingsDrawer() {
  const { activeDrawer, closeDrawer } = useUIStore();
  const { connections, addConnection, updateConnection, removeConnection } = useConnectionStore();
  const { types, addType, updateType, removeType, setDefaultType } = useEventTypeStore();
  const { customThemes } = useThemeStore();

  const editingConn = activeDrawer?.panel === "connection"
    ? connections.find((c) => c.id === activeDrawer.editId)
    : undefined;
  const editingType = activeDrawer?.panel === "eventType"
    ? types.find((t) => t.id === activeDrawer.editId)
    : undefined;
  const editingTheme = activeDrawer?.panel === "theme"
    ? customThemes.find((t) => t.id === activeDrawer.editId)
    : undefined;

  return (
    <Drawer direction="right" open={activeDrawer !== null} onOpenChange={(v) => { if (!v) closeDrawer(); }}>
      <DrawerContent className="overflow-y-auto" aria-describedby={undefined}>
        {activeDrawer?.panel === "connection" && (
          <AddConnectionModal
            key={activeDrawer.editId ?? "new-conn"}
            connection={editingConn}
            existingColors={connections.map((c) => c.color)}
            onAdd={addConnection}
            onUpdate={updateConnection}
            onDelete={editingConn ? () => { removeConnection(editingConn.id); closeDrawer(); } : undefined}
            onClose={closeDrawer}
          />
        )}

        {activeDrawer?.panel === "eventType" && (
          <EventTypeModal
            key={activeDrawer.editId ?? "new-type"}
            type={editingType}
            existingLabels={types.map((t) => t.label)}
            onSave={(t) => {
              if (t.id) {
                updateType(t as EventType);
                if (t.isDefault) setDefaultType(t.id);
              } else {
                addType(t);
              }
            }}
            onDelete={editingType ? () => { removeType(editingType.id); closeDrawer(); } : undefined}
            deleteDisabledReason={editingType?.isDefault ? "Le type par défaut ne peut pas être supprimé — définissez d'abord un autre type par défaut" : undefined}
            onClose={closeDrawer}
          />
        )}

        {activeDrawer?.panel === "rules" && <RulesPanel />}

        {activeDrawer?.panel === "theme" && (
          <ThemeEditorDialog
            key={activeDrawer.editId ?? "new-theme"}
            theme={editingTheme}
            onClose={closeDrawer}
          />
        )}

        {activeDrawer?.panel === "preferences" && <PreferencesPanel />}

        {activeDrawer?.panel === "shortcuts" && <ShortcutsPanel />}
      </DrawerContent>
    </Drawer>
  );
}
