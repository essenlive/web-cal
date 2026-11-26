import type { CalendarEvent } from "../../types";

export interface NewEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  notes?: string;
}

export interface ConnectorCalendar {
  id: string;
  name: string;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

/** Fields an edit may change; absent = unchanged, null clears location/notes. */
export interface EventPatch {
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
}

/** Thrown by write operations; `status` is the HTTP status the API should answer with. */
export class ConnectorError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** One calendar endpoint the server can read from and, optionally, write to. */
export interface Connector {
  listCalendars(): Promise<ConnectorCalendar[]>;
  getEvents(range: TimeRange, calendarId?: string): Promise<Array<Omit<CalendarEvent, "calendarId" | "eventTypeId">>>;
  /** Absent on read-only connectors. Returns the created event's uid. */
  createEvent?(event: NewEvent, calendarId?: string): Promise<string>;
  /** `etag` is the tag the caller last saw; a mismatch fails with ConnectorError 412. Recurring events are refused (422). */
  updateEvent?(uid: string, patch: EventPatch, etag?: string, calendarId?: string): Promise<void>;
  deleteEvent?(uid: string, etag?: string, calendarId?: string): Promise<void>;
}

/** Server-only endpoint settings, attached to an imported connection by id. */
export interface CaldavEndpoint {
  connectionId: string;
  kind: "caldav";
  url: string;
  username: string;
  password: string;
  /** Calendar display name to use; defaults to the first calendar found. */
  calendar?: string;
}
