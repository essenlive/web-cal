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
  /** Exactly one type has this set. Undeletable; the catch-all rule always resolves to it, and broken rules fall back to it. */
  isDefault?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** Provider-internal collection identifier (CalDAV href, WebCal source id, etc.) */
  calendarId: string;
  /** Ingestion metadata only — display style is resolved exclusively via the rules engine. */
  eventTypeId: string;
  start: string; // ISO
  end: string;   // ISO
  allDay: boolean;
  location?: string;
  notes?: string;
}

export type CalendarView = "month" | "week" | "day" | "agenda";

// ── Rule types ─────────────────────────────────────────────────────────────────

/**
 * How a Rule matches events:
 *  "event"  — matchValue is a CalendarEvent.id
 *  "name"   — matchValue is a regex/text pattern tested against the event title
 *  "source" — matchValue is a Connection.id
 *  "all"    — the catch-all rule; matches every event, matchValue unused
 */
export type RuleMatchType = "event" | "name" | "source" | "all";

export interface Rule {
  id: string;
  matchType: RuleMatchType;
  matchValue: string;
  /** References EventType.id. */
  displayTypeId: string;
  enabled: boolean;
  /** Epoch ms; used only to compute the default insertion position among same-tier rules. */
  createdAt: number;
}

// ── Theme types ────────────────────────────────────────────────────────────────

export type ThemeMode = "light" | "dark";

/**
 * A named, saved appearance: a base light/dark mode plus a single accent color
 * that drives the app's primary/accent/ring CSS tokens (see src/lib/theme.ts).
 * "light" and "dark" ids are reserved for the built-in themes (see BUILTIN_THEMES)
 * and are never stored in useThemeStore.customThemes.
 */
export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  /** Hex color string, e.g. "#6366f1". */
  accent: string;
  /**
   * Google Fonts family name, e.g. "Roboto" (see src/lib/google-fonts.ts).
   * Optional for themes persisted before this field existed. Themes saved by
   * an earlier version of this app may instead hold a full CSS font-family
   * stack (e.g. "'DM Sans', sans-serif") — see rawFamilyName() in lib/theme.ts.
   */
  fontFamily?: string;
  /** CSS length, e.g. "0.75rem". Optional for themes persisted before this field existed. */
  radius?: string;
  /** Base surface colors, hex strings. Unset falls back to the app's per-mode default (see DEFAULT_BASE_COLORS in lib/theme.ts). */
  background?: string;
  card?: string;
  border?: string;
  muted?: string;
}

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

// ── Preset types ───────────────────────────────────────────────────────────────

/**
 * A named, saved combination of connection/event-type visibility. Only the
 * `hidden` boolean is captured per id — nothing else about the connection or
 * event type is duplicated here.
 */
export interface Preset {
  /** Stable UUID generated at creation time. */
  id: string;
  /** Display name, shown in the preset list. Unique case-insensitively across all presets. */
  name: string;
  /** Connection.id → hidden state at save/update time. Absent id = not covered by this preset. */
  connections: Record<string, boolean>;
  /** EventType.id → hidden state at save/update time. Absent id = not covered by this preset. */
  eventTypes: Record<string, boolean>;
}
