import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { listTimezones, systemTimezoneLabel, SYSTEM_TIMEZONE } from "../../lib/timezone";
import { useUIStore } from "../../store";
import { cn } from "../../lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Input } from "../ui/input";

/** `compact`: one-line sidebar row (Réglages section) instead of the drawer's described card. */
export function TimezoneSelect({ compact = false }: { compact?: boolean }) {
  const { timezone, setTimezone } = useUIStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(() => [
    { value: SYSTEM_TIMEZONE, label: `Système (${systemTimezoneLabel()})` },
    ...listTimezones().map((tz) => ({ value: tz, label: tz })),
  ], []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selected = options.find((o) => o.value === timezone);

  return (
    <div className={cn("flex items-center justify-between", compact ? "gap-2 px-2 py-1 text-xs text-foreground" : "gap-3 rounded-lg bg-muted/50 px-3 py-2.5")}>
      {compact ? (
        <span className="shrink-0">Fuseau</span>
      ) : (
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">Fuseau horaire</div>
          <div className="text-xs text-muted-foreground">Fuseau utilisé pour afficher les événements</div>
        </div>
      )}
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border border-input bg-transparent shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
              compact ? "h-6 min-w-0 flex-1 px-2 text-[11px]" : "h-9 max-w-[55%] shrink-0 px-3 py-1.5 text-xs",
            )}
          >
            <span className="truncate">{selected?.label ?? timezone}</span>
            <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1" align="end">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un fuseau…"
            className="mb-1 h-8 rounded-md px-2 text-xs"
            autoFocus
          />
          <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { setTimezone(o.value); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted transition-colors",
                  o.value === timezone && "bg-muted"
                )}
              >
                <Check size={12} className={cn("shrink-0", o.value === timezone ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{o.label}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Aucun résultat.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
