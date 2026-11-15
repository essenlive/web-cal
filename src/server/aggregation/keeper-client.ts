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
  return keeperFetch(config, "/api/v1/calendars");
}

/** Fetches a single calendar's events from keeper.sh, for the connection identified by `calendarId`. */
export async function getEvents(config: KeeperConfig, calendarId: string): Promise<KeeperEvent[]> {
  const path = `/api/v1/calendars/${encodeURIComponent(calendarId)}/events`;
  return keeperFetch(config, path);
}
