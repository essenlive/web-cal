"use client";

/**
 * EventTypesPanel — list wrapper for the "Types" drawer, same list/edit
 * composition as ConnectionsPanel/RulesPanel, plus drag-reorder (display order
 * is meaningful here, unlike Sources).
 */

import { useState } from "react";
import { useUIStore, useEventTypeStore } from "../../store";
import { useDragReorder } from "../../hooks/useDragReorder";
import { useEventStatsByGroup } from "../../hooks/useEventStatsByGroup";
import { ItemBadge } from "../sidebar/ItemRow";
import { EventTypeModal } from "./EventTypeModal";
import { getIconEl } from "../../lib/icons";
import { DrawerItemRow, AddItemButton } from "./DrawerItemRow";
import { PanelHeader, InlineLink } from "./PanelHeader";
import { StatTag } from "./StatTag";
import { emptyStats } from "../../lib/eventStats";
import type { EventType } from "../../types";

export function EventTypesPanel({ initialEditId, openCreate }: { initialEditId?: string; openCreate?: boolean } = {}) {
  const { openDrawer } = useUIStore();
  const { types, addType, updateType, removeType, setDefaultType, reorderType } = useEventTypeStore();
  const { getDragProps } = useDragReorder(types, (t) => t.id, reorderType);
  const { byType } = useEventStatsByGroup();

  const initialType = initialEditId ? types.find((t) => t.id === initialEditId) ?? null : null;
  const [formOpen, setFormOpen] = useState(!!initialType || !!openCreate);
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
          if (editingType) {
            updateType(t as EventType);
            if (t.isDefault) setDefaultType(t.id!);
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
      <PanelHeader
        title="Types"
        description={
          <>
            Les types d&apos;affichages sont des manières d&apos;afficher des événements, que ce soit par un badge, une
            couleur de fond, ou bloc d&apos;événement standard. C&apos;est ensuite{" "}
            <InlineLink onClick={() => openDrawer("rules")}>les règles</InlineLink>{" "}
            qui définissent sous quel type chaque événement doit s&apos;afficher. Le type par défaut ne peut pas être supprimé.
          </>
        }
      />
      <div className="space-y-1.5 px-4 pb-4">
        {types.map((t, index) => (
          <DrawerItemRow
            key={t.id}
            badge={<ItemBadge color={t.color}>{getIconEl(t.icon, 10, "#fff")}</ItemBadge>}
            name={t.label}
            state={<StatTag stats={byType.get(t.id) ?? emptyStats()} />}
            onEdit={() => { setEditingType(t); setFormOpen(true); }}
            onDuplicate={() => { const { id, ...rest } = t; addType({ ...rest, isDefault: false, label: `${rest.label} (copie)` }); }}
            onDelete={t.isDefault ? undefined : () => removeType(t.id)}
            deleteDisabledReason={t.isDefault ? "Le type par défaut ne peut pas être supprimé" : undefined}
            dragProps={getDragProps(index)}
          />
        ))}
        <AddItemButton label="Nouveau type" onClick={() => { setEditingType(null); setFormOpen(true); }} />
      </div>
    </>
  );
}
