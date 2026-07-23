"use client";

/**
 * Collapsible sidebar section header, shared by Sources/Types/Règles/Thème/Presets.
 * Chevron toggles the compact row list (state in useUIStore.collapsedSections,
 * persisted); clicking the label or the "+" both open the section's list drawer
 * — the drawer's own "Nouveau X" button is what actually starts creation (see
 * RulesPanel, the pattern this generalizes from), so there's nothing distinct
 * for "+" to do.
 */

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useUIStore } from "../../store";

export function Section({ id, label, onOpen, children }: { id: string; label: string; onOpen: () => void; children: ReactNode }) {
  const { collapsedSections, toggleSection } = useUIStore();
  const collapsed = !!collapsedSections[id];

  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-1 px-2 mb-1">
        <button
          onClick={() => toggleSection(id)}
          aria-label={collapsed ? `Développer ${label}` : `Réduire ${label}`}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        <button
          onClick={onOpen}
          className="flex-1 min-w-0 text-left text-[10px] font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wide truncate"
        >
          {label}
        </button>
        <button onClick={onOpen} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={`Ajouter : ${label}`}>
          <Plus size={12} />
        </button>
      </div>
      {!collapsed && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
