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

/** One calendar endpoint the server can read from and, optionally, write to. */
export interface Connector {
  listCalendars(): Promise<ConnectorCalendar[]>;
  getEvents(range: TimeRange, calendarId?: string): Promise<Array<Omit<CalendarEvent, "calendarId" | "eventTypeId">>>;
  /** Absent on read-only connectors. Returns the created event's uid. */
  createEvent?(event: NewEvent, calendarId?: string): Promise<string>;
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
