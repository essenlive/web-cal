import { useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, startOfDay, addDays, format,
} from "date-fns";
import { zonedNow } from "../../lib/timezone";
import { useUIStore } from "../../store";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import { DayCell, classifyDayEvents } from "./DayCell";
import type { CalendarEvent } from "../../types";

const DAY_LABELS_MON = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const DAY_LABELS_SUN = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onEventClick: (e: CalendarEvent) => void;
}

// ── MonthView ─────────────────────────────────────────────────────────────────

export function MonthView({ onEventClick }: Props) {
  const { visibleEvents: events, resolved } = useResolvedEvents();
  const { currentDate, weekStartsOnMonday, timezone } = useUIStore();

  const weekStartsOn = weekStartsOnMonday ? 1 : 0;
  const today = startOfDay(zonedNow(timezone));
  const dayLabels = weekStartsOnMonday ? DAY_LABELS_MON : DAY_LABELS_SUN;

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentDate, weekStartsOn]);

  // Buckets every visible event by the day(s) it occupies, once per (events, days)
  // change, instead of each of the 42 day cells linearly re-scanning the full event
  // list on every render — see specs/008-events-perf-caching/research.md Decision G.
  // All-day spans are clipped to the visible grid (days[0]..last) so a multi-year
  // event can't blow up the bucketing loop.
  const dayBuckets = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    if (days.length === 0) return map;
    const gridStart = days[0];
    const gridEndExclusive = addDays(days[days.length - 1], 1);
    const push = (key: string, e: CalendarEvent) => {
      const arr = map.get(key);
      if (arr) arr.push(e); else map.set(key, [e]);
    };
    for (const e of events) {
      if (e.allDay) {
        const eStart = startOfDay(new Date(e.start));
        const eEnd = startOfDay(new Date(e.end));
        let d = eStart < gridStart ? gridStart : eStart;
        const clippedEnd = eEnd > gridEndExclusive ? gridEndExclusive : eEnd;
        while (d < clippedEnd) {
          push(dayKey(d), e);
          d = addDays(d, 1);
        }
      } else {
        const eStart = startOfDay(new Date(e.start));
        if (eStart >= gridStart && eStart < gridEndExclusive) push(dayKey(eStart), e);
      }
    }
    return map;
  }, [events, days]);

  const weeks = useMemo<Date[][]>(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [days]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-border shrink-0 bg-card">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="py-1.5 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((weekDays, wi) => (
        <div key={wi} className="flex-1 grid grid-cols-7 min-h-0">
          {weekDays.map((day) => {
            const dayEvents = dayBuckets.get(dayKey(day)) ?? [];
            const isToday = isSameDay(day, today);
            const isCurrentMonth = isSameMonth(day, currentDate);

            const { timedBlockEvents, trAvatars, blAvatars, brAvatars, cellStyleEvents } =
              classifyDayEvents(dayEvents, resolved);

            return (
              <DayCell
                key={day.toISOString()}
                day={day}
                isToday={isToday}
                isCurrentMonth={isCurrentMonth}
                timedBlockEvents={timedBlockEvents}
                trAvatars={trAvatars}
                blAvatars={blAvatars}
                brAvatars={brAvatars}
                cellStyleEvents={cellStyleEvents}
                onEventClick={onEventClick}
                resolved={resolved}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
