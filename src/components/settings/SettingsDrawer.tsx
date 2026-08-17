"use client";

/**
 * SettingsDrawer — single shell for every settings surface (Preferences,
 * Connections, Event Types, Rules, Theme). Which panel shows is driven by
 * `useUIStore().activeDrawer`; opening a different panel replaces this
 * drawer's content instead of stacking a second one (spec FR-005).
 */

import { Drawer, DrawerContent } from "../ui/drawer";
import { useUIStore } from "../../store";
import { ConnectionsPanel } from "./ConnectionsPanel";
import { EventTypesPanel } from "./EventTypesPanel";
import { RulesPanel } from "../../views/RulesPage";
import { ThemesPanel } from "./ThemesPanel";
import { PresetsPanel } from "../sidebar/PresetsPanel";
import { PreferencesPanel } from "../../views/SettingsPage";
import { ShortcutsPanel } from "../sidebar/ShortcutsHelp";

export function SettingsDrawer() {
  const { activeDrawer, closeDrawer } = useUIStore();

  return (
    <Drawer direction="right" open={activeDrawer !== null} onOpenChange={(v) => { if (!v) closeDrawer(); }}>
      <DrawerContent className="overflow-y-auto overscroll-contain" aria-describedby={undefined}>
        {activeDrawer?.panel === "connection" && <ConnectionsPanel initialEditId={activeDrawer.editId} openCreate={activeDrawer.create} />}

        {activeDrawer?.panel === "eventType" && <EventTypesPanel initialEditId={activeDrawer.editId} openCreate={activeDrawer.create} />}

        {activeDrawer?.panel === "rules" && <RulesPanel initialEditRuleId={activeDrawer.editId} openCreate={activeDrawer.create} />}

        {activeDrawer?.panel === "theme" && <ThemesPanel initialEditId={activeDrawer.editId} openCreate={activeDrawer.create} />}

        {activeDrawer?.panel === "preset" && <PresetsPanel initialEditId={activeDrawer.editId} openCreate={activeDrawer.create} />}

        {activeDrawer?.panel === "preferences" && <PreferencesPanel />}

        {activeDrawer?.panel === "shortcuts" && <ShortcutsPanel />}
      </DrawerContent>
    </Drawer>
  );
}
