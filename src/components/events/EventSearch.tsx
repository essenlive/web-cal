"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { addMonths, endOfDay, format, parseISO, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowDown, ArrowUp, ChevronDown, Loader2, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useConnectionStore, useEventTypeStore, useUIStore } from "../../store";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import { useSourceSync, windowAround } from "../../context/DataProviderContext";
import { getBadgeContent } from "./EventChip";
import { EventDetail } from "./EventDetail";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { DateRangePicker } from "../ui/date-range-picker";
import { getIconEl } from "../../lib/icons";
import { cn } from "../../lib/utils";
import type { CalendarEvent } from "../../types";

const LOAD_STEP_MONTHS = 3;
const MAX_RESULTS = 50;
/** How far past a single open-ended date bound (only "from" or only "to" set) to widen
 *  the cache-aware `loadRange` call — see the dateFrom/dateTo effect below. */
const OPEN_RANGE_MONTHS = 6;

/** Sorts by closeness to "now" (soonest-upcoming/most-recent first) rather than plain
 *  chronological order — a plain helper (not inlined in a memo) so the Date.now() read
 *  doesn't run during render, same pattern as Sidebar.tsx's connectionStatusDetail(). */
function sortByRelevance(events: CalendarEvent[]): CalendarEvent[] {
  const now = Date.now();
  return [...events].sort(
    (a, b) => Math.abs(parseISO(a.start).getTime() - now) - Math.abs(parseISO(b.start).getTime() - now)
  );
}

const noopSubscribe = () => () => {};
const getIsMacSnapshot = () => /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const getIsMacServerSnapshot = () => false;

/** `navigator` is unavailable during SSR/SSG, so this can't be computed at module scope or
 *  read directly during render — that would render "Ctrl+K" on the server and possibly "⌘K"
 *  after client hydration on a Mac, tripping a hydration mismatch. `useSyncExternalStore`
 *  (rather than a `useState` + `useEffect` pair) reads the real value on the client without
 *  an extra post-mount render. */
function useIsMac(): boolean {
  return useSyncExternalStore(noopSubscribe, getIsMacSnapshot, getIsMacServerSnapshot);
}

/** Global "search all cached events" command palette, opened from the header's search
 *  bar button or Ctrl/Cmd+K from anywhere. Searches `useEventsStore` directly — the
 *  session's already-fetched range cache (see specs/008-events-perf-caching) — rather
 *  than issuing its own fetch; "load earlier/later events" instead widens that shared
 *  cache via `useSourceSync().loadRange`, independent of the visible calendar range. */
