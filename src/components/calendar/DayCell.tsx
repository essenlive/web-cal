import { memo, useState } from "react";
import { format } from "date-fns";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { SimpleTooltip } from "../ui/tooltip";
import { useUIStore } from "../../store";
import { EventChip, resolveStyle, getBadgeContent } from "../events/EventChip";
import type { CalendarEvent, DisplayStyle, EventType } from "../../types";
import type { ResolvedEvent } from "../../hooks/useResolvedEvents";

const MAX_VISIBLE_BLOCK = 3;
const MAX_VISIBLE_AVATARS = 2;

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
        onClick={(e) => e.stopPropagation()}
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
    <SimpleTooltip label={event.title}>
      <div
        onClick={(ev) => { ev.stopPropagation(); onEdit(event); }}
        style={{ backgroundColor: color, pointerEvents: "auto" }}
        className="size-5 sm:size-6 rounded-full flex items-center justify-center cursor-pointer shrink-0
                   shadow-xs transition-all hover:scale-110 active:scale-95"
      >
        {getBadgeContent(type, event.title, 11)}
      </div>
    </SimpleTooltip>
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
export interface CellStyleEntry {
  event: CalendarEvent;
  style: DisplayStyle;
  type: EventType;
}

/**
 * Buckets a day's events into the slots DayCell renders: timed "block" chips,
 * the three avatar corners, and the whole-cell-exclusive styles (text/background/
 * border-top/border-bottom). Shared by MonthView's grid and TimeGridView's header
 * so both classify events identically instead of duplicating this switch.
 */
export function classifyDayEvents(
  dayEvents: CalendarEvent[],
  resolved: Map<string, ResolvedEvent>,
) {
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

  return { timedBlockEvents, trAvatars, blAvatars, brAvatars, cellStyleEvents };
}

export interface DayCellProps {
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
  /** Small caption shown above the date number (e.g. "lun."), used by the week/day header
   *  where each column needs its own weekday label. Month view's grid leaves this unset
   *  since the weekday row is shared across the whole column above the grid. */
  weekdayLabel?: string;
  /** "grid" (default) draws the month grid's own bottom/right cell borders. "header" is used
   *  standalone (week/day view header) and only draws a left separator between day columns,
   *  leaving top/bottom borders to the surrounding header chrome. */
  variant?: "grid" | "header";
}

export const DayCell = memo(function DayCell({
  day, isToday, isCurrentMonth,
  timedBlockEvents, trAvatars, blAvatars, brAvatars, cellStyleEvents,
  onEventClick, resolved, weekdayLabel, variant = "grid",
}: DayCellProps) {
  const [avatarModal, setAvatarModal] = useState<{ events: CalendarEvent[]; corner: string } | null>(null);
  const { setCurrentDate, setView } = useUIStore();

  const visibleBlock = timedBlockEvents.slice(0, MAX_VISIBLE_BLOCK);
  const hiddenBlock = timedBlockEvents.slice(MAX_VISIBLE_BLOCK);

  // "First event in the day's list wins the render" for each whole-cell-exclusive slot.
  const labelWinner = cellStyleEvents.find((c) => c.style === "text" || c.style === "background");
  const borderTopWinner = cellStyleEvents.find((c) => c.style === "border-top");
  const borderBottomWinner = cellStyleEvents.find((c) => c.style === "border-bottom");
  const allDayEvents = [
    ...cellStyleEvents.map((c) => c.event),
    ...timedBlockEvents,
    ...trAvatars,
    ...blAvatars,
    ...brAvatars,
  ];
  const hasEvents = allDayEvents.length > 0;

  const bgColor =
    isCurrentMonth && labelWinner?.style === "background" ? labelWinner.type.color + "18" : undefined;

  const numberClass = cn(
    "transition-colors",
    isToday
      ? "inline-flex items-center justify-center size-5 sm:size-6 rounded-full ring-2 ring-inset ring-primary text-primary text-[10px] font-bold leading-none shrink-0"
      : cn(
          "text-xs font-medium leading-none shrink-0",
          hasEvents && "underline underline-offset-2 decoration-dotted",
          isCurrentMonth ? "text-foreground hover:text-primary" : "text-muted-foreground/40",
        )
  );

  // Clicking anywhere in the cell (outside an event/avatar, which stop propagation)
  // jumps the whole calendar to this day's day view.
  const goToDayView = () => { setCurrentDate(day); setView("day"); };

  return (
    <div
      className={cn(
        "relative overflow-hidden cursor-pointer",
        variant === "grid" ? "border-b border-r border-border" : "border-l border-border",
        !isCurrentMonth && "bg-muted/15",
        isToday && "bg-primary/5",
      )}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
      onClick={goToDayView}
    >
      {borderTopWinner && (
        <div className="absolute inset-x-0 top-0 h-0.75" style={{ backgroundColor: borderTopWinner.type.color }} />
      )}
      {borderBottomWinner && (
        <div className="absolute inset-x-0 bottom-0 h-0.75" style={{ backgroundColor: borderBottomWinner.type.color }} />
      )}

      {weekdayLabel && (
        <div className="text-center pt-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {weekdayLabel}
          </span>
        </div>
      )}

      {/* Date number + label (background/text style name) */}
      <div className="flex items-center gap-1 pt-1 pl-1.5 pr-1.5 pb-0.5 shrink-0 min-w-0">
        {hasEvents ? (
          <SimpleTooltip
            label={
              <div className="flex flex-col gap-1">
                {allDayEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: resolved.get(e.id)?.type?.color ?? "#6366f1" }}
                    />
                    <span className="truncate max-w-50">{e.title}</span>
                  </div>
                ))}
              </div>
            }
          >
            <span className={numberClass}>{format(day, "d")}</span>
          </SimpleTooltip>
        ) : (
          <span className={numberClass}>{format(day, "d")}</span>
        )}
        {labelWinner && (
          <span
            className="text-[10px] font-medium truncate min-w-0"
            style={{ color: labelWinner.type.color }}
          >
            {labelWinner.event.title}
          </span>
        )}
      </div>

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
          className="absolute top-1 right-1 flex flex-nowrap gap-0.5"
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
        <div className="absolute bottom-1 left-1 flex flex-nowrap gap-0.5">
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
        <div className="absolute bottom-1 right-1 flex flex-nowrap gap-0.5">
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
