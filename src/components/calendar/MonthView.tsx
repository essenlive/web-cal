import { useMemo, useCallback, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, startOfDay, format,
  addDays, differenceInDays,
} from "date-fns";
import * as Icons from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";
import { useEventsStore, useEventTypeStore, useUIStore } from "../../store";
import { EventChip, resolveEventType, resolveStyle } from "../events/EventChip";
import type { CalendarEvent, EventType } from "../../types";

const DAY_LABELS_MON = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const DAY_LABELS_SUN = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const MAX_VISIBLE_BLOCK = 3;
const MAX_VISIBLE_AVATARS = 3;
const MAX_ALLDAY_LANES = 3;
const LANE_HEIGHT = 20; // px

// ── Types ─────────────────────────────────────────────────────────────────────

interface LanedEvent {
  event: CalendarEvent;
  lane: number;
  colStart: number;  // 0–6
  colEnd: number;    // 0–6, inclusive
  isStart: boolean;  // event's real start falls within this week
  isEnd: boolean;    // event's real end falls within this week
}

interface WeekData {
  weekDays: Date[];
  laned: LanedEvent[];
  overflowPerCol: Map<number, CalendarEvent[]>;
  usedLanes: number;
}

// ── Lane assignment ───────────────────────────────────────────────────────────

function assignLanes(
  allDayBlockEvents: CalendarEvent[],
  weekDays: Date[],
): { laned: LanedEvent[]; overflowPerCol: Map<number, CalendarEvent[]>; usedLanes: number } {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const overlapping = allDayBlockEvents.filter((e) => {
    const eStart = startOfDay(new Date(e.start));
    const eEnd = startOfDay(new Date(e.end)); // exclusive
    return eStart <= weekEnd && eEnd > weekStart;
  });

  // Sort by start ascending, then duration descending
  overlapping.sort((a, b) => {
    const aStart = startOfDay(new Date(a.start));
    const bStart = startOfDay(new Date(b.start));
    if (aStart < bStart) return -1;
    if (aStart > bStart) return 1;
    const aEnd = startOfDay(new Date(a.end));
    const bEnd = startOfDay(new Date(b.end));
    return differenceInDays(bEnd, bStart) - differenceInDays(aEnd, aStart);
  });

  const laned: LanedEvent[] = [];
  const overflowPerCol = new Map<number, CalendarEvent[]>();
  // laneEnds[i] = inclusive colEnd of last event placed in lane i
  const laneEnds: number[] = [];
  let usedLanes = 0;

  for (const e of overlapping) {
    const eStart = startOfDay(new Date(e.start));
    const eEnd = startOfDay(new Date(e.end)); // exclusive

    const clampedStart = eStart < weekStart ? weekStart : eStart;
    const lastDay = addDays(eEnd, -1); // last inclusive day of event
    const clampedEnd = lastDay > weekEnd ? weekEnd : lastDay;

    const colStart = differenceInDays(clampedStart, weekStart);
    const colEnd = differenceInDays(clampedEnd, weekStart);
    const isStart = isSameDay(eStart, clampedStart);
    const isEnd = isSameDay(lastDay, clampedEnd);

    // Find first lane where the last event ended before this one starts
    let lane = laneEnds.findIndex((end) => end < colStart);
    if (lane === -1) lane = laneEnds.length;

    if (lane < MAX_ALLDAY_LANES) {
      laneEnds[lane] = colEnd;
      if (lane + 1 > usedLanes) usedLanes = lane + 1;
      laned.push({ event: e, lane, colStart, colEnd, isStart, isEnd });
    } else {
      // Overflow: record per column
      for (let col = colStart; col <= colEnd; col++) {
        if (!overflowPerCol.has(col)) overflowPerCol.set(col, []);
        overflowPerCol.get(col)!.push(e);
      }
    }
  }

  return { laned, overflowPerCol, usedLanes };
}

// ── EventListModal ────────────────────────────────────────────────────────────

