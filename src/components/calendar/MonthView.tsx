import { useMemo, useState, memo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, startOfDay, addDays, format,
} from "date-fns";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { SimpleTooltip } from "../ui/tooltip";
import { useUIStore } from "../../store";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import { EventChip, resolveStyle, getBadgeContent } from "../events/EventChip";
import type { CalendarEvent, DisplayStyle, EventType } from "../../types";
import type { ResolvedEvent } from "../../hooks/useResolvedEvents";

const DAY_LABELS_MON = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const DAY_LABELS_SUN = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const MAX_VISIBLE_BLOCK = 3;
const MAX_VISIBLE_AVATARS = 3;

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

// ── EventListModal ────────────────────────────────────────────────────────────

function EventListModal({
  open, onClose, title, events, onEventClick, resolved,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  resolved: Map<string, ResolvedEvent>;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        animation="fade"
        className="max-w-sm rounded-2xl p-4"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="text-sm font-semibold text-foreground mb-3 pr-6">
          {title}
        </DialogTitle>
        <div className="flex flex-col gap-1.5">
          {events.map((e) => (
            <EventChip
              key={e.id}
              event={e}
              eventType={resolved.get(e.id)?.type}
              onClick={() => { onClose(); onEventClick(e); }}
              view="month"
              listMode
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── AvatarBadge ───────────────────────────────────────────────────────────────

const AvatarBadge = memo(function AvatarBadge({
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
      className="size-5 sm:size-6 rounded-full flex items-center justify-center cursor-pointer shrink-0
                 shadow-xs transition-all hover:scale-110 active:scale-95"
    >
      {getBadgeContent(type, event.title, 11)}
    </div>
  );
});

// ── OverflowPopover (timed events) ────────────────────────────────────────────

const OverflowPopover = memo(function OverflowPopover({
  events, count, onEventClick, resolved,
}: {
  events: CalendarEvent[];
  count: number;
  onEventClick: (e: CalendarEvent) => void;
  resolved: Map<string, ResolvedEvent>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground font-medium px-1 w-full text-left
                     rounded hover:bg-muted/50 transition-colors leading-4"
          onClick={(e) => e.stopPropagation()}
        >
          +{count} autre{count > 1 ? "s" : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[180px] max-w-[240px] rounded-xl p-2 flex flex-col gap-1"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {events.map((e) => (
          <EventChip
            key={e.id}
            event={e}
            eventType={resolved.get(e.id)?.type}
            onClick={() => { setOpen(false); onEventClick(e); }}
            view="month"
          />
        ))}
      </PopoverContent>
    </Popover>
  );
});

// ── DayCell ───────────────────────────────────────────────────────────────────

/** One event resolved to a whole-cell-exclusive style ("text" | "background" | "border-top" | "border-bottom"). */
interface CellStyleEntry {
  event: CalendarEvent;
  style: DisplayStyle;
  type: EventType;
}

interface DayCellProps {
  day: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  timedBlockEvents: CalendarEvent[];
  trAvatars: CalendarEvent[];
  blAvatars: CalendarEvent[];
  brAvatars: CalendarEvent[];
  cellStyleEvents: CellStyleEntry[];
  onEventClick: (e: CalendarEvent) => void;
  resolved: Map<string, ResolvedEvent>;
}

const DayCell = memo(function DayCell({
  day, isToday, isCurrentMonth,
  timedBlockEvents, trAvatars, blAvatars, brAvatars, cellStyleEvents,
  onEventClick, resolved,
}: DayCellProps) {
  const [avatarModal, setAvatarModal] = useState<{ events: CalendarEvent[]; corner: string } | null>(null);
  const [cellModalOpen, setCellModalOpen] = useState(false);

  const visibleBlock = timedBlockEvents.slice(0, MAX_VISIBLE_BLOCK);
  const hiddenBlock = timedBlockEvents.slice(MAX_VISIBLE_BLOCK);

  // "First event in the day's list wins the render" for each whole-cell-exclusive slot.
  const labelWinner = cellStyleEvents.find((c) => c.style === "text" || c.style === "background");
  const borderTopWinner = cellStyleEvents.find((c) => c.style === "border-top");
  const borderBottomWinner = cellStyleEvents.find((c) => c.style === "border-bottom");
  const allCellEvents = cellStyleEvents.map((c) => c.event);

  const bgColor =
    isCurrentMonth && labelWinner?.style === "background" ? labelWinner.type.color + "18" : undefined;

  const numberClass = cn(
    "transition-colors",
    isToday
      ? "inline-flex items-center justify-center size-5 sm:size-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none shrink-0"
      : cn(
          "text-xs font-medium leading-none shrink-0",
          allCellEvents.length > 0 && "underline underline-offset-2 decoration-dotted",
          isCurrentMonth ? "text-foreground hover:text-primary" : "text-muted-foreground/40",
        )
  );

  const handleNumberClick = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (allCellEvents.length > 1) setCellModalOpen(true);
    else if (allCellEvents.length === 1) onEventClick(allCellEvents[0]);
  };

  return (
    <div
      className={cn(
        "relative border-b border-r border-border overflow-hidden",
        !isCurrentMonth && "bg-muted/15",
      )}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      {borderTopWinner && (
        <div className="absolute inset-x-0 top-0 h-0.75" style={{ backgroundColor: borderTopWinner.type.color }} />
      )}
      {borderBottomWinner && (
        <div className="absolute inset-x-0 bottom-0 h-0.75" style={{ backgroundColor: borderBottomWinner.type.color }} />
      )}

      {/* Date number + label (background/text style name) */}
      {(() => {
        const dateRow = (
          <div className="flex items-center gap-1 pt-1 pl-1.5 pr-1.5 pb-0.5 shrink-0 min-w-0">
            <button className={numberClass} onClick={handleNumberClick} disabled={allCellEvents.length === 0}>
              {format(day, "d")}
            </button>
            {labelWinner && (
              <span
                className="text-[10px] font-medium truncate min-w-0"
                style={{ color: labelWinner.type.color }}
              >
                {labelWinner.event.title}
              </span>
            )}
          </div>
        );
        return cellStyleEvents.length > 0
          ? <SimpleTooltip label={cellStyleEvents.map((c) => c.event.title).join(", ")}>{dateRow}</SimpleTooltip>
          : dateRow;
      })()}

      {cellModalOpen && (
        <EventListModal
          open={true}
          onClose={() => setCellModalOpen(false)}
          title={format(day, "d MMMM yyyy")}
          events={allCellEvents}
          onEventClick={onEventClick}
          resolved={resolved}
        />
      )}

      {/* Timed block event chips */}
      <div className="flex flex-col gap-[2px] px-1 pb-0.5 mt-4 min-w-0">
        {visibleBlock.map((e) => (
          <EventChip
            key={e.id}
            event={e}
            eventType={resolved.get(e.id)?.type}
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
            resolved={resolved}
          />
        )}
      </div>

      {/* Avatar badges — top-right */}
      {trAvatars.length > 0 && (
        <div
          className="absolute top-1 right-1 flex flex-wrap gap-0.5"
          style={{ maxWidth: "55%", pointerEvents: "none" }}
        >
          {trAvatars.slice(0, MAX_VISIBLE_AVATARS).map((e) => (
            <AvatarBadge key={e.id} event={e} type={resolved.get(e.id)?.type} onEdit={onEventClick} />
          ))}
          {trAvatars.length > MAX_VISIBLE_AVATARS && (
            <button
              onClick={(ev) => { ev.stopPropagation(); setAvatarModal({ events: trAvatars, corner: "tr" }); }}
              style={{ pointerEvents: "auto" }}
              className="size-5 sm:size-6 rounded-full bg-muted flex items-center justify-center
                         text-[10px] font-semibold text-muted-foreground shrink-0 cursor-pointer
                         hover:bg-muted/80 transition-colors shadow-xs"
            >
              +{trAvatars.length - MAX_VISIBLE_AVATARS}
            </button>
          )}
        </div>
      )}

      {/* Avatar badges — bottom-left */}
      {blAvatars.length > 0 && (
        <div className="absolute bottom-1 left-1 flex flex-wrap gap-0.5">
          {blAvatars.slice(0, MAX_VISIBLE_AVATARS).map((e) => (
            <AvatarBadge key={e.id} event={e} type={resolved.get(e.id)?.type} onEdit={onEventClick} />
          ))}
          {blAvatars.length > MAX_VISIBLE_AVATARS && (
            <button
              onClick={(ev) => { ev.stopPropagation(); setAvatarModal({ events: blAvatars, corner: "bl" }); }}
              className="size-5 sm:size-6 rounded-full bg-muted flex items-center justify-center
                         text-[10px] font-semibold text-muted-foreground shrink-0 cursor-pointer
                         hover:bg-muted/80 transition-colors shadow-xs"
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
            <AvatarBadge key={e.id} event={e} type={resolved.get(e.id)?.type} onEdit={onEventClick} />
          ))}
          {brAvatars.length > MAX_VISIBLE_AVATARS && (
            <button
              onClick={(ev) => { ev.stopPropagation(); setAvatarModal({ events: brAvatars, corner: "br" }); }}
              className="size-5 sm:size-6 rounded-full bg-muted flex items-center justify-center
                         text-[10px] font-semibold text-muted-foreground shrink-0 cursor-pointer
                         hover:bg-muted/80 transition-colors shadow-xs"
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
          resolved={resolved}
        />
      )}

    </div>
  );
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onEventClick: (e: CalendarEvent) => void;
}

// ── MonthView ─────────────────────────────────────────────────────────────────

export function MonthView({ onEventClick }: Props) {
  const { visibleEvents: events, resolved } = useResolvedEvents();
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

            const timedBlockEvents: CalendarEvent[] = [];
            const trAvatars: CalendarEvent[] = [];
            const blAvatars: CalendarEvent[] = [];
            const brAvatars: CalendarEvent[] = [];
            const cellStyleEvents: CellStyleEntry[] = [];

            for (const e of dayEvents) {
              const type = resolved.get(e.id)?.type;
              const s = resolveStyle(type, "month", e.allDay);
              if (s === "block") timedBlockEvents.push(e);
              else if (s === "avatar-tr") trAvatars.push(e);
              else if (s === "avatar-bl") blAvatars.push(e);
              else if (s === "avatar-br") brAvatars.push(e);
              else if (type) cellStyleEvents.push({ event: e, style: s, type });
            }

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
