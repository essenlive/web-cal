import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { findMatchingRule } from "../../lib/rules";
import { useEventTypeStore } from "../../store";
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
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
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

/** Timed events use the type's timedStyle. All-day events use the type's allDayStyle. */
export function resolveStyle(
  type: EventType | undefined,
  _view: CalendarView,
  allDay: boolean
): DisplayStyle {
  if (!allDay) return type?.timedStyle ?? "block";
  return type?.allDayStyle ?? "day";
}

export function EventChip({ event, eventType, onClick, compact = false, view = "month", listMode = false }: EventChipProps) {
  const color = eventType?.color ?? "#6366f1";
  const icon  = eventType?.icon;
  const style = listMode ? "block" : resolveStyle(eventType, view, event.allDay);

  const stopProp = (fn?: (e?: React.MouseEvent) => void) =>
    (e: React.MouseEvent) => { e.stopPropagation(); fn?.(e); };

  // ── Avatar badge (circular icon) ──────────────────────────────────────────
  if (style === "avatar-tl" || style === "avatar-bl" || style === "avatar-br") {
    return (
      <div
        onClick={stopProp(onClick)}
        title={event.title}
        className="inline-flex size-6 rounded-full items-center justify-center cursor-pointer shrink-0
                   transition-all hover:scale-110 active:scale-95 hover:brightness-90 shadow-sm"
        style={{ backgroundColor: color }}
      >
        {getIcon(icon, 11, "#fff")}
      </div>
    );
  }

  // ── Day style — returns null, rendering handled by parent cell ────────────
  if (style === "day") {
    return null;
  }

  // ── Block — full-width chip with title ────────────────────────────────────
  return (
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
  );
}