function EventListModal({
  open, onClose, title, events, onEventClick, getType,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  getType: (id: string) => EventType | undefined;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in-0" />
        <Dialog.Content
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border p-4
                     animate-in fade-in-0 zoom-in-95"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="text-sm font-semibold text-foreground mb-3 pr-6">
            {title}
          </Dialog.Title>
          <div className="flex flex-col gap-1.5">
            {events.map((e) => (
              <EventChip
                key={e.id}
                event={e}
                eventType={resolveEventType(e, getType)}
                onClick={() => { onClose(); onEventClick(e); }}
                view="month"
              />
            ))}
          </div>
          <Dialog.Close asChild>
            <button className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <Icons.X size={14} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── AllDayBar ─────────────────────────────────────────────────────────────────

function AllDayBar({
  le, onEventClick, getType,
}: {
  le: LanedEvent;
  onEventClick: (e: CalendarEvent) => void;
  getType: (id: string) => EventType | undefined;
}) {
  const type = resolveEventType(le.event, getType);
  const color = type?.color ?? "#6366f1";
  const colWidth = 100 / 7;
  const rLeft = le.isStart ? "5px" : "0px";
  const rRight = le.isEnd ? "5px" : "0px";

  return (
    <div
      onClick={(ev) => { ev.stopPropagation(); onEventClick(le.event); }}
      title={le.event.title}
      className="absolute cursor-pointer hover:brightness-90 active:brightness-75 transition-all select-none overflow-hidden flex items-center"
      style={{
        left: `calc(${le.colStart} * ${colWidth}% + 2px)`,
        width: `calc(${le.colEnd - le.colStart + 1} * ${colWidth}% - 4px)`,
        top: `${le.lane * LANE_HEIGHT + 2}px`,
        height: `${LANE_HEIGHT - 4}px`,
        backgroundColor: color,
        borderRadius: `${rLeft} ${rRight} ${rRight} ${rLeft}`,
      }}
    >
      {le.isStart && (
        <span className="text-[10px] font-medium text-white px-1.5 truncate leading-none">
          {le.event.title}
        </span>
      )}
    </div>
  );
}

// ── OverflowMoreButton ────────────────────────────────────────────────────────

function OverflowMoreButton({
  col, day, events, usedLanes, onEventClick, getType,
}: {
  col: number;
  day: Date;
  events: CalendarEvent[];
  usedLanes: number;
  onEventClick: (e: CalendarEvent) => void;
  getType: (id: string) => EventType | undefined;
}) {
  const [open, setOpen] = useState(false);
  const colWidth = 100 / 7;

  return (
    <>
      <button
        onClick={(ev) => { ev.stopPropagation(); setOpen(true); }}
        className="absolute text-[10px] text-muted-foreground hover:text-foreground font-medium
                   px-1 rounded hover:bg-muted/50 transition-colors leading-4 whitespace-nowrap"
        style={{
          left: `calc(${col} * ${colWidth}% + 2px)`,
          top: `${usedLanes * LANE_HEIGHT + 2}px`,
        }}
      >
        +{events.length} autre{events.length > 1 ? "s" : ""}
      </button>
      <EventListModal
        open={open}
        onClose={() => setOpen(false)}
        title={format(day, "d MMMM yyyy")}
        events={events}
        onEventClick={onEventClick}
        getType={getType}
      />
    </>
  );
}

// ── AvatarBadge ───────────────────────────────────────────────────────────────

function AvatarBadge({
  event, type, onEdit,
}: {
  event: CalendarEvent;
  type: EventType | undefined;
  onEdit: (e: CalendarEvent) => void;
}) {
  const color = type?.color ?? "#6366f1";
  const Icon = type?.icon ? (Icons as any)[type.icon] : null;
  return (
    <div
      title={event.title}
      onClick={(ev) => { ev.stopPropagation(); onEdit(event); }}
      style={{ backgroundColor: color, pointerEvents: "auto" }}
      className="size-5 sm:size-6 rounded-full flex items-center justify-center cursor-pointer shrink-0
                 shadow-sm transition-all hover:scale-110 active:scale-95"
    >
      {Icon && <Icon size={9} color="#fff" />}
    </div>
  );
}

// ── OverflowPopover (timed events) ────────────────────────────────────────────

function OverflowPopover({
  events, count, onEventClick, getType,
}: {
  events: CalendarEvent[];
  count: number;
  onEventClick: (e: CalendarEvent) => void;
  getType: (id: string) => EventType | undefined;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground font-medium px-1 w-full text-left
                     rounded hover:bg-muted/50 transition-colors leading-4"
          onClick={(e) => e.stopPropagation()}
        >
          +{count} autre{count > 1 ? "s" : ""}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 bg-card border border-border rounded-xl shadow-lg p-2 min-w-[180px] max-w-[240px]
                     flex flex-col gap-1 animate-in fade-in-0 zoom-in-95"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {events.map((e) => (
            <EventChip
              key={e.id}
              event={e}
              eventType={resolveEventType(e, getType)}
              onClick={() => onEventClick(e)}
              view="month"
            />
          ))}
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── DayCell ───────────────────────────────────────────────────────────────────

interface DayCellProps {
  day: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  timedBlockEvents: CalendarEvent[];
  tlAvatars: CalendarEvent[];
  blAvatars: CalendarEvent[];
  brAvatars: CalendarEvent[];
  dayStyleEvents: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (d: Date) => void;
  getType: (id: string) => EventType | undefined;
}

function DayCell({
  day, isToday, isCurrentMonth,
  timedBlockEvents, tlAvatars, blAvatars, brAvatars, dayStyleEvents,
  onEventClick, onSlotClick, getType,
}: DayCellProps) {
  const [avatarModal, setAvatarModal] = useState<{ events: CalendarEvent[]; corner: string } | null>(null);
  const [dayStyleModal, setDayStyleModal] = useState(false);

  const visibleBlock = timedBlockEvents.slice(0, MAX_VISIBLE_BLOCK);
  const hiddenBlock = timedBlockEvents.slice(MAX_VISIBLE_BLOCK);

  const bgColor =
    dayStyleEvents.length === 1
      ? (resolveEventType(dayStyleEvents[0], getType)?.color ?? "#6366f1") + "18"
      : undefined;

  const bgClass = dayStyleEvents.length > 1 ? "bg-muted/30" : "";

  return (
    <div
      className={cn(
        "relative border-b border-r border-border overflow-hidden",
        "hover:bg-muted/20 transition-colors cursor-pointer",
        !isCurrentMonth && "bg-muted/[0.15]",
        bgClass,
      )}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
      onClick={() => onSlotClick(day)}
    >
      {/* Date number */}
      <div className="flex justify-end pt-1 pr-1.5 pb-0.5 shrink-0">
        {dayStyleEvents.length >= 1 ? (
          <button
            className={cn(
              "transition-colors",
              isToday
                ? "inline-flex items-center justify-center size-5 sm:size-6 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-[11px] font-bold leading-none"
                : cn(
                    "text-[11px] sm:text-xs font-medium leading-none underline underline-offset-2 decoration-dotted",
                    isCurrentMonth ? "text-foreground hover:text-primary" : "text-muted-foreground/40",
                  )
            )}
            onClick={(ev) => {
              ev.stopPropagation();
              if (dayStyleEvents.length === 1) {
                onEventClick(dayStyleEvents[0]);
              } else {
                setDayStyleModal(true);
              }
            }}
          >
            {format(day, "d")}
          </button>
        ) : isToday ? (
          <span className="inline-flex items-center justify-center size-5 sm:size-6 rounded-full bg-primary
                           text-primary-foreground text-[10px] sm:text-[11px] font-bold leading-none">
            {format(day, "d")}
          </span>
        ) : (
          <span className={cn(
            "text-[11px] sm:text-xs font-medium leading-none",
            isCurrentMonth ? "text-foreground" : "text-muted-foreground/40",
          )}>
            {format(day, "d")}
          </span>
        )}
      </div>

      {/* Timed block event chips */}
      <div className="flex flex-col gap-[2px] px-1 pb-0.5 min-w-0">
        {visibleBlock.map((e) => (
          <EventChip
            key={e.id}
            event={e}
            eventType={resolveEventType(e, getType)}
            onClick={(ev) => { ev?.stopPropagation(); onEventClick(e); }}
            compact
            view="month"
          />
        ))}
        {hiddenBlock.length > 0 && (
          <OverflowPopover
            events={hiddenBlock}
            count={hiddenBlock.length}
            onEventClick={onEventClick}
            getType={getType}
          />
        )}
      </div>

      {/* Avatar badges — top-left */}
      {tlAvatars.length > 0 && (
        <div
          className="absolute top-1 left-1 flex flex-wrap gap-0.5"
          style={{ maxWidth: "55%", pointerEvents: "none" }}
        >
          {tlAvatars.slice(0, MAX_VISIBLE_AVATARS).map((e) => (
            <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType)} onEdit={onEventClick} />
          ))}
          {tlAvatars.length > MAX_VISIBLE_AVATARS && (
            <button
              onClick={(ev) => { ev.stopPropagation(); setAvatarModal({ events: tlAvatars, corner: "tl" }); }}
              style={{ pointerEvents: "auto" }}
              className="size-5 sm:size-6 rounded-full bg-muted flex items-center justify-center
                         text-[9px] font-semibold text-muted-foreground shrink-0 cursor-pointer
                         hover:bg-muted/80 transition-colors shadow-sm"
            >
              +{tlAvatars.length - MAX_VISIBLE_AVATARS}
            </button>
          )}
        </div>
      )}

      {/* Avatar badges — bottom-left */}
      {blAvatars.length > 0 && (
        <div className="absolute bottom-1 left-1 flex flex-wrap gap-0.5">
          {blAvatars.slice(0, MAX_VISIBLE_AVATARS).map((e) => (
            <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType)} onEdit={onEventClick} />
          ))}
          {blAvatars.length > MAX_VISIBLE_AVATARS && (
            <button
              onClick={(ev) => { ev.stopPropagation(); setAvatarModal({ events: blAvatars, corner: "bl" }); }}
              className="size-5 sm:size-6 rounded-full bg-muted flex items-center justify-center
                         text-[9px] font-semibold text-muted-foreground shrink-0 cursor-pointer
                         hover:bg-muted/80 transition-colors shadow-sm"
            >
              +{blAvatars.length - MAX_VISIBLE_AVATARS}
            </button>
          )}
        </div>
      )}

      {/* Avatar badges — bottom-right */}
      {brAvatars.length > 0 && (
        <div className="absolute bottom-1 right-1 flex flex-wrap gap-0.5">
          {brAvatars.slice(0, MAX_VISIBLE_AVATARS).map((e) => (
            <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType)} onEdit={onEventClick} />
          ))}
          {brAvatars.length > MAX_VISIBLE_AVATARS && (
            <button
              onClick={(ev) => { ev.stopPropagation(); setAvatarModal({ events: brAvatars, corner: "br" }); }}
              className="size-5 sm:size-6 rounded-full bg-muted flex items-center justify-center
                         text-[9px] font-semibold text-muted-foreground shrink-0 cursor-pointer
                         hover:bg-muted/80 transition-colors shadow-sm"
            >
              +{brAvatars.length - MAX_VISIBLE_AVATARS}
            </button>
          )}
        </div>
      )}

      {/* Avatar overflow modal */}
      {avatarModal && (
        <EventListModal
          open={true}
          onClose={() => setAvatarModal(null)}
          title={format(day, "d MMMM yyyy")}
          events={avatarModal.events}
          onEventClick={onEventClick}
          getType={getType}
        />
      )}

      {/* Day-style overflow modal */}
      <EventListModal
        open={dayStyleModal}
        onClose={() => setDayStyleModal(false)}
        title={format(day, "d MMMM yyyy")}
        events={dayStyleEvents}
        onEventClick={onEventClick}
        getType={getType}
      />
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onEventClick: (e: CalendarEvent) => void;
  onSlotClick: (start: Date) => void;
}

