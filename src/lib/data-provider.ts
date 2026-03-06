import type { CalendarEvent, CalendarMeta } from "../types";

export interface DataProvider {
  getCalendars(): Promise<CalendarMeta[]>;
  getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
  createEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent>;
  updateEvent(event: CalendarEvent): Promise<CalendarEvent>;
  deleteEvent(id: string): Promise<void>;
}
