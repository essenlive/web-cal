import { useMemo, useState, useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import type { View, EventProps, SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek as _startOfWeek, getDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { useEventsStore, useEventTypeStore, useUIStore } from "../../store";
import { resolveStyle, resolveEventType } from "../events/EventChip";
import { EventModal } from "../events/EventModal";
import type { CalendarEvent, CalendarView, EventType } from "../../types";

// ── Types ────────────────────────────────────────────────────────────────────

interface RBCEvent {
  title:    string;
  start:    Date;
  end:      Date;
  allDay:   boolean;
  resource: CalendarEvent;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function LucideIcon({ name, size, color }: { name: string; size: number; color?: string }) {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}

/** Circular avatar badge, used both in month dateCellWrapper and in week/day grids. */
function AvatarBadge({
  event, type, onEdit,
}: {
  event: CalendarEvent;
  type: EventType | undefined;
  onEdit: (e: CalendarEvent) => void;
}) {
  const color = type?.color ?? "#6366f1";
  return (
    <div
      title={event.title}
      onClick={(ev) => { ev.stopPropagation(); onEdit(event); }}
      style={{ backgroundColor: color, pointerEvents: "auto" }}
      className="size-6 rounded-full flex items-center justify-center cursor-pointer shadow-sm
                 transition-all hover:scale-110 hover:brightness-90 active:scale-95"
    >
      {type?.icon && <LucideIcon name={type.icon} size={11} color="#fff" />}
    </div>
  );
}

const MESSAGES = {
  today:            "Aujourd'hui",
  previous:         "Précédent",
  next:             "Suivant",
  month:            "Mois",
  week:             "Semaine",
  day:              "Jour",
  agenda:           "Agenda",
  date:             "Date",
  time:             "Heure",
  event:            "Événement",
  allDay:           "Journée",
  showMore:         (n: number) => `+${n} autre${n > 1 ? "s" : ""}`,
  noEventsInRange:  "Aucun événement",
};

// ── Component ────────────────────────────────────────────────────────────────

export function RBCCalendar() {
  const { events }  = useEventsStore();
  const { getType } = useEventTypeStore();
  const { currentDate, setCurrentDate, view, setView, weekStartsOnMonday, use24h } = useUIStore();

  const [modalOpen,     setModalOpen]     = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultStart,  setDefaultStart]  = useState<Date | undefined>();

  // ── Localizer with dynamic week start ────────────────────────────────────
  const localizer = useMemo(() => {
    const locale = {
      ...fr,
      options: { ...fr.options, weekStartsOn: (weekStartsOnMonday ? 1 : 0) as 0 | 1 },
    };
    return dateFnsLocalizer({ format, parse, startOfWeek: _startOfWeek, getDay, locales: { locale } });
  }, [weekStartsOnMonday]);

  // ── Modals ────────────────────────────────────────────────────────────────
  const openEdit = useCallback((e: CalendarEvent) => {
    setSelectedEvent(e);
    setDefaultStart(undefined);
    setModalOpen(true);
  }, []);

  const openCreate = useCallback((start: Date) => {
    setSelectedEvent(null);
    setDefaultStart(start);
    setModalOpen(true);
  }, []);

  // ── Helpers to detect avatar events ──────────────────────────────────────
  const isMonthAvatar = useCallback((e: CalendarEvent) => {
    const s = resolveStyle(resolveEventType(e, getType), "month", e.allDay);
    return s === "avatar-tl" || s === "avatar-bl" || s === "avatar-br";
  }, [getType]);

  /** Returns avatar events for a date, grouped by corner. */
  const getAvatarsForDay = useCallback((date: Date) => {
    const d = startOfDay(date);
    const tl: CalendarEvent[] = [], bl: CalendarEvent[] = [], br: CalendarEvent[] = [];
    for (const e of events) {
      const type = resolveEventType(e, getType);
      const s = resolveStyle(type, "month", e.allDay);
      if (s !== "avatar-tl" && s !== "avatar-bl" && s !== "avatar-br") continue;
      const eStart = startOfDay(new Date(e.start));
      const inDay  = e.allDay
        ? d >= eStart && d < startOfDay(new Date(e.end))
        : d.getTime() === eStart.getTime();
      if (!inDay) continue;
      if (s === "avatar-tl") tl.push(e);
      else if (s === "avatar-bl") bl.push(e);
      else br.push(e);
    }
    return { tl, bl, br };
  }, [events, getType]);

  // ── RBC event array ───────────────────────────────────────────────────────
  // In month view, avatar events are rendered via dateCellWrapper (corners),
  // not as inline event rows. Filter them out of rbcEvents for that view only.
  const rbcEvents = useMemo<RBCEvent[]>(() => {
    const filtered = view === "month"
      ? events.filter((e) => !isMonthAvatar(e))
      : events;
    return filtered.map((e) => ({
      title:    e.title,
      start:    new Date(e.start),
      end:      new Date(e.end),
      allDay:   e.allDay,
      resource: e,
    }));
  }, [events, view, isMonthAvatar]);

  // ── eventPropGetter — styles the RBC event container ─────────────────────
  const eventPropGetter = useCallback((rbcEvt: RBCEvent) => {
    const e     = rbcEvt.resource;
    const type  = resolveEventType(e, getType);
    const v     = view as CalendarView;
    const s     = resolveStyle(type, v, e.allDay);
    const color = type?.color ?? "#6366f1";

    if (s === "day") {
      return {
        style: {
          backgroundColor: color + "28",
          borderLeft:       `3px solid ${color}`,
          border:           "none",
          borderRadius:     "4px",
          boxShadow:        "none",
        },
      };
    }
    if (s === "avatar-tl" || s === "avatar-bl" || s === "avatar-br") {
      // transparent container — badge rendered absolutely inside
      return { style: { backgroundColor: "transparent", border: "none", boxShadow: "none", padding: 0 } };
    }
    // block
    return { style: { backgroundColor: color, border: "none", borderRadius: "6px", boxShadow: "none" } };
  }, [view, getType]);

  // ── dayPropGetter — background color for "day"-style events ──────────────
  const dayPropGetter = useCallback((date: Date) => {
    if (view !== "month") return {};
    const d = startOfDay(date);
    for (const e of events) {
      const type = resolveEventType(e, getType);
      if (!type) continue;
      if (resolveStyle(type, "month", e.allDay) !== "day") continue;
      const eStart = startOfDay(new Date(e.start));
      if (e.allDay) {
        const eEnd = startOfDay(new Date(e.end));
        if (d >= eStart && d < eEnd) return { style: { backgroundColor: type.color + "18" } };
      } else {
        if (d.getTime() === eStart.getTime()) return { style: { backgroundColor: type.color + "18" } };
      }
    }
    return {};
  }, [view, events, getType]);

  // ── dateCellWrapper — avatar badges at cell corners (month only) ──────────
  // Structure: our wrapper div (flex:1 to mimic rbc-day-bg sizing) contains:
  //   • inner absolute div with display:flex → holds rbc-day-bg so it still fills the column
  //   • overlay absolute div (pointer-events:none, z-index:3) → holds the corner badges
  const DateCellWrapper = useCallback(({ value, children }: { value: Date; children?: React.ReactNode }) => {
    const { tl, bl, br } = getAvatarsForDay(value);
    return (
      <div style={{ flex: "1 0 0%", position: "relative" }}>
        {/* rbc-day-bg fill wrapper — keeps backgrounds/hover intact */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {children}
        </div>
        {/* Corner badge overlay */}
        <div style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
          {tl.length > 0 && (
            <div className="absolute top-1 left-1 flex flex-wrap gap-0.5" style={{ maxWidth: "55%" }}>
              {tl.map((e) => <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType)} onEdit={openEdit} />)}
            </div>
          )}
          {bl.length > 0 && (
            <div className="absolute bottom-1 left-1 flex flex-wrap gap-0.5">
              {bl.map((e) => <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType)} onEdit={openEdit} />)}
            </div>
          )}
          {br.length > 0 && (
            <div className="absolute bottom-1 right-1 flex flex-wrap gap-0.5">
              {br.map((e) => <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType)} onEdit={openEdit} />)}
            </div>
          )}
        </div>
      </div>
    );
  }, [getAvatarsForDay, getType, openEdit]);

  // ── Month view event content (block + day styles only; avatars handled above) ──
  const MonthEvent = useCallback(({ event: rbcEvt }: EventProps<RBCEvent>) => {
    const e    = rbcEvt.resource;
    const type = resolveEventType(e, getType);
    const s     = resolveStyle(type, "month", e.allDay);
    const color = type?.color ?? "#6366f1";
    // "day" style: cell background is colored; show title faintly in the event row
    if (s === "day") {
      return (
        <div className="flex items-center min-w-0 w-full px-0.5">
          <span className="text-[9px] font-medium truncate leading-none" style={{ color, opacity: 0.65 }}>
            {e.title}
          </span>
        </div>
      );
    }
    // block
    return (
      <div className="flex items-center gap-1 min-w-0 w-full">
        {type?.icon && <LucideIcon name={type.icon} size={9} color="#fff" />}
        <span className="text-[10px] font-medium text-white truncate leading-none">{e.title}</span>
      </div>
    );
  }, [getType]);

  // ── Week / Day time-grid event content ────────────────────────────────────
  const TimeEvent = useCallback(({ event: rbcEvt }: EventProps<RBCEvent>) => {
    const e    = rbcEvt.resource;
    const type = resolveEventType(e, getType);
    const v: CalendarView = "week";
    const s    = resolveStyle(type, v, e.allDay);
    const color = type?.color ?? "#6366f1";

    if (s === "day") {
      return <span className="text-[10px] font-medium px-1 truncate block" style={{ color }}>{e.title}</span>;
    }
    if (s === "avatar-tl" || s === "avatar-bl" || s === "avatar-br") {
      const posClass =
        s === "avatar-tl" ? "top-0.5 left-0.5" :
        s === "avatar-bl" ? "bottom-0.5 left-0.5" :
        "bottom-0.5 right-0.5";
      return (
        <div className={cn("absolute", posClass)}>
          <div
            title={e.title}
            className="size-6 rounded-full flex items-center justify-center shadow-sm"
            style={{ backgroundColor: color }}
          >
            {type?.icon && <LucideIcon name={type.icon} size={11} color="#fff" />}
          </div>
        </div>
      );
    }
    // block
    return (
      <div className="flex items-center gap-1.5 px-1.5 py-0.5 min-w-0 h-full overflow-hidden">
        {type?.icon && <LucideIcon name={type.icon} size={10} color="#fff" />}
        <span className="text-xs font-medium text-white truncate">{e.title}</span>
      </div>
    );
  }, [getType]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 h-full rbc-wrapper">
      <Calendar<RBCEvent>
        localizer={localizer}
        culture="locale"
        messages={MESSAGES}
        events={rbcEvents}
        date={currentDate}
        onNavigate={setCurrentDate}
        view={view as View}
        onView={(v) => setView(v as CalendarView)}
        selectable
        onSelectEvent={(rbcEvt) => openEdit(rbcEvt.resource)}
        onSelectSlot={({ start }: SlotInfo) => openCreate(start as Date)}
        eventPropGetter={eventPropGetter as any}
        dayPropGetter={dayPropGetter}
        components={{
          dateCellWrapper: DateCellWrapper as any,
          event:           TimeEvent as any,
          month:           { event: MonthEvent as any },
        }}
        formats={{
          timeGutterFormat:     use24h ? "HH:mm" : "h:mm a",
          eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
            `${format(start, use24h ? "HH:mm" : "h:mm a")} – ${format(end, use24h ? "HH:mm" : "h:mm a")}`,
        }}
        popup
        style={{ height: "100%" }}
      />

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        event={selectedEvent}
        defaultStart={defaultStart}
      />
    </div>
  );
}