// ── MonthView ─────────────────────────────────────────────────────────────────

export function MonthView({ onEventClick, onSlotClick }: Props) {
  const { events } = useEventsStore();
  const { getType } = useEventTypeStore();
  const { currentDate, weekStartsOnMonday } = useUIStore();

  const weekStartsOn = weekStartsOnMonday ? 1 : 0;
  const today = startOfDay(new Date());
  const dayLabels = weekStartsOnMonday ? DAY_LABELS_MON : DAY_LABELS_SUN;

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentDate, weekStartsOn]);

  const getEventsForDay = useCallback((date: Date) => {
    const d = startOfDay(date);
    return events.filter((e) => {
      const eStart = startOfDay(new Date(e.start));
      if (e.allDay) {
        const eEnd = startOfDay(new Date(e.end));
        return d >= eStart && d < eEnd;
      }
      return d.getTime() === eStart.getTime();
    });
  }, [events]);

  // Pre-compute weeks with all-day block spanning bar data
  const weeks = useMemo<WeekData[]>(() => {
    const allDayBlockEvents = events.filter((e) => {
      if (!e.allDay) return false;
      const type = resolveEventType(e, getType);
      return resolveStyle(type, "month", true) === "block";
    });

    const result: WeekData[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      result.push({ weekDays, ...assignLanes(allDayBlockEvents, weekDays) });
    }
    return result;
  }, [days, events, getType]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-border shrink-0 bg-card">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="py-1.5 text-center text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div key={wi} className="flex-1 flex flex-col min-h-0">

          {/* All-day spanning bar strip (only rendered when there are all-day block events) */}
          {(week.usedLanes > 0 || week.overflowPerCol.size > 0) && (
            <div
              className="relative shrink-0"
              style={{
                height: week.usedLanes * LANE_HEIGHT + (week.overflowPerCol.size > 0 ? 18 : 4),
              }}
            >
              {/* Faint column separator lines */}
              {week.weekDays.map((_, colIdx) => colIdx < 6 && (
                <div
                  key={colIdx}
                  className="absolute top-0 bottom-0 border-r border-border/30 pointer-events-none"
                  style={{ left: `${(colIdx + 1) * (100 / 7)}%` }}
                />
              ))}

              {/* Spanning bars */}
              {week.laned.map((le) => (
                <AllDayBar
                  key={`${le.event.id}-w${wi}`}
                  le={le}
                  onEventClick={onEventClick}
                  getType={getType}
                />
              ))}

              {/* "+N more" per overflowed column */}
              {Array.from(week.overflowPerCol.entries()).map(([col, overflowEvents]) => (
                <OverflowMoreButton
                  key={col}
                  col={col}
                  day={week.weekDays[col]}
                  events={overflowEvents}
                  usedLanes={week.usedLanes}
                  onEventClick={onEventClick}
                  getType={getType}
                />
              ))}
            </div>
          )}

          {/* Day cells */}
          <div className="flex-1 grid grid-cols-7">
            {week.weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = isSameMonth(day, currentDate);

              const timedBlockEvents: CalendarEvent[] = [];
              const tlAvatars: CalendarEvent[] = [];
              const blAvatars: CalendarEvent[] = [];
              const brAvatars: CalendarEvent[] = [];
              const dayStyleEvents: CalendarEvent[] = [];

              for (const e of dayEvents) {
                const type = resolveEventType(e, getType);
                const s = resolveStyle(type, "month", e.allDay);
                if (s === "block" && !e.allDay) timedBlockEvents.push(e);
                else if (s === "avatar-tl") tlAvatars.push(e);
                else if (s === "avatar-bl") blAvatars.push(e);
                else if (s === "avatar-br") brAvatars.push(e);
                else if (s === "day") dayStyleEvents.push(e);
                // allDay block events → handled in the strip above
              }

              return (
                <DayCell
                  key={day.toISOString()}
                  day={day}
                  isToday={isToday}
                  isCurrentMonth={isCurrentMonth}
                  timedBlockEvents={timedBlockEvents}
                  tlAvatars={tlAvatars}
                  blAvatars={blAvatars}
                  brAvatars={brAvatars}
                  dayStyleEvents={dayStyleEvents}
                  onEventClick={onEventClick}
                  onSlotClick={onSlotClick}
                  getType={getType}
                />
              );
            })}
          </div>

        </div>
      ))}
    </div>
  );
}
