/** In-memory failed-attempt limiter, keyed by client address. Enough for a single self-hosted instance. */
const WINDOW_MS = 10 * 60_000;
const MAX_FAILURES = 5;

const failures = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const kept = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, kept);
  return kept;
}

export function isLockedOut(key: string, now = Date.now()): boolean {
  return recent(key, now).length >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()): void {
  recent(key, now).push(now);
}

export function clearFailures(key: string): void {
  failures.delete(key);
}

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
