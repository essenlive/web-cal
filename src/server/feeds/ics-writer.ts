/**
 * Builds a valid RFC 5545 `.ics` string for a preset, from the current
 * SourceSnapshot rows and the preset's visibility settings — resolving each
 * event through the same rules engine the client uses (rules/resolve.ts), via
 * ical.js's own component/property tree (no separate writer dependency —
 * research.md Decision D).
 */

import ICAL from "ical.js";
import type { SqliteDb } from "../config/db";
import { getAllSnapshots } from "../aggregation/snapshot-store";
import { resolveEventType, isEventHidden } from "../rules/resolve";
import { getConfig } from "../config/import";
import type { CalendarEvent, Connection, EventType, Preset, Rule } from "../../types";

function icalTimeFor(iso: string, allDay: boolean): ICAL.Time {
  if (allDay) {
    return ICAL.Time.fromDateString(iso.slice(0, 10));
  }
  return ICAL.Time.fromJSDate(new Date(iso), true);
}

function addEvent(vcalendar: ICAL.Component, event: CalendarEvent): void {
  const vevent = new ICAL.Component("vevent");
  vevent.addPropertyWithValue("uid", event.id);
  vevent.addPropertyWithValue("summary", event.title);

  const dtstart = new ICAL.Property("dtstart");
  dtstart.setValue(icalTimeFor(event.start, event.allDay));
  vevent.addProperty(dtstart);

  const dtend = new ICAL.Property("dtend");
  dtend.setValue(icalTimeFor(event.end, event.allDay));
  vevent.addProperty(dtend);

  if (event.location) vevent.addPropertyWithValue("location", event.location);
  if (event.notes) vevent.addPropertyWithValue("description", event.notes);

  vcalendar.addSubcomponent(vevent);
}

/** Builds an empty-but-valid VCALENDAR (spec FR-007). */
export function buildEmptyCalendar(): string {
  const vcalendar = new ICAL.Component("vcalendar");
  vcalendar.addPropertyWithValue("prodid", "-//overcal//server feed//FR");
  vcalendar.addPropertyWithValue("version", "2.0");
  return vcalendar.toString();
}

/**
 * Builds the .ics string for the given preset: every event from every
 * connection it doesn't exclude, filtered through the same rules-based
 * hidden-state resolution the client uses, served strictly from the current
 * SourceSnapshot rows (never triggers a fetch itself — spec FR-009).
 */
export function buildPresetFeed(db: SqliteDb, preset: Preset): string {
  const eventTypes = getConfig(db, "eventTypes") as EventType[];
  const rules = getConfig(db, "rules") as Rule[];
  const connections = getConfig(db, "connections") as Connection[];

  const defaultType = eventTypes.find((t) => t.isDefault) ?? eventTypes[0];
  if (!defaultType) return buildEmptyCalendar();

  const getType = (id: string) => eventTypes.find((t) => t.id === id);
  const getConnection = (calendarId: string) => connections.find((c) => c.id === calendarId);

  const vcalendar = new ICAL.Component("vcalendar");
  vcalendar.addPropertyWithValue("prodid", "-//overcal//server feed//FR");
  vcalendar.addPropertyWithValue("version", "2.0");

  const snapshots = getAllSnapshots(db);
  for (const snapshot of snapshots) {
    // A preset's `connections` map says "hidden" per-id; absent id = not restricted (data-model.md validation rules).
    if (preset.connections[snapshot.connectionId] === true) continue;

    for (const event of snapshot.events) {
      if (isEventHidden(event, getType, getConnection, rules, defaultType)) continue;
      const type = resolveEventType(event, getType, rules, defaultType);
      if (preset.eventTypes[type.id] === true) continue;
      addEvent(vcalendar, event);
    }
  }

  return vcalendar.toString();
}
