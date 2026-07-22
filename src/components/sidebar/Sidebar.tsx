import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, addMonths, subMonths, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Settings, Sun, Moon, ListOrdered } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useUIStore, useConnectionStore, useEventTypeStore } from "../../store";
import { useConnectionStatusMap } from "../../context/DataProviderContext";
import { AddConnectionModal } from "../settings/AddConnectionModal";
import { EventTypeModal, getIconEl } from "../settings/EventTypeModal";
import { RulesModal } from "../../views/RulesPage";
import type { Connection, ConnectionStatus, EventType } from "../../types";

// ── Compact data source row ───────────────────────────────────────────────────

function statusColor(status: ConnectionStatus) {
  switch (status) {
    case "active":  return "bg-green-500";
    case "error":   return "bg-amber-500";
    case "loading": return "bg-muted-foreground animate-pulse";
    default:        return "bg-muted-foreground/40";
  }
}

function ConnectionRow({ connection, status, onEdit }: {
  connection: Connection; status: ConnectionStatus; onEdit: () => void;
}) {
  return (
    <div
      onClick={onEdit}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer"
    >
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: connection.color }} />
      <span className="flex-1 min-w-0 truncate text-xs text-foreground">{connection.name}</span>
      <span className={cn("size-1.5 rounded-full shrink-0", statusColor(status))} title={status} />
    </div>
  );
}

// ── Compact event type row ────────────────────────────────────────────────────

function TypeRow({ type, onEdit }: { type: EventType; onEdit: () => void }) {
  return (
    <div
      onClick={onEdit}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer"
    >
      <div className="flex size-4 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: type.color + "20", color: type.color }}>
        {getIconEl(type.icon, 10)}
      </div>
      <span className="flex-1 min-w-0 truncate text-xs text-foreground">{type.label}</span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-2 mb-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <button onClick={onAdd} className="text-muted-foreground hover:text-foreground" aria-label={`Add ${label}`}>
        <Plus size={12} />
      </button>
    </div>
  );
}

export function Sidebar() {
  const { currentDate, setCurrentDate, weekStartsOnMonday, sidebarOpen, darkMode, toggleDark } = useUIStore();
  const [miniDate, setMiniDate] = useState(currentDate);
  const weekStart = weekStartsOnMonday ? 1 : 0;

  const { connections, addConnection, updateConnection, removeConnection } = useConnectionStore();
  const statusMap = useConnectionStatusMap();
  const { types, addType, updateType, removeType, isCatchAllTarget } = useEventTypeStore();

  const [addConnOpen, setAddConnOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<EventType | null>(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  if (!sidebarOpen) return null;

  const monthStart = startOfMonth(miniDate);
  const monthEnd   = endOfMonth(miniDate);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: weekStart });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: weekStart });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    format(addDays(gridStart, i), "EEEEE", { locale: fr })
  );

  return (
    <aside className="
      fixed inset-y-0 left-0 z-40 w-56
      sm:relative sm:inset-auto sm:z-auto sm:translate-x-0
      shrink-0 border-r border-border flex flex-col bg-card overflow-y-auto
      transition-transform duration-200
    ">
      {/* Mini calendar */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setMiniDate(subMonths(miniDate, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs font-semibold text-foreground capitalize">
            {format(miniDate, "MMMM yyyy", { locale: fr })}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setMiniDate(addMonths(miniDate, 1))}>
            <ChevronRight size={14} />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px">
          {dayHeaders.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-0.5 uppercase">
              {d}
            </div>
          ))}
          {days.map((day) => (
            <button
              key={day.toISOString()}
              onClick={() => { setCurrentDate(day); setMiniDate(day); }}
              className={cn(
                "flex items-center justify-center size-6 mx-auto rounded-full text-[11px] transition-colors",
                !isSameMonth(day, miniDate) && "opacity-30",
                isToday(day) && "bg-primary/20 text-primary font-semibold",
                isSameDay(day, currentDate) && "bg-primary text-primary-foreground font-semibold",
                !isSameDay(day, currentDate) && "hover:bg-muted text-foreground"
              )}
            >
              {format(day, "d")}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Data sources preview */}
      <div className="px-3 py-3">
        <SectionHeader label="Sources" onAdd={() => setAddConnOpen(true)} />
        <div className="space-y-0.5">
          {connections.length === 0 && (
            <p className="px-2 text-[11px] text-muted-foreground">Aucune source.</p>
          )}
          {connections.map((c) => (
            <ConnectionRow
              key={c.id}
              connection={c}
              status={statusMap[c.id] ?? "unchecked"}
              onEdit={() => setEditingConn(c)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Event types preview */}
      <div className="px-3 py-3">
        <SectionHeader label="Types" onAdd={() => setTypeModalOpen(true)} />
        <div className="space-y-0.5">
          {types.map((t) => (
            <TypeRow key={t.id} type={t} onEdit={() => setEditingType(t)} />
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Rules entry point — opens the rules manager in a modal */}
      <div className="px-3 py-3">
        <button
          onClick={() => setRulesModalOpen(true)}
          className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 hover:bg-muted text-xs text-foreground"
        >
          <ListOrdered size={14} className="text-muted-foreground" />
          Règles d&apos;affichage
        </button>
      </div>

      {/* Theme + settings — bottom of sidebar */}
      <div className="mt-auto border-t border-border px-3 py-2 flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggleDark} className="text-muted-foreground" aria-label="Basculer le thème">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground" asChild>
          <Link href="/settings">
            <Settings size={16} />
          </Link>
        </Button>
      </div>

      {/* Add / edit connection modal */}
      <AddConnectionModal
        key={editingConn?.id ?? "new-conn"}
        open={addConnOpen || !!editingConn}
        onOpenChange={(v) => { if (!v) { setAddConnOpen(false); setEditingConn(null); } }}
        onAdd={addConnection}
        onUpdate={updateConnection}
        connection={editingConn ?? undefined}
        existingColors={connections.map((c) => c.color)}
        onDelete={editingConn ? () => { removeConnection(editingConn.id); setEditingConn(null); } : undefined}
      />

      {/* Add / edit event type modal */}
      <EventTypeModal
        key={editingType?.id ?? "new-type"}
        open={typeModalOpen || !!editingType}
        onOpenChange={(v) => { if (!v) { setTypeModalOpen(false); setEditingType(null); } }}
        type={editingType ?? undefined}
        existingLabels={types.map((t) => t.label)}
        onSave={(t) => { if (t.id) updateType(t as EventType); else addType(t); }}
        onDelete={editingType ? () => { removeType(editingType.id); setEditingType(null); } : undefined}
        deleteDisabledReason={editingType && isCatchAllTarget(editingType.id) ? "Reassign the default rule before deleting this type" : undefined}
      />

      {/* Display rules modal */}
      <RulesModal open={rulesModalOpen} onOpenChange={setRulesModalOpen} />
    </aside>
  );
}
