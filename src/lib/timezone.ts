/**
 * Timezone display support. Events are parsed to absolute-instant ISO strings
 * (webcal-provider.ts) and every calendar view then reads wall-clock fields off
 * a plain JS `Date` via its *local* getters (getHours, format(), isSameDay...),
 * which always reflect the browser's system timezone. To let the user pick a
 * different display timezone without touching every one of those call sites,
 * `toZonedDate` builds a Date whose local getters report the wall-clock time
 * the instant has in the target IANA zone — see useResolvedEvents.ts, which
 * applies this once, at the point events enter the views.
 */

export const SYSTEM_TIMEZONE = "system";

export function listTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [Intl.DateTimeFormat().resolvedOptions().timeZone];
  }
}

export function systemTimezoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timezone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    partsCache.set(timezone, f);
  }
  return f;
}

/** Returns a Date whose local getters (getHours, getDate, date-fns `format`...) report `date`'s wall-clock time in `timezone`. No-op for "system". */
export function toZonedDate(date: Date, timezone: string): Date {
  if (timezone === SYSTEM_TIMEZONE) return date;
  const parts = formatterFor(timezone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"), date.getMilliseconds());
}

/** "Now", as wall-clock fields in `timezone` — for "today"/current-time-line comparisons. */
export function zonedNow(timezone: string): Date {
  return toZonedDate(new Date(), timezone);
}
