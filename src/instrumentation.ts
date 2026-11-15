export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.KEEPER_BASE_URL || !process.env.KEEPER_API_TOKEN) return;
  const { getDb } = await import("./server/config/db");
  const { startScheduler } = await import("./server/aggregation/scheduler");
  startScheduler(getDb());
}
