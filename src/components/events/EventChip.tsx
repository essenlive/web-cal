import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import type { CalendarEvent, CalendarView, Connection, DisplayStyle, EventType } from "../../types";

interface EventChipProps {
  event: CalendarEvent;
  eventType?: EventType;
  onClick?: (e?: React.MouseEvent) => void;
  /** Hides the icon in block style (used in compact month-view cells). */
  compact?: boolean;
  view?: CalendarView;
}

function getIcon(name: string | undefined, size: number, color?: string) {
  if (!name) return null;
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}

/**
 * Returns the effective EventType for an event using a 4-level precedence chain:
 *  1. Per-event "custom" fields (highest priority)
 *  2. Named EventType from the store matching event.eventTypeId
 *  3. Calendar-level display type (connection.displayTypeId)
 *  4. Application default type (defaultTypeId)
 */
export function resolveEventType(
  event: CalendarEvent,
  getType: (id: string) => EventType | undefined,
  getConnection?: (calendarId: string) => Connection | undefined,
  defaultTypeId?: string,
): EventType | undefined {
  // Level 1: per-event custom configuration
  if (event.eventTypeId === "custom") {
    return {
      id: "custom",
      label: "Personnalisé",
      color: event.customColor ?? "#6366f1",
      icon: event.customIcon ?? "Calendar",
      allDayStyle: event.customAllDayStyle ?? "block",
      timedStyle: event.customTimedStyle ?? "block",
    };
  }

  // Level 2: named display type on the event itself
  const namedType = getType(event.eventTypeId);
  if (namedType) return namedType;

  // Level 3: calendar-level display type from the connection
  if (getConnection) {
    const conn = getConnection(event.calendarId);
    if (conn?.displayTypeId) {
      const calType = getType(conn.displayTypeId);
      if (calType) return calType;
    }
  }

  // Level 4: application default type
  if (defaultTypeId) return getType(defaultTypeId);

  return undefined;
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
  defaultTypeId?: string,
): boolean {
  if (getConnection(event.calendarId)?.hidden) return true;
  const type = resolveEventType(event, getType, getConnection, defaultTypeId);
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

export function EventChip({ event, eventType, onClick, compact = false, view = "month" }: EventChipProps) {
  const color = eventType?.color ?? "#6366f1";
  const icon  = eventType?.icon;
  const style = resolveStyle(eventType, view, event.allDay);

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
