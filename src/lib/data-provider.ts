import type { CalendarEvent } from "../types";

/** All sources are read-only — there is no write path (FR-016). */
export interface DataProvider {
  getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
}

/** Human-readable cause for an HTTP status, shown under the sync-error toast instead of the bare code. */
export function describeHttpError(status: number): string {
  switch (status) {
    case 401: return `HTTP 401 — identifiants invalides ou expirés. Vérifiez le nom d'utilisateur et le mot de passe.`;
    case 403: return `HTTP 403 — accès refusé. Vérifiez les autorisations du compte sur ce calendrier.`;
    case 404: return `HTTP 404 — adresse introuvable. Vérifiez l'URL du calendrier.`;
    case 429: return `HTTP 429 — trop de requêtes envoyées au serveur. Réessayez plus tard.`;
    default:
      if (status >= 500) return `HTTP ${status} — le serveur du calendrier est indisponible. Réessayez plus tard.`;
      return `HTTP ${status}`;
  }
}
