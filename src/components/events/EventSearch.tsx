"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowDown, ArrowUp, Loader2, MapPin, Search } from "lucide-react";
import { useUIStore } from "../../store";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import { useSourceSync, windowAround } from "../../context/DataProviderContext";
import { getBadgeContent } from "./EventChip";
import { EventDetail } from "./EventDetail";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import type { CalendarEvent } from "../../types";

const LOAD_STEP_MONTHS = 3;
const MAX_RESULTS = 50;
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** Sorts by closeness to "now" (soonest-upcoming/most-recent first) rather than plain
 *  chronological order — a plain helper (not inlined in a memo) so the Date.now() read
 *  doesn't run during render, same pattern as Sidebar.tsx's connectionStatusDetail(). */
function sortByRelevance(events: CalendarEvent[]): CalendarEvent[] {
  const now = Date.now();
  return [...events].sort(
    (a, b) => Math.abs(parseISO(a.start).getTime() - now) - Math.abs(parseISO(b.start).getTime() - now)
  );
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

  const { setCurrentDate, use24h } = useUIStore();
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
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    return q
      ? visibleEvents.filter(
          (e) => e.title.toLocaleLowerCase("fr").includes(q) || e.location?.toLocaleLowerCase("fr").includes(q)
        )
      : visibleEvents;
  }, [visibleEvents, query]);
  const results = sortByRelevance(filtered).slice(0, MAX_RESULTS);

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
        className="hidden sm:flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
      >
        <Search size={14} />
        <span>Rechercher…</span>
        <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          {IS_MAC ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Rechercher un événement"
        className="sm:hidden text-muted-foreground"
      >
        <Search size={18} />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent animation="fade" className="max-w-xl gap-0 overflow-hidden p-0 shadow-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Rechercher un événement</DialogTitle>
            <DialogDescription>Recherchez parmi les événements déjà chargés.</DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false} className="flex h-full w-full flex-col overflow-hidden bg-popover text-popover-foreground">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Rechercher un événement (titre, lieu)…"
            />
            <CommandList>
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
