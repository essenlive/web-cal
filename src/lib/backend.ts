/**
 * The one door from the web client to the Overcal server it is served from. Everything the
 * client asks of the server — events, event edits, settings — goes through `ServerBackend`;
 * components and providers no longer build `fetch` calls or auth headers themselves.
 * `useBackend()` returns null while this browser is not linked, i.e. the client-only mode.
 *
 * Login, pairing and device management (`/api/auth/*`) stay in the Server tab: they run
 * before a session exists, so they don't belong behind an authenticated backend.
 */

import { useMemo } from "react";
import { useServerStore } from "../store/server";
import { parseRetryAfterMs } from "./data-provider";
import { serverHeaders } from "./server-api";
import type { CalendarEvent } from "../types";

/** A non-2xx answer. `status` 404/503 mean "no usable server here" to callers that can fall back. */
export class BackendError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfterMs: number | null = null, readonly body: unknown = null) {
    super(message);
    this.name = "BackendError";
  }
}

export interface ServerConnectionEvents {
  name: string;
  color: string;
  events: CalendarEvent[];
  lastSyncedAt: number | null;
  lastError: string | null;
  writable: boolean;
}

export interface NewEventInput {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  notes?: string;
}

export interface EventPatchInput {
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
}

/** Whole settings document as the server returns it (see server/config/settings.ts). */
export interface ServerSettingsDocument {
  v: number;
  revs?: Record<string, number>;
  [section: string]: unknown;
}

export type PutSectionResult = { ok: true; rev: number } | { ok: false; rev: number; value: unknown };

export class ServerBackend {
  constructor(private token: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const json = init.body !== undefined;
    return fetch(path, { ...init, headers: serverHeaders(this.token, json ? { "Content-Type": "application/json" } : {}) });
  }

  private async fail(res: Response): Promise<never> {
    const body = await res.json().catch(() => null);
    const detail = (body as { error?: string } | null)?.error;
    throw new BackendError(res.status, detail ?? `Le serveur a répondu HTTP ${res.status}.`, parseRetryAfterMs(res.headers.get("retry-after")), body);
  }

  /** Snapshot events per connection overlapping [from, to], optionally for one connection. */
  async events(from: Date, to: Date, connectionId?: string): Promise<Record<string, ServerConnectionEvents>> {
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (connectionId) params.set("connectionId", connectionId);
    const res = await this.request(`/api/events?${params}`);
    if (!res.ok) return this.fail(res);
    return ((await res.json()) as { connections?: Record<string, ServerConnectionEvents> }).connections ?? {};
  }

  async createEvent(connectionId: string, event: NewEventInput): Promise<void> {
    const res = await this.request("/api/events", { method: "POST", body: JSON.stringify({ connectionId, event }) });
    if (!res.ok) return this.fail(res);
  }

  /** `etag` is the tag of the last sync; a changed event answers 412 (BackendError.status). */
  async updateEvent(connectionId: string, id: string, etag: string | undefined, patch: EventPatchInput): Promise<void> {
    const res = await this.request("/api/events", { method: "PATCH", body: JSON.stringify({ connectionId, id, etag, patch }) });
    if (!res.ok) return this.fail(res);
  }

  async deleteEvent(connectionId: string, id: string, etag: string | undefined): Promise<void> {
    const res = await this.request("/api/events", { method: "DELETE", body: JSON.stringify({ connectionId, id, etag }) });
    if (!res.ok) return this.fail(res);
  }

  async getSettings(): Promise<ServerSettingsDocument> {
    const res = await this.request("/api/settings", { cache: "no-store" });
    if (!res.ok) return this.fail(res);
    return (await res.json()) as ServerSettingsDocument;
  }

  /** Writes one section; a stale `baseRev` is a normal outcome (`ok: false`), not an error. */
  async putSection(section: string, baseRev: number, value: unknown): Promise<PutSectionResult> {
    const res = await this.request(`/api/settings/${section}`, { method: "PUT", body: JSON.stringify({ baseRev, value }) });
    if (res.status === 409) {
      const body = (await res.json()) as { rev: number; value: unknown };
      return { ok: false, rev: body.rev, value: body.value };
    }
    if (!res.ok) return this.fail(res);
    return { ok: true, rev: ((await res.json()) as { rev: number }).rev };
  }
}

/** The backend this browser is linked to, or null when it runs client-only. */
export function useBackend(): ServerBackend | null {
  const token = useServerStore((s) => s.token);
  const session = useServerStore((s) => s.session);
  return useMemo(() => (token || session ? new ServerBackend(token) : null), [token, session]);
}
