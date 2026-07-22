import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import type { CalendarView } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Steps `date` by one unit of `view` (agenda steps by month, like the header's prev/next buttons). */
export function stepDate(view: CalendarView, date: Date, dir: 1 | -1): Date {
  const fns: Record<CalendarView, (d: Date, n: number) => Date> = {
    month:  (d, n) => (n > 0 ? addMonths(d, 1) : subMonths(d, 1)),
    week:   (d, n) => (n > 0 ? addWeeks(d, 1) : subWeeks(d, 1)),
    day:    (d, n) => (n > 0 ? addDays(d, 1) : subDays(d, 1)),
    agenda: (d, n) => (n > 0 ? addMonths(d, 1) : subMonths(d, 1)),
  };
  return fns[view](date, dir);
}
