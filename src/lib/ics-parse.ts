/** ICS (RFC 5545) parsing, shared by the browser provider and the server connectors (no browser/store dependencies). */

import ICAL from "ical.js";

// ── ICS parsing (via ical.js — RFC 5545 line folding, TZID, and escaping) ──────

export interface ParsedEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  notes?: string;
}

/** All-day values stay a plain "YYYY-MM-DD" (parsed as UTC midnight elsewhere); timed values become full ISO instants. */
function icsTimeToISO(time: InstanceType<typeof ICAL.Time>): string {
  if (time.isDate) {
    const y = String(time.year).padStart(4, "0");
    const m = String(time.month).padStart(2, "0");
    const d = String(time.day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return time.toJSDate().toISOString();
}

function toParsedEvent(
  event: InstanceType<typeof ICAL.Event>,
  uid: string,
  start: InstanceType<typeof ICAL.Time>,
  end: InstanceType<typeof ICAL.Time>
): ParsedEvent {
  return {
    uid,
    title: event.summary || "(no title)",
    start: icsTimeToISO(start),
    end: icsTimeToISO(end),
    allDay: start.isDate,
    location: event.location || undefined,
    notes: event.description || undefined,
  };
}

/**
 * Returns `null` (distinct from a legitimately empty calendar) when the feed itself can't be
 * parsed. `getAllSubcomponents` is inside the same try as `ICAL.parse`/`new ICAL.Component` —
 * not just those two — because it can itself throw on a syntactically-parseable-but-structurally-
 * empty/malformed body (e.g. a truly empty response): that must still surface as "unreadable
 * feed" (returns null, toasted once by the caller) rather than an uncaught exception, which
 * would otherwise propagate all the way up and get misreported as a connection health failure
 * (backoff/retry/error status) instead of a content problem.
 *
 * Recurring events (RRULE — birthdays, weekly meetings, etc.) are expanded into one
 * ParsedEvent per occurrence overlapping [rangeStart, rangeEnd], honoring EXDATE and
 * per-occurrence RECURRENCE-ID overrides via ical.js's built-in Event/RecurExpansion.
 */
export function parseICS(text: string, rangeStart: Date, rangeEnd: Date): ParsedEvent[] | null {
  let vevents: InstanceType<typeof ICAL.Component>[];
  try {
    const root = new ICAL.Component(ICAL.parse(text));
    vevents = root.getAllSubcomponents("vevent");
  } catch (err) {
    console.warn("[WebCalProvider] Failed to parse ICS feed:", err);
    return null;
  }

  // Recurrence exceptions (VEVENTs carrying RECURRENCE-ID) must be related to their
  // master event before expansion so overrides/cancellations apply.
  const masters: InstanceType<typeof ICAL.Component>[] = [];
  const exceptionsByUid = new Map<string, InstanceType<typeof ICAL.Component>[]>();
  for (const vevent of vevents) {
    const uid = vevent.getFirstPropertyValue("uid") as string | null;
    if (!uid) continue;
    if (vevent.hasProperty("recurrence-id")) {
      const list = exceptionsByUid.get(uid) ?? [];
      list.push(vevent);
      exceptionsByUid.set(uid, list);
    } else {
      masters.push(vevent);
    }
  }

  const rangeStartTime = ICAL.Time.fromJSDate(rangeStart, true);
  const rangeEndTime = ICAL.Time.fromJSDate(rangeEnd, true);

  const events: ParsedEvent[] = [];
  for (const vevent of masters) {
    try {
      const uid = vevent.getFirstPropertyValue("uid") as string;
      const event = new ICAL.Event(vevent, { exceptions: exceptionsByUid.get(uid) });
      if (!event.uid || !event.startDate) continue;

      if (!event.isRecurring()) {
        events.push(toParsedEvent(event, event.uid, event.startDate, event.endDate ?? event.startDate));
        continue;
      }

      const iterator = event.iterator();
      let occurrence: InstanceType<typeof ICAL.Time> | null;
      // ponytail: hard cap guards against a pathological/unbounded rule; a calendar
      // view spans at most a few months so this never binds for real feeds.
      let guard = 0;
      while ((occurrence = iterator.next()) && guard++ < 5000) {
        if (occurrence.compare(rangeEndTime) > 0) break;
        const details = event.getOccurrenceDetails(occurrence);
        if (details.item.component.getFirstPropertyValue("status") === "CANCELLED") continue;
        if (details.endDate.compare(rangeStartTime) < 0) continue;
        events.push(
          toParsedEvent(details.item, `${uid}::${details.recurrenceId.toString()}`, details.startDate, details.endDate)
        );
      }
    } catch (err) {
      console.warn("[WebCalProvider] Skipping malformed VEVENT:", err);
    }
  }
  return events;
}
