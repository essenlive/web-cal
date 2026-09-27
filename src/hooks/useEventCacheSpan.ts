import { useMemo } from "react";
import { useConnectionSyncMeta } from "../context/DataProviderContext";
import { useConnectionStore } from "../store";

export interface EventCacheSpan {
  start: Date;
  end: Date;
}

/** Union span of every connection's cached range — "what's actually loaded into the shared
 *  event cache right now", as opposed to the period the user has selected (see
 *  useEventPeriod), which may be wider or narrower than what's covered at any given moment
 *  while a fetch is in flight. Null until at least one connection has synced once. */
export function useEventCacheSpan(): EventCacheSpan | null {
  const { connections } = useConnectionStore();
  const syncMeta = useConnectionSyncMeta();

  return useMemo(() => {
    let start: Date | null = null;
    let end: Date | null = null;
    for (const c of connections) {
      const range = syncMeta[c.id]?.cachedRange;
      if (!range) continue;
      const s = new Date(range.start);
      const e = new Date(range.end);
      if (!start || s < start) start = s;
      if (!end || e > end) end = e;
    }
    return start && end ? { start, end } : null;
  }, [connections, syncMeta]);
}
