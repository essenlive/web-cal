"use client";

/**
 * PresetsPanel — list wrapper for the "Presets" drawer: pure management
 * (reorder/edit/delete), same DrawerItemRow as every other section. Applying
 * a preset happens from the sidebar's compact PresetSelector, not here.
 */

import { useState } from "react";
import { usePresetStore, useUIStore } from "../../store";
import { useDragReorder } from "../../hooks/useDragReorder";
import { ItemBadge } from "../sidebar/ItemRow";
import { PRESET_COLORS } from "./EventTypeForm";
import { PresetForm } from "./PresetForm";
import { DrawerItemRow, AddItemButton } from "./DrawerItemRow";
import { PanelHeader, InlineLink } from "./PanelHeader";
import type { Preset } from "../../types";

export function PresetsPanel({ initialEditId, openCreate }: { initialEditId?: string; openCreate?: boolean } = {}) {
  const { openDrawer } = useUIStore();
  const { presets, duplicatePreset, removePreset, reorderPreset } = usePresetStore();
  const { getDragProps } = useDragReorder(presets, (p) => p.id, reorderPreset);

  const initialPreset = initialEditId ? presets.find((p) => p.id === initialEditId) ?? null : null;
  const [formOpen, setFormOpen] = useState(!!initialPreset || !!openCreate);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(initialPreset);

  function back() {
    setFormOpen(false);
    setEditingPreset(null);
  }

  if (formOpen) {
    return (
      <PresetForm
        key={editingPreset?.id ?? "new-preset"}
        preset={editingPreset ?? undefined}
        onDelete={editingPreset ? () => { removePreset(editingPreset.id); back(); } : undefined}
        onClose={back}
      />
    );
  }

  return (
    <>
      <PanelHeader
        title="Presets"
        description={
          <>
            Les presets sont une combinaison de préréglages d&apos;affichage de{" "}
            <InlineLink onClick={() => openDrawer("eventType")}>Types</InlineLink>,{" "}
            <InlineLink onClick={() => openDrawer("connection")}>Sources</InlineLink> et{" "}
            <InlineLink onClick={() => openDrawer("rules")}>Règles</InlineLink>. Ils permettent d&apos;enregistrer
            certains affichages pour des usages particuliers (travail, vacances).
          </>
        }
      />
      <div className="space-y-1.5 px-4 pb-4">
        {presets.length === 0 && <p className="text-xs text-muted-foreground">Aucun preset.</p>}
        {presets.map((preset, index) => (
          <DrawerItemRow
            key={preset.id}
            badge={<ItemBadge color={preset.color ?? PRESET_COLORS[index % PRESET_COLORS.length]}>{index + 1}</ItemBadge>}
            name={preset.name}
            onEdit={() => { setEditingPreset(preset); setFormOpen(true); }}
            onDuplicate={() => duplicatePreset(preset.id)}
            onDelete={() => removePreset(preset.id)}
            dragProps={getDragProps(index)}
          />
        ))}
        <AddItemButton label="Nouveau preset" onClick={() => { setEditingPreset(null); setFormOpen(true); }} />
      </div>
    </>
  );
}