export function EventSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loadingDir, setLoadingDir] = useState<"prev" | "next" | null>(null);
  const [extraBack, setExtraBack] = useState(0);
  const [extraForward, setExtraForward] = useState(0);
  const isMac = useIsMac();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(new Set());
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);

  const { setCurrentDate, use24h } = useUIStore();
  const { types } = useEventTypeStore();
  const { connections } = useConnectionStore();
  const { visibleEvents, resolved } = useResolvedEvents();
  const { loadRange } = useSourceSync();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setQuery("");
      setExtraBack(0);
      setExtraForward(0);
      setFiltersOpen(false);
      setSelectedTypeIds(new Set());
      setSelectedSourceIds(new Set());
      setDateFrom(null);
      setDateTo(null);
    }
  };

  const toggleType = (id: string) => {
    setSelectedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSource = (id: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Widens the shared range cache to cover the chosen date filter (same cache-aware
  // `loadRange` the "load earlier/later" buttons use below — only the still-uncovered
  // gap is actually fetched) so the date filter reflects real data instead of silently
  // returning nothing for a range the app just hasn't loaded yet. An open-ended bound
  // (only one of dateFrom/dateTo set) is widened by a fixed OPEN_RANGE_MONTHS rather
  // than fetched unbounded.
  useEffect(() => {
    if (!dateFrom && !dateTo) return;
    // Deferred a microtask out, same as DataProviderContext's own loadWindow effect —
    // the linter flags setState called synchronously during the effect body.
    void Promise.resolve().then(() => {
      const start = dateFrom ?? subMonths(dateTo!, OPEN_RANGE_MONTHS);
      const end = dateTo ? endOfDay(dateTo) : addMonths(dateFrom!, OPEN_RANGE_MONTHS);
      setRangeLoading(true);
      loadRange(start, end).finally(() => setRangeLoading(false));
    });
  }, [dateFrom, dateTo, loadRange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    const rangeEnd = dateTo ? endOfDay(dateTo) : null;
    return visibleEvents.filter((e) => {
      if (q && !(e.title.toLocaleLowerCase("fr").includes(q) || e.location?.toLocaleLowerCase("fr").includes(q))) {
        return false;
      }
      if (selectedTypeIds.size > 0 && !selectedTypeIds.has(resolved.get(e.id)?.type.id ?? "")) return false;
      if (selectedSourceIds.size > 0 && !selectedSourceIds.has(e.calendarId)) return false;
      if (dateFrom && parseISO(e.end) < dateFrom) return false;
      if (rangeEnd && parseISO(e.start) > rangeEnd) return false;
      return true;
    });
  }, [visibleEvents, query, selectedTypeIds, selectedSourceIds, dateFrom, dateTo, resolved]);
  const results = sortByRelevance(filtered).slice(0, MAX_RESULTS);
  const hasActiveFilters =
    selectedTypeIds.size > 0 || selectedSourceIds.size > 0 || dateFrom !== null || dateTo !== null;

  const selectEvent = (e: CalendarEvent) => {
    setOpen(false);
    setCurrentDate(parseISO(e.start));
    setSelectedEvent(e);
  };

  const handleLoad = async (dir: "prev" | "next") => {
    setLoadingDir(dir);
    const center = useUIStore.getState().currentDate;
    const nextBack = dir === "prev" ? extraBack + LOAD_STEP_MONTHS : extraBack;
    const nextForward = dir === "next" ? extraForward + LOAD_STEP_MONTHS : extraForward;
    try {
      const base = windowAround(center);
      await loadRange(
        dir === "prev" ? subMonths(base.start, nextBack) : base.start,
        dir === "next" ? addMonths(base.end, nextForward) : base.end
      );
      setExtraBack(nextBack);
      setExtraForward(nextForward);
    } finally {
      setLoadingDir(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Rechercher un événement"
        className="hidden md:flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
      >
        <Search size={14} />
        <span>Rechercher…</span>
        <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          {isMac ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>
      {/* Mobile: a floating action button over the calendar rather than a header icon —
          frees up header width (see the md breakpoint fix above) and stays reachable
          regardless of scroll position. */}
      <Button
        variant="default"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Rechercher un événement"
        className="md:hidden fixed bottom-5 right-4 z-40 size-14 rounded-full shadow-lg [&_svg]:size-6"
      >
        <Search size={22} />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          animation="fade"
          className="flex w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 shadow-lg sm:w-full max-h-[85vh]"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Rechercher un événement</DialogTitle>
            <DialogDescription>Recherchez parmi les événements déjà chargés.</DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} className="flex min-h-0 flex-1 w-full flex-col overflow-hidden bg-popover text-popover-foreground">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Rechercher un événement (titre, lieu)…"
            />
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <SlidersHorizontal size={12} />
                Filtres
                {hasActiveFilters && <span className="size-1.5 rounded-full bg-primary" />}
                <ChevronDown size={12} className={cn("transition-transform", filtersOpen && "rotate-180")} />
              </button>
              {rangeLoading && <Loader2 size={12} className="animate-spin" />}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTypeIds(new Set());
                    setSelectedSourceIds(new Set());
                    setDateFrom(null);
                    setDateTo(null);
                  }}
                  className="ml-auto flex items-center gap-1 hover:text-foreground"
                >
                  <X size={11} />
                  Effacer les filtres
                </button>
              )}
            </div>
            {filtersOpen && (
              <>
                {types.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
                    {types.map((t) => {
                      const active = selectedTypeIds.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleType(t.id)}
                          aria-pressed={active}
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors",
                            active
                              ? "border-transparent text-white"
                              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          )}
                          style={active ? { backgroundColor: t.color } : undefined}
                        >
                          {getIconEl(t.icon, 11, active ? "#fff" : undefined)}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {connections.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
                    {connections.map((c) => {
                      const active = selectedSourceIds.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleSource(c.id)}
                          aria-pressed={active}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-colors",
                            active
                              ? "border-transparent text-white"
                              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          )}
                          style={active ? { backgroundColor: c.color } : undefined}
                        >
                          {!active && (
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                          )}
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                  <span>Période</span>
                  <DateRangePicker
                    from={dateFrom}
                    to={dateTo}
                    onChange={(range) => { setDateFrom(range.from); setDateTo(range.to); }}
                    placeholder={["À partir du", "Jusqu'au"]}
                  />
                </div>
              </>
            )}
            <CommandList className="max-h-none flex-1 min-h-0">
              <CommandEmpty>Aucun événement trouvé.</CommandEmpty>
              <CommandGroup heading="Événements">
              {results.map((e) => {
                const start = parseISO(e.start);
                const end = parseISO(e.end);
                const type = resolved.get(e.id)?.type;
                return (
                  <CommandItem key={e.id} value={e.id} onSelect={() => selectEvent(e)} className="gap-2">
                    <div
                      className="flex items-center justify-center size-6 rounded-full shrink-0"
                      style={{ backgroundColor: type?.color ?? "#6366f1" }}
                    >
                      {getBadgeContent(type, e.title, 12)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{e.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{format(start, "EEE d MMM yyyy", { locale: fr })}</span>
                        {!e.allDay && (
                          <span>
                            {format(start, use24h ? "HH:mm" : "h:mm a")} – {format(end, use24h ? "HH:mm" : "h:mm a")}
                          </span>
                        )}
                        {e.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{e.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
              </CommandGroup>
            </CommandList>

            <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLoad("prev")}
                disabled={loadingDir !== null}
                className="text-xs text-muted-foreground"
              >
                {loadingDir === "prev" ? <Loader2 size={12} className="animate-spin" /> : <ArrowUp size={12} />}
                Événements précédents
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLoad("next")}
                disabled={loadingDir !== null}
                className="text-xs text-muted-foreground"
              >
                Événements suivants
                {loadingDir === "next" ? <Loader2 size={12} className="animate-spin" /> : <ArrowDown size={12} />}
              </Button>
            </div>
          </Command>
        </DialogContent>
      </Dialog>

      {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </>
  );
}
