"use client";

/**
 * ConnectionsPanel — list wrapper for the "Sources" drawer, same list/edit
 * composition as RulesPanel: shows every connection first, drills into
 * AddConnectionModal (with a back-chevron) when one is opened for edit/create.
 */

import { useState } from "react";
import { useConnectionStore } from "../../store";
import { useConnectionStatusMap } from "../../context/DataProviderContext";
import { ConnectionRow } from "../sidebar/Sidebar";
import { AddConnectionModal } from "./AddConnectionModal";
import { PanelHeader } from "./PanelHeader";
import type { Connection } from "../../types";

export function ConnectionsPanel({ initialEditId, openCreate }: { initialEditId?: string; openCreate?: boolean } = {}) {
  const { connections, addConnection, updateConnection, removeConnection } = useConnectionStore();
  const statusMap = useConnectionStatusMap();

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
      <PanelHeader title="Sources" action={{ label: "Ajouter", onClick: () => { setEditingConn(null); setFormOpen(true); } }} />
      <div className="space-y-1.5 px-4 pb-4">
        {connections.length === 0 && <p className="text-xs text-muted-foreground">Aucune source.</p>}
        {connections.map((c) => (
          <ConnectionRow
            key={c.id}
            connection={c}
            status={statusMap[c.id] ?? "unchecked"}
            onEdit={() => { setEditingConn(c); setFormOpen(true); }}
            onToggleHidden={() => updateConnection({ ...c, hidden: !c.hidden })}
          />
        ))}
      </div>
    </>
  );
}
