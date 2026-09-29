/**
 * The calendar page's URL ⇄ app state mapping, and when a change deserves its own browser
 * history entry — so Back/Forward step through app states (view, period, preset, open drawer)
 * instead of leaving the page. Pure: CalendarPage owns the actual history/popstate wiring.
 */
import { format, parse } from "date-fns";
import type { CalendarView } from "../types";
import type { ActiveDrawer, DrawerPanel } from "../store";

export const DATE_FORMAT = "yyyy-MM-dd";
const VIEWS: CalendarView[] = ["month", "week", "day", "agenda"];
const PANELS: DrawerPanel[] = ["connection", "eventType", "rules", "preset", "theme", "preferences", "shortcuts", "help"];

export interface UrlState {
  view: CalendarView;
  /** yyyy-MM-dd */
  date: string;
  presetId?: string;
  drawer?: ActiveDrawer;
}

export function toSearch(s: UrlState): string {
  const p = new URLSearchParams();
  p.set("view", s.view);
  p.set("date", s.date);
  if (s.presetId) p.set("preset", s.presetId);
  if (s.drawer) {
    p.set("panel", s.drawer.panel);
    if (s.drawer.editId) p.set("edit", s.drawer.editId);
    if (s.drawer.create) p.set("new", "1");
  }
  return `?${p}`;
}

/** Only the parts of `search` that are valid — anything else is left to the current state. */
export function fromSearch(search: string): Partial<UrlState> & { dateValue?: Date } {
  const p = new URLSearchParams(search);
  const out: Partial<UrlState> & { dateValue?: Date } = {};
  const view = p.get("view") as CalendarView | null;
  if (view && VIEWS.includes(view)) out.view = view;
  const date = p.get("date");
  if (date) {
    const parsed = parse(date, DATE_FORMAT, new Date());
    if (!isNaN(parsed.getTime())) { out.date = date; out.dateValue = parsed; }
  }
  const preset = p.get("preset");
  if (preset) out.presetId = preset;
  const panel = p.get("panel") as DrawerPanel | null;
  if (panel && PANELS.includes(panel)) {
    out.drawer = { panel, ...(p.get("edit") ? { editId: p.get("edit")! } : {}), ...(p.get("new") ? { create: true } : {}) };
  }
  return out;
}

export const formatUrlDate = (d: Date) => format(d, DATE_FORMAT);

export type HistoryAction = "push" | "replace" | "back" | "none";

/**
 * How to record `prev → next` in browser history:
 *  - opening a drawer, moving to another view/period, or a preset becoming active → push
 *    (a preset becoming *inactive* — the user tweaking visibility — only replaces);
 *  - closing a drawer whose entry we pushed → back (so Back doesn't reopen it; the popstate
 *    that follows restores the entry below, which already matches);
 *  - anything else (switching panels inside an open drawer, a closed drawer we didn't push) → replace.
 */
export function historyAction(prev: UrlState, next: UrlState, drawerEntryIsOurs: boolean): HistoryAction {
  if (toSearch(prev) === toSearch(next)) return "none";
  if (!prev.drawer && next.drawer) return "push";
  if (prev.drawer && !next.drawer) return drawerEntryIsOurs ? "back" : "replace";
  if (prev.view !== next.view || prev.date !== next.date) return "push";
  if (next.presetId && next.presetId !== prev.presetId) return "push";
  return "replace";
}
