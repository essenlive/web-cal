export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getDb } = await import("./server/config/db");
  const { startScheduler } = await import("./server/aggregation/scheduler");
  startScheduler(getDb());
}
