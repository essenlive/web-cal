import { useMemo, useCallback, useState, useRef } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, startOfDay, format,
} from "date-fns";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { useEventsStore, useEventTypeStore, useUIStore, useRuleStore, useConnectionStore } from "../../store";
import { EventChip, resolveEventType, resolveStyle, isEventHidden } from "../events/EventChip";
import type { CalendarEvent, EventType, Rule } from "../../types";

const DAY_LABELS_MON = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const DAY_LABELS_SUN = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

const MAX_VISIBLE_BLOCK = 3;
const MAX_VISIBLE_AVATARS = 3;

// ── EventListModal ────────────────────────────────────────────────────────────

function EventListModal({
  open, onClose, title, events, onEventClick, getType, rules,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  getType: (id: string) => EventType | undefined;
  rules: Rule[];
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
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
              eventType={resolveEventType(e, getType, rules)}
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
  events, count, onEventClick, getType, rules,
}: {
  events: CalendarEvent[];
  count: number;
  onEventClick: (e: CalendarEvent) => void;
  getType: (id: string) => EventType | undefined;
  rules: Rule[];
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
            eventType={resolveEventType(e, getType, rules)}
            onClick={() => { setOpen(false); onEventClick(e); }}
            view="month"
          />
        ))}
      </PopoverContent>
    </Popover>
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
  getType: (id: string) => EventType | undefined;
  rules: Rule[];
}

function DayCell({
  day, isToday, isCurrentMonth,
  timedBlockEvents, tlAvatars, blAvatars, brAvatars, dayStyleEvents,
  onEventClick, getType, rules,
}: DayCellProps) {
  const [avatarModal, setAvatarModal] = useState<{ events: CalendarEvent[]; corner: string } | null>(null);
  const [dayStylePopoverOpen, setDayStylePopoverOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openDayStylePopover = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDayStylePopoverOpen(true);
  };
  const scheduleCloseDayStylePopover = () => {
    closeTimer.current = setTimeout(() => setDayStylePopoverOpen(false), 150);
  };

  const visibleBlock = timedBlockEvents.slice(0, MAX_VISIBLE_BLOCK);
  const hiddenBlock = timedBlockEvents.slice(MAX_VISIBLE_BLOCK);

  const bgColor =
    isCurrentMonth && dayStyleEvents.length === 1
      ? (resolveEventType(dayStyleEvents[0], getType, rules)?.color ?? "#6366f1") + "18"
      : undefined;

  const bgClass = isCurrentMonth && dayStyleEvents.length > 1 ? "bg-muted/30" : "";

  return (
    <div
      className={cn(
        "relative border-b border-r border-border overflow-hidden",
        !isCurrentMonth && "bg-muted/[0.15]",
        bgClass,
      )}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      {/* Date number */}
      <div className="flex justify-end pt-1 pr-1.5 pb-0.5 shrink-0">
        {dayStyleEvents.length > 1 ? (
          <Popover open={dayStylePopoverOpen} onOpenChange={setDayStylePopoverOpen}>
            <PopoverTrigger asChild>
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
                onMouseEnter={openDayStylePopover}
                onMouseLeave={scheduleCloseDayStylePopover}
                onClick={(ev) => { ev.stopPropagation(); setDayStylePopoverOpen((o) => !o); }}
              >
                {format(day, "d")}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto min-w-[180px] max-w-[240px] max-h-[280px] overflow-y-auto rounded-xl p-2 flex flex-col gap-1"
              sideOffset={4}
              onOpenAutoFocus={(e) => e.preventDefault()}
              onMouseEnter={openDayStylePopover}
              onMouseLeave={scheduleCloseDayStylePopover}
            >
              {dayStyleEvents.map((e) => (
                <EventChip
                  key={e.id}
                  event={e}
                  eventType={resolveEventType(e, getType, rules)}
                  onClick={() => { setDayStylePopoverOpen(false); onEventClick(e); }}
                  view="month"
                  listMode
                />
              ))}
            </PopoverContent>
          </Popover>
        ) : dayStyleEvents.length === 1 ? (
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
            onClick={(ev) => { ev.stopPropagation(); onEventClick(dayStyleEvents[0]); }}
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
            eventType={resolveEventType(e, getType, rules)}
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
            rules={rules}
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
            <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType, rules)} onEdit={onEventClick} />
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
            <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType, rules)} onEdit={onEventClick} />
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
            <AvatarBadge key={e.id} event={e} type={resolveEventType(e, getType, rules)} onEdit={onEventClick} />
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
          rules={rules}
        />
      )}

    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onEventClick: (e: CalendarEvent) => void;
}

// ── MonthView ─────────────────────────────────────────────────────────────────

export function MonthView({ onEventClick }: Props) {
  const { events: allEvents } = useEventsStore();
  const { getType, types } = useEventTypeStore();
  const { currentDate, weekStartsOnMonday } = useUIStore();
  const { rules } = useRuleStore();
  const { connections } = useConnectionStore();
  const getConnection = useCallback(
    (calendarId: string) => connections.find((c) => c.id === calendarId),
    [connections],
  );
  // `types`/`connections` are listed explicitly because `getType`/`getConnection`
  // are stable function references whose *output* changes without their identity
  // changing — omitting them would leave this memo stale after a hide/show toggle.
  const events = useMemo(
    () => allEvents.filter((e) => !isEventHidden(e, getType, getConnection, rules)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEvents, getType, getConnection, rules, types, connections],
  );

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
            className="py-1.5 text-center text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wide"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((weekDays, wi) => (
        <div key={wi} className="flex-1 grid grid-cols-7 min-h-0">
          {weekDays.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, today);
            const isCurrentMonth = isSameMonth(day, currentDate);

            const timedBlockEvents: CalendarEvent[] = [];
            const tlAvatars: CalendarEvent[] = [];
            const blAvatars: CalendarEvent[] = [];
            const brAvatars: CalendarEvent[] = [];
            const dayStyleEvents: CalendarEvent[] = [];

            for (const e of dayEvents) {
              const type = resolveEventType(e, getType, rules);
              const s = resolveStyle(type, "month", e.allDay);
              if (s === "block") timedBlockEvents.push(e);
              else if (s === "avatar-tl") tlAvatars.push(e);
              else if (s === "avatar-bl") blAvatars.push(e);
              else if (s === "avatar-br") brAvatars.push(e);
              else if (s === "day") dayStyleEvents.push(e);
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
                getType={getType}
                rules={rules}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
