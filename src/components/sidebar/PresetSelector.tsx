"use client";

/**
 * PresetSelector — a plain always-visible sidebar section (like the existing
 * "Sources"/"Types" sections), not a popover/dialog: presets have only one
 * editable field (name) and are meant to be a frequent action, so they stay
 * one glance and one click away. See specs/006-view-presets/research.md
 * (Decisions 3 and 5).
 */

import { useState } from "react";
import { Plus, Pencil, RefreshCw, Trash2, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { usePresetStore, useConnectionStore, useEventTypeStore } from "../../store";
import { capturePresetState, presetMatchesState } from "../../lib/presets";
import type { Preset } from "../../types";

function PresetRow({
  preset,
  presets,
  active,
  onApply,
  onRename,
  onUpdate,
  onDelete,
}: {
  preset: Preset;
  presets: Preset[];
  active: boolean;
  onApply: () => void;
  onRename: (name: string) => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(preset.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const trimmed = name.trim();
  const isDuplicate = presets.some(
    (p) => p.id !== preset.id && p.name.trim().toLowerCase() === trimmed.toLowerCase()
  );

  function commitRename() {
    if (trimmed.length === 0 || isDuplicate) {
      cancelRename();
      return;
    }
    onRename(trimmed);
    setRenaming(false);
  }

  function cancelRename() {
    setName(preset.name);
    setRenaming(false);
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDelete();
  }

  if (renaming) {
    return (
      <div className="px-2 py-1">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") cancelRename();
          }}
          onBlur={cancelRename}
          className={cn(
            "w-full rounded-md border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-2",
            isDuplicate ? "border-destructive focus:ring-destructive/30" : "border-border focus:ring-primary/30"
          )}
        />
        {isDuplicate && trimmed.length > 0 && (
          <p className="text-[11px] text-destructive mt-1">Ce nom est déjà utilisé.</p>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onApply}
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer",
        active && "bg-muted"
      )}
    >
      <Check size={12} className={cn("shrink-0 text-primary", !active && "invisible")} />
      <span className="flex-1 min-w-0 truncate text-xs text-foreground">{preset.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setRenaming(true);
        }}
        aria-label={`Renommer ${preset.name}`}
        title="Renommer"
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUpdate();
        }}
        aria-label={`Mettre à jour ${preset.name} avec l'état actuel`}
        title="Mettre à jour avec l'état actuel"
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <RefreshCw size={12} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
        }}
        aria-label={confirmingDelete ? `Confirmer la suppression de ${preset.name}` : `Supprimer ${preset.name}`}
        title={confirmingDelete ? "Confirmer la suppression" : "Supprimer"}
        className={cn(
          "p-1 rounded-md shrink-0 transition-colors focus-visible:opacity-100",
          confirmingDelete
            ? "bg-destructive text-destructive-foreground opacity-100"
            : "text-muted-foreground hover:text-destructive hover:bg-background opacity-0 group-hover:opacity-100"
        )}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function PresetSelector() {
  const { presets, addPreset, updatePreset, removePreset, applyPreset, clearPreset } = usePresetStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [pendingOverwriteId, setPendingOverwriteId] = useState<string | null>(null);

  function startAdd() {
    setAdding(true);
    setNewName("");
    setPendingOverwriteId(null);
  }

  function cancelAdd() {
    setAdding(false);
    setNewName("");
    setPendingOverwriteId(null);
  }

  function commitAdd() {
    const trimmed = newName.trim();
    if (trimmed.length === 0) return;
    const match = presets.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      addPreset(trimmed);
      cancelAdd();
      return;
    }
    if (pendingOverwriteId === match.id) {
      updatePreset({ ...match, ...capturePresetState(connections, types) });
      cancelAdd();
      return;
    }
    setPendingOverwriteId(match.id);
  }

  const overwriteTarget = pendingOverwriteId ? presets.find((p) => p.id === pendingOverwriteId) : undefined;

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Presets</span>
        {!adding && (
          <button
            onClick={startAdd}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Enregistrer le preset actuel"
          >
            <Plus size={12} />
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {presets.length === 0 && !adding && (
          <p className="px-2 text-[11px] text-muted-foreground">Aucun preset.</p>
        )}

        {adding && (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setPendingOverwriteId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAdd();
                if (e.key === "Escape") cancelAdd();
              }}
              onBlur={cancelAdd}
              placeholder="Nom du preset"
              className="w-full rounded-md border border-border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
            />
            {overwriteTarget && (
              <p className="text-[11px] text-destructive mt-1">
                « {overwriteTarget.name} » existe déjà — Entrée pour écraser, Échap pour annuler.
              </p>
            )}
          </div>
        )}

        {presets.map((preset) => {
          const active = presetMatchesState(preset, connections, types);
          return (
            <PresetRow
              key={preset.id}
              preset={preset}
              presets={presets}
              active={active}
              onApply={() => (active ? clearPreset() : applyPreset(preset.id))}
              onRename={(name) => updatePreset({ ...preset, name })}
              onUpdate={() => updatePreset({ ...preset, ...capturePresetState(connections, types) })}
              onDelete={() => removePreset(preset.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
