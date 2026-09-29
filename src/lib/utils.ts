import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import type { CalendarView } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Border + colors of one option in a pick-one group (mode, radius, pattern, display style, icon…). */
export function choiceClass(selected: boolean): string {
  return cn("border transition-all", selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted text-muted-foreground");
}

/** Small uppercase heading for a group of controls (sidebar sections, drawer/dialog sub-sections). */
export const SECTION_LABEL = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

/** Native <select> styling, shared by every compact dropdown (filters, cache period, theme pickers). */
export const NATIVE_SELECT = "rounded-md border border-border bg-background px-2 py-1.5 text-xs";

/** Saves `content` as a file named `filename` via a temporary object URL. */
export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** First user-perceived character of `text` — a grapheme cluster, so multi-codepoint
 *  emoji (flags, ZWJ sequences, skin-tone modifiers) survive intact instead of the
 *  `.charAt(0)` half-surrogate you'd get by slicing UTF-16 code units. */
export function firstGrapheme(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return segmenter.segment(trimmed)[Symbol.iterator]().next().value?.segment ?? "";
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
