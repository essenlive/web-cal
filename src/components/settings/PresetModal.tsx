"use client";

/**
 * PresetModal — create/edit a preset's name + description. Visibility state
 * (which connections/event types are hidden) is captured at creation time and,
 * for an existing preset, only re-synced via the explicit "Mettre à jour avec
 * l'état actuel" action — renaming/re-describing a preset never silently
 * changes what it applies.
 */

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { PanelHeader, PanelFooter } from "./PanelHeader";
import { ColorPicker } from "./ColorPicker";
import { PRESET_COLORS } from "./EventTypeModal";
import { usePresetStore, useConnectionStore, useEventTypeStore, useThemeStore } from "../../store";
import { capturePresetState } from "../../lib/presets";
import { getActiveTheme } from "../../lib/theme";
import type { Preset } from "../../types";

export interface PresetModalProps {
  /** Present when editing an existing preset; absent when creating. */
  preset?: Preset;
  /** When set, editing this preset shows a delete button. Omitted when creating. */
  onDelete?: () => void;
  /** Called to dismiss this panel (back-chevron, or after a successful save). */
  onClose: () => void;
}

export function PresetModal({ preset, onDelete, onClose }: PresetModalProps) {
  const { presets, addPreset, updatePreset } = usePresetStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { customThemes, selectedThemeId } = useThemeStore();
  const activeTheme = getActiveTheme(customThemes, selectedThemeId);

  const [name, setName] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [color, setColor] = useState(preset?.color ?? PRESET_COLORS[0]);

  const trimmed = name.trim();
  const isDuplicate = presets
    .filter((p) => !preset || p.id !== preset.id)
    .some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !isDuplicate;

  function handleSave() {
    if (!canSave) return;
    if (preset) {
      updatePreset({ ...preset, name: trimmed, description: description.trim() || undefined, color });
    } else {
      addPreset(trimmed, color, description.trim() || undefined);
    }
    onClose();
  }

  return (
    <>
      <PanelHeader
        title={preset ? "Modifier le preset" : "Nouveau preset"}
        onBack={onClose}
        description="Nommez ce preset — il enregistre l'état actuel des sources et types visibles/masqués, ainsi que le thème actif."
      />

      <div className="space-y-4 px-4 pb-4">
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du preset"
            autoFocus
            className={cn("rounded-xl px-3 py-2 h-auto text-sm", isDuplicate && "border-destructive")}
          />
          {isDuplicate && trimmed.length > 0 && (
            <p className="text-xs text-destructive mt-1">Ce nom est déjà utilisé.</p>
          )}
        </div>

        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optionnel)</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex. Uniquement le calendrier travail"
            rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        <ColorPicker value={color} onChange={setColor} colors={PRESET_COLORS} />

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: activeTheme.accent }}
          />
          Thème actuel : {activeTheme.name}
        </div>

        {preset && (
          <button
            type="button"
            onClick={() => updatePreset({ ...preset, ...capturePresetState(connections, types, selectedThemeId) })}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <RefreshCw size={12} />
            Mettre à jour avec l&apos;état actuel
          </button>
        )}

        <PanelFooter
          onDelete={preset ? onDelete : undefined}
          onCancel={onClose}
          onSave={handleSave}
          saveDisabled={!canSave}
          saveLabel={preset ? "Enregistrer" : "Créer"}
        />
      </div>
    </>
  );
}
