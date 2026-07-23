"use client";

/**
 * PresetSelector — compact sidebar preview, now a `Section` like Sources/Types/Règles/Thème.
 * Creating and renaming a preset both happen in the drawer (`PresetsPanel`/`PresetModal`,
 * see SettingsDrawer) — this component only lists presets for quick apply/clear, plus a
 * fast inline "sync with current state" action that doesn't rise to the level of "editing".
 */

import { Pencil, RefreshCw, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { Section } from "./Section";
import { useUIStore, usePresetStore, useConnectionStore, useEventTypeStore } from "../../store";
import { capturePresetState, presetMatchesState } from "../../lib/presets";
import type { Preset } from "../../types";
import type { DragProps } from "./Sidebar";

export function PresetRow({ preset, active, onApply, onEdit, onUpdate, dragProps }: {
  preset: Preset;
  active: boolean;
  onApply: () => void;
  onEdit: () => void;
  onUpdate: () => void;
  dragProps?: DragProps;
}) {
  return (
    <div
      onClick={onApply}
      {...dragProps}
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer",
        active && "bg-muted"
      )}
    >
      <Check size={12} className={cn("shrink-0 text-primary", !active && "invisible")} />
      <span className="flex-1 min-w-0 truncate text-xs text-foreground">{preset.name}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onUpdate(); }}
        aria-label={`Mettre à jour ${preset.name} avec l'état actuel`}
        title="Mettre à jour avec l'état actuel"
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <RefreshCw size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        aria-label={`Modifier ${preset.name}`}
        title="Modifier"
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}

export function PresetSelector() {
  const { openDrawer } = useUIStore();
  const { presets, updatePreset, applyPreset, clearPreset } = usePresetStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();

  return (
    <Section id="presets" label="Presets" onOpen={() => openDrawer("preset")}>
      {presets.length === 0 && (
        <p className="px-2 text-xs text-muted-foreground">Aucun preset.</p>
      )}
      {presets.map((preset) => {
        const active = presetMatchesState(preset, connections, types);
        return (
          <PresetRow
            key={preset.id}
            preset={preset}
            active={active}
            onApply={() => (active ? clearPreset() : applyPreset(preset.id))}
            onEdit={() => openDrawer("preset", preset.id)}
            onUpdate={() => updatePreset({ ...preset, ...capturePresetState(connections, types) })}
          />
        );
      })}
    </Section>
  );
}
