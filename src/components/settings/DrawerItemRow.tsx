"use client";

/**
 * DrawerItemRow — shared row for every section's management drawer list
 * (Presets, Sources, Types, Règles, Thème): drag handle, badge, name, optional
 * tag/state, then always-visible edit/duplicate/delete icon buttons (no
 * hover-reveal — unlike the sidebar's compact preview rows, this list has
 * nothing else to see). Delete requires a second click to confirm
 * (ActionButton, turns into a red check). Items that can't be deleted pass
 * `deleteDisabledReason` instead of `onDelete`, rendering a static
 * "protected" icon with that tooltip.
 */

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { GripVertical, Pencil, Copy, Trash2, Check, Sparkles, Plus } from "lucide-react";
import { ActionButton } from "../ui/action-button";
import { SimpleTooltip } from "../ui/tooltip";
import type { DragProps } from "../sidebar/Sidebar";

export function IconButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <SimpleTooltip label={label}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        aria-label={label}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        {icon}
      </button>
    </SimpleTooltip>
  );
}

export function DeleteButton({ onDelete, label = "Supprimer" }: { onDelete: () => void; label?: string }) {
  return (
    <SimpleTooltip label={label}>
      <ActionButton
        variant="secondary"
        onAction={onDelete}
        aria-label={label}
        confirmLabel="Confirmer la suppression"
        confirmChildren={<Check size={12} />}
        className="size-8 shrink-0 rounded-full p-0 text-muted-foreground hover:text-destructive data-[status=armed]:text-white [&_svg]:size-3"
      >
        <Trash2 size={12} />
      </ActionButton>
    </SimpleTooltip>
  );
}

export function DrawerItemRow({ badge, name, tag, state, onEdit, onDuplicate, onDelete, deleteDisabledReason, dragProps }: {
  badge: ReactNode;
  name: string;
  tag?: ReactNode;
  state?: ReactNode;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  deleteDisabledReason?: string;
  dragProps?: DragProps;
}) {
  return (
    <div
      ref={dragProps?.ref}
      className={cn(
        "flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-2 transition-colors",
        dragProps?.dragging && "opacity-50",
        dragProps?.over && "ring-2 ring-primary/50"
      )}
    >
      {dragProps && (
        <SimpleTooltip label="Réordonner">
          <button
            type="button"
            onPointerDown={dragProps.onHandlePointerDown}
            aria-label="Réordonner"
            className="shrink-0 -m-1.5 touch-none select-none p-1.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
        </SimpleTooltip>
      )}
      {badge}
      <span className="flex-1 min-w-0 truncate text-sm text-foreground">{name}</span>
      {state}
      {tag}
      {onEdit && <IconButton icon={<Pencil size={12} />} label="Modifier" onClick={onEdit} />}
      {onDuplicate && <IconButton icon={<Copy size={12} />} label="Dupliquer" onClick={onDuplicate} />}
      {onDelete && <DeleteButton onDelete={onDelete} />}
      {!onDelete && deleteDisabledReason && (
        <SimpleTooltip label={deleteDisabledReason}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/50">
            <Sparkles size={12} />
          </span>
        </SimpleTooltip>
      )}
    </div>
  );
}

export function AddItemButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-muted py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
    >
      <Plus size={14} />
      {label}
    </button>
  );
}
