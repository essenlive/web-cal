import { useEffect, useState } from "react";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { useSourceSync } from "../context/DataProviderContext";

export const PERIOD_PRESETS = [
  { days: 7, label: "7 jours" },
  { days: 28, label: "28 jours" },
  { days: 90, label: "3 mois" },
] as const;

function presetRange(days: number): { from: Date; to: Date } {
  const to = endOfDay(new Date());
  return { from: startOfDay(subDays(to, days - 1)), to };
}

/**
 * Shared "pick a period of events, and make sure it's actually loaded" state — used
 * anywhere a view needs a date range plus the underlying events for it (StatsPage;
 * EventSearch's own date filter could migrate to this later but wasn't touched here).
 * Owns fetching: every from/to change widens the shared event cache via
 * useSourceSync().loadRange, same cache-aware call the search modal's date filter and
 * the "load earlier/later" buttons use — only the still-uncovered gap is fetched.
 */
export function useEventPeriod(initialDays: number = 28) {
  const [range, setRangeState] = useState(() => presetRange(initialDays));
  const [presetDays, setPresetDays] = useState<number | null>(initialDays);
  const [loading, setLoading] = useState(false);
  const { loadRange } = useSourceSync();

  useEffect(() => {
    // Deferred a microtask out, same as EventSearch.tsx's date-filter effect — the
    // linter flags setState called synchronously during the effect body.
    void Promise.resolve().then(() => {
      setLoading(true);
      void loadRange(range.from, range.to).finally(() => setLoading(false));
    });
  }, [range, loadRange]);

  function setPreset(days: number) {
    setPresetDays(days);
    setRangeState(presetRange(days));
  }

  function setCustom(from: Date, to: Date) {
    setPresetDays(null);
    setRangeState({ from: startOfDay(from), to: endOfDay(to) });
  }

  return { from: range.from, to: range.to, presetDays, loading, setPreset, setCustom };
}
