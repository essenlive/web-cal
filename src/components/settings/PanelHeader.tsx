"use client";

/**
 * Shared drawer header for the section list/item-edit panels: a title, plus
 * either a leading back-chevron (item-edit forms, returns to the section's
 * list) or a descriptive blurb below the title (list panels, explaining what
 * the section is for — see InlineLink for the cross-references it embeds).
 * One or the other, never both — a list panel has no back target, an item
 * form has no description.
 */

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { DrawerHeader, DrawerTitle } from "../ui/drawer";

export interface PanelHeaderProps {
  title: string;
  /** Item-edit forms: back to the list. */
  onBack?: () => void;
  /** List panels: explains the section, with InlineLink cross-references to related sections. */
  description?: ReactNode;
}

export function PanelHeader({ title, onBack, description }: PanelHeaderProps) {
  return (
    <DrawerHeader className="space-y-2">
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
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </DrawerHeader>
  );
}

/** An underlined, same-color cross-reference inside a PanelHeader description — jumps to another section's drawer. */
export function InlineLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="font-semibold text-foreground underline underline-offset-2 hover:text-primary">
      {children}
    </button>
  );
}
