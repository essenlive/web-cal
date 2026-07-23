import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, addMonths, subMonths, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Settings, ListOrdered, Keyboard, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useUIStore, useConnectionStore, useEventTypeStore } from "../../store";
import { useConnectionStatusMap } from "../../context/DataProviderContext";
import { getIconEl } from "../settings/EventTypeModal";
import { SettingsDrawer } from "../settings/SettingsDrawer";
import { ThemeSelector } from "./ThemeSelector";
import { PresetSelector } from "./PresetSelector";
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

function HideToggle({ hidden, label, onToggle }: { hidden?: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={hidden ? `Afficher ${label}` : `Masquer ${label}`}
      title={hidden ? "Afficher" : "Masquer"}
      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
    >
      {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
    </button>
  );
}

function ConnectionRow({ connection, status, onEdit, onToggleHidden }: {
  connection: Connection; status: ConnectionStatus; onEdit: () => void; onToggleHidden: () => void;
}) {
  const hidden = !!connection.hidden;
  return (
    <div
      onClick={onEdit}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer"
    >
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: connection.color }} />
      <span className={cn("flex-1 min-w-0 truncate text-xs text-foreground", hidden && "text-muted-foreground line-through")}>
        {connection.name}
      </span>
      <span className={cn("size-1.5 rounded-full shrink-0", statusColor(status))} title={status} />
      <HideToggle hidden={hidden} label={connection.name} onToggle={onToggleHidden} />
    </div>
  );
}

// ── Compact event type row ────────────────────────────────────────────────────

function TypeRow({ type, onEdit, onToggleHidden }: { type: EventType; onEdit: () => void; onToggleHidden: () => void }) {
  const hidden = !!type.hidden;
  return (
    <div
      onClick={onEdit}
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer"
    >
      <div className="flex size-4 items-center justify-center rounded-full shrink-0" style={{ backgroundColor: type.color + "20", color: type.color }}>
        {getIconEl(type.icon, 10)}
      </div>
      <span className={cn("flex-1 min-w-0 truncate text-xs text-foreground", hidden && "text-muted-foreground line-through")}>
        {type.label}
      </span>
      <HideToggle hidden={hidden} label={type.label} onToggle={onToggleHidden} />
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-2 mb-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <button onClick={onAdd} className="text-muted-foreground hover:text-foreground" aria-label={`Ajouter : ${label}`}>
        <Plus size={12} />
      </button>
    </div>
  );
}

export function Sidebar() {
  const { currentDate, setCurrentDate, weekStartsOnMonday, sidebarOpen, openDrawer } = useUIStore();
  const [miniDate, setMiniDate] = useState(currentDate);
  const weekStart = weekStartsOnMonday ? 1 : 0;

  const { connections, updateConnection } = useConnectionStore();
  const statusMap = useConnectionStatusMap();
  const { types, updateType } = useEventTypeStore();

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
      fixed top-14 bottom-0 left-0 z-40 w-56
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
                "flex items-center justify-center size-6 mx-auto rounded-full text-[10px] transition-colors",
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

      {/* Presets */}
      <PresetSelector />

      <div className="border-t border-border" />

      {/* Data sources preview */}
      <div className="px-3 py-3">
        <SectionHeader label="Sources" onAdd={() => openDrawer("connection")} />
        <div className="space-y-0.5">
          {connections.length === 0 && (
            <p className="px-2 text-xs text-muted-foreground">Aucune source.</p>
          )}
          {connections.map((c) => (
            <ConnectionRow
              key={c.id}
              connection={c}
              status={statusMap[c.id] ?? "unchecked"}
              onEdit={() => openDrawer("connection", c.id)}
              onToggleHidden={() => updateConnection({ ...c, hidden: !c.hidden })}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Event types preview */}
      <div className="px-3 py-3">
        <SectionHeader label="Types" onAdd={() => openDrawer("eventType")} />
        <div className="space-y-0.5">
          {types.map((t) => (
            <TypeRow
              key={t.id}
              type={t}
              onEdit={() => openDrawer("eventType", t.id)}
              onToggleHidden={() => updateType({ ...t, hidden: !t.hidden })}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Rules entry point — opens the rules manager in the settings drawer */}
      <div className="px-3 py-3">
        <button
          onClick={() => openDrawer("rules")}
          className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 hover:bg-muted text-xs text-foreground"
        >
          <ListOrdered size={14} className="text-muted-foreground" />
          Règles d&apos;affichage
        </button>
      </div>

      {/* Theme + settings — bottom of sidebar */}
      <div className="mt-auto border-t border-border px-3 py-2 flex items-center gap-1">
        <ThemeSelector />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={() => openDrawer("shortcuts")}
          aria-label="Raccourcis clavier"
        >
          <Keyboard size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={() => openDrawer("preferences")}
          aria-label="Préférences"
        >
          <Settings size={16} />
        </Button>
      </div>

      <SettingsDrawer />
    </aside>
  );
}
