"use client";

/**
 * Shared drawer header/footer for the section list/item-edit panels.
 * PanelHeader: a title, an optional leading back-chevron (item-edit forms,
 * returns to the section's list), and an optional descriptive blurb below
 * the title. List panels use description to explain what the section is for
 * (see InlineLink for the cross-references it embeds); item-edit forms use
 * it for a one-line hint about what the form does, alongside their
 * back-chevron.
 * PanelFooter: the matching action row for every item-edit form (Preset,
 * Source, Type, Thème) — delete (or nothing) on the left, cancel + save on
 * the right, so the three actions look and sit identically everywhere.
 */

import type { ReactNode } from "react";
import { Check, ChevronLeft, Trash2 } from "lucide-react";
import { DrawerHeader, DrawerTitle } from "../ui/drawer";
import { Button } from "../ui/button";
import { ActionButton } from "../ui/action-button";

export interface PanelHeaderProps {
  title: string;
  /** Item-edit forms: back to the list. */
  onBack?: () => void;
  /** List panels: explains the section, with InlineLink cross-references to related sections. */
  description?: ReactNode;
  /** List panels: trailing control on the title row (e.g. a refresh button). */
  action?: ReactNode;
}

export function PanelHeader({ title, onBack, description, action }: PanelHeaderProps) {
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
        <DrawerTitle className="truncate flex-1">{title}</DrawerTitle>
        {action}
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

export interface PanelFooterProps {
  /** Shown as a confirm-to-delete button on the left. Omitted (form creating a new item) renders nothing there instead. */
  onDelete?: () => void;
  /** Disables delete with an explanatory title (e.g. "the default type can't be deleted"), instead of hiding it. */
  deleteDisabledReason?: string;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  /** "Créer" for a new item, "Enregistrer" when editing an existing one. */
  saveLabel: string;
}

/** The Supprimer / Annuler / Enregistrer-ou-Créer row shared by every item-edit form. */
export function PanelFooter({ onDelete, deleteDisabledReason, onCancel, onSave, saveDisabled, saveLabel }: PanelFooterProps) {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      {onDelete ? (
        <ActionButton
          variant="ghost"
          onAction={onDelete}
          disabled={!!deleteDisabledReason}
          title={deleteDisabledReason}
          confirmLabel="Confirmer la suppression"
          confirmChildren={<><Trash2 size={13} />Confirmer</>}
          className="gap-1.5 px-3 py-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 size={13} />
          Supprimer
        </ActionButton>
      ) : <span />}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={onSave} disabled={saveDisabled} className="gap-1.5">
          <Check size={14} />
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
