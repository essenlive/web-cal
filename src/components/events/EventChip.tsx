import { memo } from "react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn, firstGrapheme } from "../../lib/utils";
import { findMatchingRule } from "../../lib/rules";
import { useEventTypeStore } from "../../store";
import { SimpleTooltip } from "../ui/tooltip";
import type { CalendarEvent, CalendarView, Connection, DisplayStyle, EventType, Rule } from "../../types";

interface EventChipProps {
  event: CalendarEvent;
  eventType?: EventType;
  onClick?: (e?: React.MouseEvent) => void;
  /** Hides the icon in block style (used in compact month-view cells). */
  compact?: boolean;
  view?: CalendarView;
  /** Aggregation lists (overflow popovers/modals) always need a titled row, even for
   *  avatar/day styles that render as nothing (or an icon-only bubble) in the grid. */
  listMode?: boolean;
}

function getIcon(name: string | undefined, size: number, color?: string) {
  if (!name) return null;
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}

/**
 * Content shown inside an avatar-* badge circle: the event's first letter when
 * the type opts into `badgeLetter`, otherwise the type's icon (or nothing).
 */
export function getBadgeContent(type: EventType | undefined, title: string, size: number, color = "#fff") {
  if (type?.badgeLetter) {
    return <span style={{ color, fontSize: size, lineHeight: 1, fontWeight: 600 }}>{firstGrapheme(title).toUpperCase()}</span>;
  }
  return getIcon(type?.icon, size, color);
}

/**
 * Returns the effective EventType for an event by resolving the rules engine only —
 * the first enabled rule matching this event, in priority order. The catch-all rule
 * always resolves to the default type; any other rule whose target type has since
 * been deleted (a "broken" rule) also falls back to the default type.
 */
export function resolveEventType(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  rules: Rule[],
): EventType {
  const matched = findMatchingRule(event, rules);
  if (matched.matchType === "all") return useEventTypeStore.getState().getDefaultType();
  return getType(matched.displayTypeId) ?? useEventTypeStore.getState().getDefaultType();
}

/**
 * True if `event` must be excluded from every calendar view because its source
 * connection is hidden, or because its resolved effective display type is hidden.
 * Hiding never deletes or alters the underlying connection/type configuration —
 * it is a pure display-time filter (see specs/004-quick-hide).
 */
export function isEventHidden(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection: (calendarId: string) => Connection | undefined,
  rules: Rule[],
): boolean {
  if (getConnection(event.calendarId)?.hidden) return true;
  const type = resolveEventType(event, getType, rules);
  return !!type?.hidden;
}

/** Timed events use the type's timedStyle. All-day events use the type's allDayStyle. Both are fully configurable. */
export function resolveStyle(
  type: EventType | undefined,
  _view: CalendarView,
  allDay: boolean
): DisplayStyle {
  if (!allDay) return type?.timedStyle ?? "block";
  return type?.allDayStyle ?? "background";
}

export const EventChip = memo(function EventChip({ event, eventType, onClick, compact = false, view = "month", listMode = false }: EventChipProps) {
  const color = eventType?.color ?? "#6366f1";
  const icon  = eventType?.icon;
  const style = listMode ? "block" : resolveStyle(eventType, view, event.allDay);

  const stopProp = (fn?: (e?: React.MouseEvent) => void) =>
    (e: React.MouseEvent) => { e.stopPropagation(); fn?.(e); };

  // ── Avatar badge (circular icon or letter) ────────────────────────────────
  if (style === "avatar-tr" || style === "avatar-bl" || style === "avatar-br") {
    return (
      <SimpleTooltip label={event.title}>
        <div
          onClick={stopProp(onClick)}
          className="inline-flex size-6 rounded-full items-center justify-center cursor-pointer shrink-0
                     transition-all hover:scale-110 active:scale-95 hover:brightness-90 shadow-xs"
          style={{ backgroundColor: color }}
        >
          {getBadgeContent(eventType, event.title, 13)}
        </div>
      </SimpleTooltip>
    );
  }

  // ── Whole-cell styles — return null, rendering handled by parent cell ─────
  if (style === "text" || style === "background" || style === "border-top" || style === "border-bottom") {
    return null;
  }

  // ── Block — full-width chip with title ────────────────────────────────────
  return (
    <SimpleTooltip label={event.title}>
      <div
        onClick={stopProp(onClick)}
        className={cn(
          "w-full cursor-pointer select-none overflow-hidden rounded-md px-2 py-0.5",
          "text-xs font-medium text-white transition-all hover:brightness-90 active:scale-95"
        )}
        style={{ backgroundColor: color }}
      >
        <div className="flex items-center gap-1 min-w-0">
          {!compact && getIcon(icon, 10, "#fff")}
          <span className="truncate">{event.title}</span>
        </div>
      </div>
    </SimpleTooltip>
  );
});
