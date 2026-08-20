import { useState, useEffect, useRef, memo } from "react";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import type { ResolvedEvent } from "../../hooks/useResolvedEvents";
import { resolveStyle } from "../events/EventChip";
import { EventChip } from "../events/EventChip";
import type { CalendarEvent, EventType } from "../../types";

const HOUR_HEIGHT = 64; // px per hour
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;

// ── Layout helpers ────────────────────────────────────────────────────────────

interface LayoutEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  colIndex: number;
  colCount: number;
}

function layoutDayEvents(events: CalendarEvent[], day: Date): LayoutEvent[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const timedEvents = events.filter((e) => {
    if (e.allDay) return false;
    const start = new Date(e.start);
    const end = new Date(e.end);
    return start < dayEnd && end > dayStart;
  });

  timedEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Greedy column assignment: find first column where this event doesn't overlap last entry
  const columns: Date[][] = [];
  const assignments: { event: CalendarEvent; colIndex: number }[] = [];

  for (const event of timedEvents) {
    const start = new Date(event.start);
    const end = new Date(event.end);

    let colIndex = columns.findIndex((col) => start >= col[col.length - 1]);
    if (colIndex === -1) {
      colIndex = columns.length;
      columns.push([]);
    }
    columns[colIndex].push(end);
    assignments.push({ event, colIndex });
  }

  const colCount = Math.max(columns.length, 1);

  return assignments.map(({ event, colIndex }) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    const clampedStart = start < dayStart ? dayStart : start;
    const clampedEnd = end > dayEnd ? dayEnd : end;

    const startMinutes = clampedStart.getHours() * 60 + clampedStart.getMinutes();
    const endMinutes = clampedEnd.getHours() * 60 + clampedEnd.getMinutes();
    const durationMinutes = Math.max(endMinutes - startMinutes, 30);

    return {
      event,
      top: (startMinutes / 60) * HOUR_HEIGHT,
      height: (durationMinutes / 60) * HOUR_HEIGHT,
      colIndex,
      colCount,
    };
  });
}

function getAllDayEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const d = startOfDay(day);
  return events.filter((e) => {
    if (!e.allDay) return false;
    const eStart = startOfDay(new Date(e.start));
    const eEnd = startOfDay(new Date(e.end));
    return d >= eStart && d < eEnd;
  });
}

// ── Timed event block ─────────────────────────────────────────────────────────

