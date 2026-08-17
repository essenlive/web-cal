"use client";

/**
 * ConnectionsPanel — list wrapper for the "Sources" drawer, same list/edit
 * composition as RulesPanel: shows every connection first, drills into
 * AddConnectionModal (with a back-chevron) when one is opened for edit/create.
 */

import { useState } from "react";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { useConnectionStore } from "../../store";
import { useConnectionStatusMap, useSourceSync } from "../../context/DataProviderContext";
import { useDragReorder } from "../../hooks/useDragReorder";
import { ItemBadge } from "../sidebar/ItemRow";
import { statusColor, statusLabel } from "../sidebar/Sidebar";
import { AddConnectionModal } from "./AddConnectionModal";
import { DrawerItemRow, AddItemButton } from "./DrawerItemRow";
import { PanelHeader } from "./PanelHeader";
import { ActionButton } from "../ui/action-button";
import { SimpleTooltip } from "../ui/tooltip";
import type { Connection } from "../../types";

export function ConnectionsPanel({ initialEditId, openCreate }: { initialEditId?: string; openCreate?: boolean } = {}) {
  const { connections, addConnection, updateConnection, removeConnection, reorderConnection } = useConnectionStore();
  const statusMap = useConnectionStatusMap();
  const { refresh, lastUpdated } = useSourceSync();
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
        description={
          <>
            Les sources sont des liens webcal. Pour l&apos;instant, les sources sont en lecture seule. Vous pouvez ajouter vos propres liens ou des liens de calendrier publics (jours fériés...).
            <br />
            {lastUpdated ? `Actualisé à ${format(lastUpdated, "HH:mm")}.` : "Chargement…"}
          </>
        }
        action={
          <SimpleTooltip label="Actualiser les sources">
            <ActionButton
              variant="ghost"
              size="icon"
              confirm={false}
              onAction={refresh}
              aria-label="Actualiser les sources"
              className="shrink-0"
            >
              <RefreshCw size={16} />
            </ActionButton>
          </SimpleTooltip>
        }
      />
      <div className="space-y-1.5 px-4 pb-4">
        {connections.length === 0 && <p className="text-xs text-muted-foreground">Aucune source.</p>}
        {connections.map((c, index) => (
          <DrawerItemRow
            key={c.id}
            badge={<ItemBadge color={c.color}>{c.name.trim().charAt(0).toUpperCase()}</ItemBadge>}
            name={c.name}
            state={
              <SimpleTooltip label={statusLabel(statusMap[c.id] ?? "unchecked")}>
                <span className={`size-1.5 rounded-full shrink-0 ${statusColor(statusMap[c.id] ?? "unchecked")}`} />
              </SimpleTooltip>
            }
            onEdit={() => { setEditingConn(c); setFormOpen(true); }}
            onDuplicate={() => { const { id, ...rest } = c; addConnection({ ...rest, name: `${rest.name} (copie)` } as Omit<Connection, "id">); }}
            onDelete={() => removeConnection(c.id)}
            dragProps={getDragProps(index)}
          />
        ))}
        <AddItemButton label="Nouvelle source" onClick={() => { setEditingConn(null); setFormOpen(true); }} />
      </div>
    </>
  );
}
