/**
 * Thin fetch-based adapter over a self-hosted keeper.sh instance's REST API
 * (`/api/v1`) — list a connection's calendar and fetch its events. No SDK
 * dependency (research.md Decision B); the surface this feature actually
 * needs is small enough that a generic fetch wrapper is simpler.
 *
 * keeper.sh itself is configured per-source (credentials for Google/Outlook/
 * iCloud/CalDAV/ICS); this adapter only needs keeper.sh's own base URL and
 * bearer token, read from server-side environment variables, and a
 * per-connection external calendar id supplied by the imported config.
 */

export interface KeeperConfig {
  baseUrl: string;
  token: string;
}

export interface KeeperEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
  notes?: string;
}

export function getKeeperConfig(): KeeperConfig | null {
  const baseUrl = process.env.KEEPER_BASE_URL;
  const token = process.env.KEEPER_API_TOKEN;
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

async function keeperFetch<T>(config: KeeperConfig, path: string): Promise<T> {
  const url = new URL(path, config.baseUrl).toString();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!res.ok) {
    throw new Error(`keeper.sh request failed: ${res.status} ${res.statusText} (${path})`);
  }
  return (await res.json()) as T;
}

/** Lists the calendars keeper.sh currently knows about (one per configured source). */
export async function listCalendars(config: KeeperConfig): Promise<Array<{ id: string; name: string }>> {
  const data = await keeperFetch<unknown>(config, "/api/v1/calendars");
  const list = Array.isArray(data) ? data : ((data as { calendars?: unknown[] })?.calendars ?? []);
  return (list as Array<Record<string, unknown>>).map((c) => ({ id: String(c.id), name: String(c.name ?? c.title ?? c.id) }));
}

function pick(e: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (e[k] !== undefined && e[k] !== null) return e[k];
  return undefined;
}

/**
 * Fetches a calendar's events from GET /api/v1/events (calendarId, from, to).
 * keeper.sh's README documents the query but not the response shape, so field
 * names are read tolerantly (title|summary, start|startTime, ...).
 */
export async function getEvents(config: KeeperConfig, calendarId: string): Promise<KeeperEvent[]> {
  const day = 86_400_000;
  const from = new Date(Date.now() - 30 * day).toISOString();
  const to = new Date(Date.now() + 365 * day).toISOString();
  const query = new URLSearchParams({ calendarId, from, to });
  const data = await keeperFetch<unknown>(config, `/api/v1/events?${query}`);
  const list = Array.isArray(data) ? data : ((data as { events?: unknown[] })?.events ?? []);
  return (list as Array<Record<string, unknown>>).map((e) => ({
    id: String(pick(e, "id", "uid")),
    title: String(pick(e, "title", "summary", "name") ?? ""),
    start: String(pick(e, "start", "startTime", "startAt")),
    end: String(pick(e, "end", "endTime", "endAt", "start", "startTime")),
    allDay: Boolean(pick(e, "allDay", "isAllDay")),
    location: pick(e, "location") as string | undefined,
    notes: (pick(e, "description", "notes") as string | undefined) ?? undefined,
  }));
}
