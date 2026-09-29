"use client";

/**
 * PresetModal — create/edit a preset's name, description, and color.
 * Visibility state (which connections/event types are hidden) and the active
 * theme are captured at creation time and never silently changed afterward.
 */

import { useState } from "react";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { PanelHeader, PanelFooter } from "./PanelHeader";
import { ColorPicker } from "./ColorPicker";
import { PRESET_COLORS } from "./EventTypeModal";
import { usePresetStore } from "../../store";
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
