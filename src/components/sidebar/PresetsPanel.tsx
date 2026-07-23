"use client";

/**
 * PresetsPanel — list wrapper for the "Presets" drawer. Uses its own row (not
 * the compact sidebar PresetRow) since the description needs room to show —
 * same reasoning RulesPanel has its own richer RuleRow.
 */

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { usePresetStore, useConnectionStore, useEventTypeStore } from "../../store";
import { useDragReorder } from "../../hooks/useDragReorder";
import { presetMatchesState } from "../../lib/presets";
import { PresetModal } from "../settings/PresetModal";
import { PanelHeader } from "../settings/PanelHeader";
import type { Preset } from "../../types";
import type { DragProps } from "./Sidebar";

function PresetListRow({ preset, active, onApply, onEdit, dragProps }: {
  preset: Preset; active: boolean; onApply: () => void; onEdit: () => void; dragProps?: DragProps;
}) {
  return (
    <div
      onClick={onApply}
      {...dragProps}
      className={cn(
        "group flex items-start gap-2 rounded-lg border border-border px-3 py-2 bg-card cursor-pointer",
        active && "border-primary"
      )}
    >
      <Check size={14} className={cn("shrink-0 mt-0.5 text-primary", !active && "invisible")} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground truncate">{preset.name}</div>
        {preset.description && <div className="text-xs text-muted-foreground truncate">{preset.description}</div>}
      </div>
      <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-xs font-medium text-primary hover:underline shrink-0">
        Modifier
      </button>
    </div>
  );
}

export function PresetsPanel({ initialEditId }: { initialEditId?: string } = {}) {
  const { presets, applyPreset, clearPreset, removePreset, reorderPreset } = usePresetStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { getDragProps } = useDragReorder(presets, (p) => p.id, reorderPreset);

  const initialPreset = initialEditId ? presets.find((p) => p.id === initialEditId) ?? null : null;
  const [formOpen, setFormOpen] = useState(!!initialPreset);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(initialPreset);

  function back() {
    setFormOpen(false);
    setEditingPreset(null);
  }

  if (formOpen) {
    return (
      <PresetModal
        key={editingPreset?.id ?? "new-preset"}
        preset={editingPreset ?? undefined}
        onDelete={editingPreset ? () => { removePreset(editingPreset.id); back(); } : undefined}
        onClose={back}
      />
    );
  }

  return (
    <>
      <PanelHeader title="Presets" action={{ label: "Nouveau preset", onClick: () => { setEditingPreset(null); setFormOpen(true); } }} />
      <div className="space-y-1.5 px-4 pb-4">
        {presets.length === 0 && <p className="text-xs text-muted-foreground">Aucun preset.</p>}
        {presets.map((preset, index) => {
          const active = presetMatchesState(preset, connections, types);
          return (
            <PresetListRow
              key={preset.id}
              preset={preset}
              active={active}
              onApply={() => (active ? clearPreset() : applyPreset(preset.id))}
              onEdit={() => { setEditingPreset(preset); setFormOpen(true); }}
              dragProps={getDragProps(index)}
            />
          );
        })}
      </div>
    </>
  );
}
