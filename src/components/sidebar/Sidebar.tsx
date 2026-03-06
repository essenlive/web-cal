import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, addMonths, subMonths, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store";

interface SidebarProps {
  onNewEvent: () => void;
}

export function Sidebar({ onNewEvent }: SidebarProps) {
  const { currentDate, setCurrentDate, weekStartsOnMonday, sidebarOpen } = useUIStore();
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
    </aside>
  );
}
