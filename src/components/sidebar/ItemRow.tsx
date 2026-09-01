"use client";

/**
 * ItemRow — shared row layout for every sidebar section list (Presets, Sources,
 * Types, Rules, Thème): badge, name, optional non-interactive state, optional
 * action buttons. Pass `onSelect` only for sections where clicking an item
 * *is* the action (Presets apply, Thème select) — the row then acts as one big
 * button. Sections with no such concept (Sources, Types, Rules) omit it, so
 * only the action buttons underneath are clickable.
 */

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function ItemBadge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {children}
    </div>
  );
}

export interface ItemRowAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export function ItemRow({ badge, name, muted, state, actions, selected, onSelect }: {
  badge: ReactNode;
  name: string;
  muted?: boolean;
  state?: ReactNode;
  actions?: ItemRowAction[];
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5",
        onSelect && "cursor-pointer hover:bg-muted",
        selected && "bg-muted"
      )}
    >
      {badge}
      <span className={cn("flex-1 min-w-0 truncate text-xs text-foreground", muted && "text-muted-foreground line-through")}>
        {name}
      </span>
      {state}
      {actions?.map((a) => (
        <button
          key={a.label}
          onClick={(e) => { e.stopPropagation(); a.onClick(); }}
          aria-label={a.label}
          className="p-1.5 -m-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0 opacity-0 pointer-coarse:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        >
          {a.icon}
        </button>
      ))}
    </div>
  );
}
