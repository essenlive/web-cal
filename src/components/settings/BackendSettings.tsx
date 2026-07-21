/**
 * BackendSettings — Data Sources settings tab.
 *
 * Renders the connection list (US2) and the Add Connection modal trigger (US1).
 * Replaces the previous single-backend selector.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { useConnectionStore, useEventTypeStore } from "../../store";
import { useConnectionStatusMap } from "../../context/DataProviderContext";
import { AddConnectionModal } from "./AddConnectionModal";
import { ConnectionList } from "./ConnectionList";

export function BackendSettings() {
  const { connections, addConnection, removeConnection, updateConnection } = useConnectionStore();
  const { types: eventTypes } = useEventTypeStore();
  const statusMap = useConnectionStatusMap();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Data Sources</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={14} />
          Add Source
        </button>
      </div>

      <ConnectionList
        connections={connections}
        statusMap={statusMap}
        eventTypes={eventTypes}
        onRemove={removeConnection}
        onUpdate={updateConnection}
      />

      <AddConnectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAdd={addConnection}
        existingColors={connections.map((c) => c.color)}
      />
    </div>
  );
}
