"use client";

/**
 * Shared drawer header for the section list/item-edit panels: a title, plus
 * either a leading back-chevron (item-edit forms, returns to the section's
 * list) or a trailing action button (list panels, "+ Nouveau X"). One of the
 * two, never both — a list panel has no back target, an item form has no
 * secondary action.
 */

import type { ReactNode } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { DrawerHeader, DrawerTitle } from "../ui/drawer";

export interface PanelHeaderProps {
  title: string;
  /** Item-edit forms: back to the list. */
  onBack?: () => void;
  /** List panels: primary "add new" action. */
  action?: { label: string; onClick: () => void; icon?: ReactNode };
}

export function PanelHeader({ title, onBack, action }: PanelHeaderProps) {
  return (
    <DrawerHeader className="flex-row items-center justify-between space-y-0">
      <div className="flex items-center gap-1 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Retour"
            className="shrink-0 -ml-1.5 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <DrawerTitle className="truncate">{title}</DrawerTitle>
      </div>
      {action && (
        <Button onClick={action.onClick} className="gap-1.5 rounded-lg text-sm shrink-0">
          {action.icon ?? <Plus size={14} />}
          {action.label}
        </Button>
      )}
    </DrawerHeader>
  );
}
