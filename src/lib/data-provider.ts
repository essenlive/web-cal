import type { CalendarEvent } from "../types";

/** All sources are read-only — there is no write path (FR-016). */
export interface DataProvider {
  getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
}
