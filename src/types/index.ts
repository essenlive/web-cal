/**
 * Event position/display style within a calendar cell or time block.
 *
 * avatar-tl  — small icon badge, top-left corner of the cell
 * avatar-bl  — small icon badge, bottom-left corner
 * avatar-br  — small icon badge, bottom-right corner
 * block      — full-width chip with title (classic behaviour)
 * day        — colours the background/border of the whole day cell
 *
 * Timed events always render as "block". This style applies to all-day events.
 */
export type DisplayStyle = "avatar-tl" | "avatar-bl" | "avatar-br" | "block" | "day";

export interface EventType {
  id: string;
  label: string;
  color: string;
  icon: string;
  /** How all-day events are displayed. Timed events always use "block". */
  allDayStyle: DisplayStyle;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** Provider-internal collection identifier (CalDAV href, WebCal source id, etc.) */
  calendarId: string;
  /** Use "custom" for per-event styling via customColor / customIcon / customAllDayStyle */
  eventTypeId: string;
  start: string; // ISO
  end: string;   // ISO
  allDay: boolean;
  location?: string;
  notes?: string;
  // Only used when eventTypeId === "custom"
  customColor?: string;
  customIcon?: string;
  customAllDayStyle?: DisplayStyle;
}

export type CalendarView = "month" | "week" | "day" | "agenda";
