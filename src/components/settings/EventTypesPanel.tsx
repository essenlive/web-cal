"use client";

/**
 * EventTypesPanel — list wrapper for the "Types" drawer, same list/edit
 * composition as ConnectionsPanel/RulesPanel, plus drag-reorder (display order
 * is meaningful here, unlike Sources).
 */

import { useState } from "react";
import { useEventTypeStore } from "../../store";
import { useDragReorder } from "../../hooks/useDragReorder";
import { TypeRow } from "../sidebar/Sidebar";
import { EventTypeModal } from "./EventTypeModal";
import { PanelHeader } from "./PanelHeader";
import type { EventType } from "../../types";

export function EventTypesPanel({ initialEditId }: { initialEditId?: string } = {}) {
  const { types, addType, updateType, removeType, setDefaultType, reorderType } = useEventTypeStore();
  const { getDragProps } = useDragReorder(types, (t) => t.id, reorderType);

  const initialType = initialEditId ? types.find((t) => t.id === initialEditId) ?? null : null;
  const [formOpen, setFormOpen] = useState(!!initialType);
  const [editingType, setEditingType] = useState<EventType | null>(initialType);

  function back() {
    setFormOpen(false);
    setEditingType(null);
  }

  if (formOpen) {
    return (
      <EventTypeModal
        key={editingType?.id ?? "new-type"}
        type={editingType ?? undefined}
        existingLabels={types.map((t) => t.label)}
        onSave={(t) => {
          if (t.id) {
            updateType(t as EventType);
            if (t.isDefault) setDefaultType(t.id);
          } else {
            addType(t);
          }
        }}
        onDelete={editingType ? () => { removeType(editingType.id); back(); } : undefined}
        deleteDisabledReason={editingType?.isDefault ? "Le type par défaut ne peut pas être supprimé — définissez d'abord un autre type par défaut" : undefined}
        onClose={back}
      />
    );
  }

  return (
    <>
      <PanelHeader title="Types" action={{ label: "Ajouter", onClick: () => { setEditingType(null); setFormOpen(true); } }} />
      <div className="space-y-1.5 px-4 pb-4">
        {types.map((t, index) => (
          <TypeRow
            key={t.id}
            type={t}
            onEdit={() => { setEditingType(t); setFormOpen(true); }}
            onToggleHidden={() => updateType({ ...t, hidden: !t.hidden })}
            dragProps={getDragProps(index)}
          />
        ))}
      </div>
    </>
  );
}
