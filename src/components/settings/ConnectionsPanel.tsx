"use client";

/**
 * ConnectionsPanel — list wrapper for the "Sources" drawer, same list/edit
 * composition as RulesPanel: shows every connection first, drills into
 * AddConnectionModal (with a back-chevron) when one is opened for edit/create.
 */

import { useState } from "react";
import { useConnectionStore } from "../../store";
import { useConnectionStatusMap } from "../../context/DataProviderContext";
import { useDragReorder } from "../../hooks/useDragReorder";
import { ItemBadge } from "../sidebar/ItemRow";
import { statusColor } from "../sidebar/Sidebar";
import { AddConnectionModal } from "./AddConnectionModal";
import { DrawerItemRow, AddItemButton } from "./DrawerItemRow";
import { PanelHeader } from "./PanelHeader";
import type { Connection } from "../../types";

export function ConnectionsPanel({ initialEditId, openCreate }: { initialEditId?: string; openCreate?: boolean } = {}) {
  const { connections, addConnection, updateConnection, removeConnection, reorderConnection } = useConnectionStore();
  const statusMap = useConnectionStatusMap();
  const { getDragProps } = useDragReorder(connections, (c) => c.id, reorderConnection);

  const initialConn = initialEditId ? connections.find((c) => c.id === initialEditId) ?? null : null;
  const [formOpen, setFormOpen] = useState(!!initialConn || !!openCreate);
  const [editingConn, setEditingConn] = useState<Connection | null>(initialConn);

  function back() {
    setFormOpen(false);
    setEditingConn(null);
  }

  if (formOpen) {
    return (
      <AddConnectionModal
        key={editingConn?.id ?? "new-conn"}
        connection={editingConn ?? undefined}
        existingColors={connections.map((c) => c.color)}
        onAdd={addConnection}
        onUpdate={updateConnection}
        onDelete={editingConn ? () => { removeConnection(editingConn.id); back(); } : undefined}
        onClose={back}
      />
    );
  }

  return (
    <>
      <PanelHeader
        title="Sources"
        description="Les sources sont des liens webcal. Pour l'instant, les sources sont en lecture seule. Vous pouvez ajouter vos propres liens ou des liens de calendrier publics (jours fériés...)."
      />
      <div className="space-y-1.5 px-4 pb-4">
        {connections.length === 0 && <p className="text-xs text-muted-foreground">Aucune source.</p>}
        {connections.map((c, index) => (
          <DrawerItemRow
            key={c.id}
            badge={<ItemBadge color={c.color}>{c.name.trim().charAt(0).toUpperCase()}</ItemBadge>}
            name={c.name}
            state={<span className={`size-1.5 rounded-full shrink-0 ${statusColor(statusMap[c.id] ?? "unchecked")}`} />}
            onEdit={() => { setEditingConn(c); setFormOpen(true); }}
            onDelete={() => removeConnection(c.id)}
            dragProps={getDragProps(index)}
          />
        ))}
        <AddItemButton label="Nouvelle source" onClick={() => { setEditingConn(null); setFormOpen(true); }} />
      </div>
    </>
  );
}