const TimeEventBlock = memo(function TimeEventBlock({
  event, type, height, use24h,
}: {
  event: CalendarEvent;
  type: EventType | undefined;
  height: number;
  use24h: boolean;
}) {
  const color = type?.color ?? "#6366f1";
  const Icon = type?.icon ? (Icons as unknown as Record<string, LucideIcon>)[type.icon] : null;
  const timeFormat = use24h ? "HH:mm" : "h:mm a";

  return (
    <div
      className="w-full h-full rounded-md overflow-hidden select-none"
      style={{ backgroundColor: color }}
    >
      <div className="flex items-start gap-1 px-1.5 py-0.5 min-w-0 h-full overflow-hidden">
        {Icon && height > 32 && (
          <Icon size={10} color="#fff" className="shrink-0 mt-[3px]" />
        )}
        <div className="min-w-0 overflow-hidden">
          <div className="text-xs font-medium text-white leading-tight truncate">
            {event.title}
          </div>
          {height > 44 && (
            <div className="text-[10px] text-white/75 truncate mt-0.5">
              {format(new Date(event.start), timeFormat)} – {format(new Date(event.end), timeFormat)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ── TimeGridView ──────────────────────────────────────────────────────────────

interface Props {
  days: Date[];
  onEventClick: (e: CalendarEvent) => void;
}

export function TimeGridView({ days, onEventClick }: Props) {
  const { visibleEvents: events, resolved } = useResolvedEvents();
  const { use24h } = useUIStore();
  const typeOf = (e: CalendarEvent): ResolvedEvent["type"] | undefined => resolved.get(e.id)?.type;
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  const [currentMinutes, setCurrentMinutes] = useState(
    today.getHours() * 60 + today.getMinutes(),
  );

  // Scroll to current time on mount
  useEffect(() => {
    const scrollTop = Math.max(0, (currentMinutes / 60) * HOUR_HEIGHT - 120);
    scrollRef.current?.scrollTo({ top: scrollTop, behavior: "instant" as ScrollBehavior });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update current time every minute
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const showCurrentTime = days.some((d) => isSameDay(d, today));
  const currentTimeTop = (currentMinutes / 60) * HOUR_HEIGHT;
  const timeFormat = use24h ? "HH:mm" : "h a";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Horizontal scroll wrapper for narrow screens in week mode */}
      <div className="flex-1 flex flex-col overflow-x-auto overflow-y-hidden">
        <div className={cn("flex-1 flex flex-col min-h-0", days.length > 1 && "min-w-[520px]")}>

          {/* Day header row */}
          <div className="flex shrink-0 border-b border-border bg-card">
            <div className="w-14 sm:w-16 shrink-0" />
            {days.map((day) => {
              const isToday = isSameDay(day, today);
              return (
                <div key={day.toISOString()} className="flex-1 text-center py-2 border-l border-border">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase">
                    {format(day, "EEE", { locale: fr })}
                  </div>
                  <div className={cn(
                    "inline-flex items-center justify-center size-7 rounded-full text-base font-semibold mt-0.5",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground",
                  )}>
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* All-day strip */}
          <div className="flex shrink-0 border-b border-border">
            <div className="w-14 sm:w-16 shrink-0 flex items-center justify-end pr-2 py-1">
              <span className="text-[10px] text-muted-foreground leading-none">jour entier</span>
            </div>
            {days.map((day) => {
              const dayAllDay = getAllDayEventsForDay(events, day);

              // Find first background-style event to color the strip background
              const dayStyleEvent = dayAllDay.find(
                (e) => resolveStyle(typeOf(e), "week", e.allDay) === "background",
              );
              const stripBg = dayStyleEvent
                ? (typeOf(dayStyleEvent)?.color ?? "#6366f1") + "18"
                : undefined;

              const chipEvents = dayAllDay.filter(
                (e) => resolveStyle(typeOf(e), "week", e.allDay) !== "background",
              );

              return (
                <div
                  key={day.toISOString()}
                  className="flex-1 min-h-[28px] border-l border-border p-0.5 flex flex-col gap-0.5"
                  style={stripBg ? { backgroundColor: stripBg } : undefined}
                >
                  {chipEvents.map((e) => (
                    <EventChip
                      key={e.id}
                      event={e}
                      eventType={typeOf(e)}
                      onClick={() => onEventClick(e)}
                      view="week"
                      compact
                    />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Scrollable time grid */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
            <div className="flex" style={{ height: TOTAL_HEIGHT }}>

              {/* Time gutter */}
              <div className="w-14 sm:w-16 shrink-0 relative select-none">
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="absolute right-2 text-[10px] text-muted-foreground tabular-nums"
                    style={{ top: h * HOUR_HEIGHT - 8 }}
                  >
                    {h === 0 ? "" : format(new Date(2000, 0, 1, h), timeFormat)}
                  </div>
                ))}
              </div>

              {/* Day columns area */}
              <div className="flex flex-1 relative">

                {/* Hour separator lines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={`hr-${h}`}
                    className="absolute left-0 right-0 border-t border-border/50 pointer-events-none"
                    style={{ top: h * HOUR_HEIGHT }}
                  />
                ))}

                {/* Half-hour separator lines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={`hh-${h}`}
                    className="absolute left-0 right-0 border-t border-border/25 pointer-events-none"
                    style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}

                {/* Current time indicator */}
                {showCurrentTime && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none z-10 flex items-center"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 -translate-x-1" />
                    <div className="flex-1 h-[2px] bg-primary" />
                  </div>
                )}

                {/* Per-day columns */}
                {days.map((day) => {
                  const isToday = isSameDay(day, today);
                  const layoutEvents = layoutDayEvents(events, day);

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex-1 relative border-l border-border",
                        isToday && "bg-primary/1.5",
                      )}
                    >
                      {layoutEvents.map(({ event, top, height, colIndex, colCount }) => (
                        <div
                          key={event.id}
                          className="absolute p-0.5 z-1"
                          style={{
                            top,
                            height: Math.max(height, HOUR_HEIGHT / 2),
                            left: `${(colIndex / colCount) * 100}%`,
                            width: `${(1 / colCount) * 100}%`,
                          }}
                          onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                        >
                          <TimeEventBlock
                            event={event}
                            type={typeOf(event)}
                            height={Math.max(height, HOUR_HEIGHT / 2)}
                            use24h={use24h}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
