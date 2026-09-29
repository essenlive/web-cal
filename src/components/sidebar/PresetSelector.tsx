"use client";

/**
 * PresetSelector — compact sidebar preview, now a `Section` like Sources/Types/Règles/Thème.
 * Creating and renaming a preset both happen in the drawer (`PresetsPanel`/`PresetForm`,
 * see SettingsDrawer) — this component only lists presets for quick apply/clear, plus a
 * fast inline "sync with current state" action that doesn't rise to the level of "editing".
 */

import { Pencil, RefreshCw, Link } from "lucide-react";
import { toast } from "sonner";
import { Section } from "./Section";
import { ItemRow, ItemBadge } from "./ItemRow";
import { PRESET_COLORS } from "../settings/EventTypeForm";
import { useUIStore, usePresetStore, useConnectionStore, useEventTypeStore, useThemeStore } from "../../store";
import { capturePresetState, presetMatchesState, copyPresetLink } from "../../lib/presets";
import type { Preset } from "../../types";

async function handleCopyLink(id: string) {
  try {
    await copyPresetLink(id);
    toast.success("Lien copié dans le presse-papiers");
  } catch {
    toast.error("Impossible de copier le lien");
  }
}

export function PresetRow({ preset, index, active, onApply, onEdit, onUpdate }: {
  preset: Preset;
  index: number;
  active: boolean;
  onApply: () => void;
  onEdit: () => void;
  onUpdate: () => void;
}) {
  return (
    <ItemRow
      badge={<ItemBadge color={preset.color ?? PRESET_COLORS[index % PRESET_COLORS.length]}>{index + 1}</ItemBadge>}
      name={preset.name}
      selected={active}
      onSelect={onApply}
      actions={[
        { icon: <RefreshCw size={12} />, label: "Mettre à jour avec l'état actuel", onClick: onUpdate },
        { icon: <Link size={12} />, label: "Copier le lien favori", onClick: () => handleCopyLink(preset.id) },
        { icon: <Pencil size={12} />, label: "Modifier", onClick: onEdit },
      ]}
    />
  );
}

export function PresetSelector() {
  const { openDrawer, openNewItemDrawer } = useUIStore();
  const { presets, updatePreset, applyPreset, clearPreset } = usePresetStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { selectedThemeId } = useThemeStore();

  return (
    <Section id="presets" label="Presets" onOpen={() => openDrawer("preset")} onAdd={() => openNewItemDrawer("preset")}>
      {presets.length === 0 && (
        <p className="px-2 text-xs text-muted-foreground">Aucun preset.</p>
      )}
      {presets.map((preset, index) => {
        const active = presetMatchesState(preset, connections, types, selectedThemeId);
        return (
          <PresetRow
            key={preset.id}
            preset={preset}
            index={index}
            active={active}
            onApply={() => (active ? clearPreset() : applyPreset(preset.id))}
            onEdit={() => openDrawer("preset", preset.id)}
            onUpdate={() => updatePreset({ ...preset, ...capturePresetState(connections, types, selectedThemeId) })}
          />
        );
      })}
    </Section>
  );
}
