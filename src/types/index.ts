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
  /** How all-day events are displayed. */
  allDayStyle: DisplayStyle;
  /** How timed (scheduled) events are displayed. Defaults to "block". */
  timedStyle: DisplayStyle;
  /** When true, events resolving to this type are excluded from all calendar views. Config is preserved. */
  hidden?: boolean;
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
  customTimedStyle?: DisplayStyle;
}

export type CalendarView = "month" | "week" | "day" | "agenda";

// ── Connection types ──────────────────────────────────────────────────────────

/**
 * Runtime-only connection health status. Never persisted.
 * Derived during getEvents() calls in DataProviderContext.
 */
export type ConnectionStatus = "unchecked" | "loading" | "active" | "error";

/** Keyed by Connection.id — tracks live health of each connection. */
export type ConnectionStatusMap = Record<string, ConnectionStatus>;

/** Read-only ICS/WebCal subscription. */
export interface WebCalConnection {
  type: "webcal";
  /** Stable UUID generated at creation time. */
  id: string;
  /** User-supplied display name, e.g. "Work Holidays". */
  name: string;
  /** https:// or webcal:// URL pointing to an .ics feed. */
  url: string;
  /** Hex color string, e.g. "#6366f1". */
  color: string;
  /** Optional CORS proxy prefix URL. */
  proxyUrl?: string;
  /** Optional display type applied to all events from this calendar. References EventType.id. */
  displayTypeId?: string;
  /** When true, this connection's events are excluded from all calendar views. Config/credentials are preserved. */
  hidden?: boolean;
}

/** CalDAV server connection (RFC 4791). Read-only in v1. */
export interface CalDAVConnection {
  type: "caldav";
  /** Stable UUID generated at creation time. */
  id: string;
  /** User-supplied display name, e.g. "Nextcloud – Personal". */
  name: string;
  /** CalDAV principal or calendar collection URL. */
  url: string;
  /** Account username or email. */
  username: string;
  /** Account password or app-specific password. Stored in localStorage only. */
  password: string;
  /** Hex color string, e.g. "#6366f1". */
  color: string;
  /** Optional CORS proxy prefix URL. */
  proxyUrl?: string;
  /** Optional display type applied to all events from this calendar. References EventType.id. */
  displayTypeId?: string;
  /** When true, this connection's events are excluded from all calendar views. Config/credentials are preserved. */
  hidden?: boolean;
}

/**
 * Discriminated union — use `conn.type` to narrow to the specific variant.
 * TypeScript provides exhaustive narrowing via switch/case.
 */
export type Connection = WebCalConnection | CalDAVConnection;
