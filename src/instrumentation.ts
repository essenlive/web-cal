export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Server mode is opt-in: a client-only instance (no ADMIN_TOKEN) never opens the
  // SQLite file nor starts the aggregation scheduler.
  if (!process.env.ADMIN_TOKEN) return;
  const { getDb } = await import("./server/config/db");
  const { startScheduler } = await import("./server/aggregation/scheduler");
  startScheduler(getDb());
}
