"use client"

import { useState } from "react"
import { format } from "date-fns"
import { fr } from "react-day-picker/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { cn } from "@/lib/utils"

/**
 * The one calendar-based date range picker the app uses — the stats page's period picker
 * and the event search modal's date filter both render this instead of keeping their own
 * `<input type="date">` pair, so "pick a date range" looks and behaves the same everywhere.
 * `from`/`to` are independently nullable and every change (including a lone first click,
 * before the range is complete) is reported via `onChange` — event search acts on a partial
 * range immediately (it already supports an open-ended filter on just one side); a caller
 * that needs a complete range should simply ignore a call where either side is still null.
 * A local `pending` selection tracks the in-progress click, reset from props whenever the
 * popover (re)opens, so the calendar always reflects what's actually committed once closed.
 */
export function DateRangePicker({ from, to, onChange, placeholder = ["Depuis", "Jusqu'au"], className }: {
  from: Date | null;
  to: Date | null;
  onChange: (range: { from: Date | null; to: Date | null }) => void;
  placeholder?: [string, string];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const committed: DateRange | undefined = from || to ? { from: from ?? undefined, to: to ?? undefined } : undefined;
  const [pending, setPending] = useState<DateRange | undefined>(committed);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Re-sync the in-progress selection from the committed props right as the popover
        // opens — an event handler, not an effect, so there's no cascading-render risk; see
        // Sidebar.tsx/EventSearch.tsx for the same "React events over effects for this" call.
        if (next) setPending(committed);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("justify-start gap-1.5 text-xs font-normal text-foreground", className)}
        >
          <CalendarIcon size={14} className="text-muted-foreground shrink-0" />
          <span className={cn(!from && "text-muted-foreground")}>
            {from ? format(from, "d MMM yyyy", { locale: fr }) : placeholder[0]}
          </span>
          <span className="text-muted-foreground">–</span>
          <span className={cn(!to && "text-muted-foreground")}>
            {to ? format(to, "d MMM yyyy", { locale: fr }) : placeholder[1]}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="range"
          numberOfMonths={2}
          locale={fr}
          defaultMonth={from ?? to ?? undefined}
          selected={pending}
          onSelect={(range) => {
            setPending(range);
            onChange({ from: range?.from ?? null, to: range?.to ?? null });
            if (range?.from && range?.to) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
