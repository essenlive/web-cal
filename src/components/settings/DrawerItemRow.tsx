"use client";

/**
 * DrawerItemRow — shared row for every section's management drawer list
 * (Presets, Sources, Types, Règles, Thème): drag handle, badge, name, optional
 * tag/state, then always-visible edit/delete icon buttons (no hover-reveal —
 * unlike the sidebar's compact preview rows, this list has nothing else to
 * see). Delete requires a second click to confirm (ActionButton, turns into a
 * red check). Items that can't be deleted pass `deleteDisabledReason` instead
 * of `onDelete`, rendering a static "protected" icon with that tooltip; items
 * with neither (built-in themes) get no action area at all.
 */

import type { ReactNode } from "react";
import { GripVertical, Pencil, Trash2, Check, Sparkles, Plus } from "lucide-react";
import { ActionButton } from "../ui/action-button";
import type { DragProps } from "../sidebar/Sidebar";

function IconButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      title={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      {icon}
    </button>
  );
}

export function DrawerItemRow({ badge, name, tag, state, onEdit, onDelete, deleteDisabledReason, dragProps }: {
  badge: ReactNode;
  name: string;
  tag?: ReactNode;
  state?: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteDisabledReason?: string;
  dragProps?: DragProps;
}) {
  return (
    <div {...dragProps} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-2">
      {dragProps && <GripVertical size={14} className="shrink-0 text-muted-foreground/40 cursor-grab" />}
      {badge}
      <span className="flex-1 min-w-0 truncate text-sm text-foreground">{name}</span>
      {state}
      {tag}
      {onEdit && <IconButton icon={<Pencil size={12} />} label="Modifier" onClick={onEdit} />}
      {onDelete && (
        <ActionButton
          variant="secondary"
          onAction={onDelete}
          aria-label="Supprimer"
          confirmLabel="Confirmer la suppression"
          confirmChildren={<Check size={12} />}
          className="size-6 shrink-0 rounded-full p-0 text-muted-foreground hover:text-destructive data-[status=armed]:text-white [&_svg]:size-3"
        >
          <Trash2 size={12} />
        </ActionButton>
      )}
      {!onDelete && deleteDisabledReason && (
        <span
          title={deleteDisabledReason}
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/50"
        >
          <Sparkles size={12} />
        </span>
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
