import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, addMonths, subMonths, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Eye, EyeOff } from "lucide-react";
import * as Icons from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useUIStore, useConnectionStore, useEventTypeStore } from "../../store";
import type { Connection, EventType } from "../../types";

interface SidebarProps {
  onNewEvent: () => void;
}

// ── Quick-hide visibility rows ───────────────────────────────────────────────

interface VisibilityItem {
  id: string;
  label: string;
  color: string;
  /** lucide-react icon name; omitted for connections (color swatch used instead) */
  icon?: string;
  hidden?: boolean;
  onToggle: () => void;
}

function getIconEl(name: string | undefined, size: number, color?: string) {
  if (!name) return null;
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }> | undefined>)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}

function VisibilityRow({ item }: { item: VisibilityItem }) {
  const hidden = !!item.hidden;
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted">
      {item.icon ? (
        <span className="shrink-0">{getIconEl(item.icon, 12, item.color)}</span>
      ) : (
        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
      )}
      <span className={cn("flex-1 text-xs text-foreground truncate", hidden && "text-muted-foreground line-through")}>
        {item.label}
      </span>
      <button
        onClick={item.onToggle}
        aria-label={hidden ? `Afficher ${item.label}` : `Masquer ${item.label}`}
        title={hidden ? "Afficher" : "Masquer"}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors shrink-0"
      >
        {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

function VisibilitySection({ title, items }: { title: string; items: VisibilityItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="px-2 pb-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-2">
        {title}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <VisibilityRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({ onNewEvent }: SidebarProps) {
  const { currentDate, setCurrentDate, weekStartsOnMonday, sidebarOpen } = useUIStore();
  const { connections, updateConnection } = useConnectionStore();
  const { types, updateType } = useEventTypeStore();
  const [miniDate, setMiniDate] = useState(currentDate);
  const weekStart = weekStartsOnMonday ? 1 : 0;

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
      {/* New event */}
      <div className="p-3">
        <button
          onClick={onNewEvent}
          className="flex items-center gap-2 w-full rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} />
          Nouvel événement
        </button>
      </div>

      {/* Mini calendar */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setMiniDate(subMonths(miniDate, 1))} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-foreground capitalize">
            {format(miniDate, "MMMM yyyy", { locale: fr })}
          </span>
          <button onClick={() => setMiniDate(addMonths(miniDate, 1))} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
            <ChevronRight size={14} />
          </button>
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

      {/* Quick hide — sources & types */}
      <div className="border-t border-border pt-2 flex-1 overflow-y-auto">
        <VisibilitySection
          title="Sources"
          items={connections.map((c: Connection) => ({
            id: c.id,
            label: c.name,
            color: c.color,
            hidden: c.hidden,
            onToggle: () => updateConnection({ ...c, hidden: !c.hidden }),
          }))}
        />
        <VisibilitySection
          title="Types"
          items={types.map((t: EventType) => ({
            id: t.id,
            label: t.label,
            color: t.color,
            icon: t.icon,
            hidden: t.hidden,
            onToggle: () => updateType({ ...t, hidden: !t.hidden }),
          }))}
        />
      </div>
    </aside>
  );
}
