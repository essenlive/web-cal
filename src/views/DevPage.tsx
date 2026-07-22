import { useEffect, useState, useMemo } from "react";
import { addDays, startOfWeek, setHours, setMinutes, format } from "date-fns";
import Link from "next/link";
import { ArrowLeft, FlaskConical, X } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "../lib/utils";
import { useEventsStore, useEventTypeStore, useUIStore } from "../store";
import { CalendarGrid } from "../components/calendar/CalendarGrid";
import { Header } from "../components/sidebar/Header";
import { EventChip } from "../components/events/EventChip";
import { generateSeedEvents } from "../lib/mock-seed";
import type { CalendarEvent, CalendarView } from "../types";

// ── Scenario event generators ─────────────────────────────────────────────────

function mkEv(
  id: string,
  title: string,
  typeId: string,
  start: Date,
  end: Date,
  allDay = false,
): CalendarEvent {
  return {
    id, title, calendarId: "dev", eventTypeId: typeId,
    start: start.toISOString(), end: end.toISOString(),
    allDay,
  };
}

function generateOverflowEvents(): CalendarEvent[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const tue = addDays(monday, 1);
  const events: CalendarEvent[] = [];
  let n = 0;
  const id = () => `ovf-${n++}`;

  // 5 timed meetings on Tuesday → block chips overflow (>3)
  for (let i = 0; i < 5; i++) {
    events.push(mkEv(id(), `Réunion ${i + 1}`, "meeting",
      setMinutes(setHours(tue, 9 + i), 0),
      setMinutes(setHours(tue, 10 + i), 0)));
  }

  // 5 allDay focus-time on Tuesday → avatar-tl overflow (>3)
  for (let i = 0; i < 5; i++) {
    events.push(mkEv(id(), `Focus ${i + 1}`, "focus-time", tue, addDays(tue, 1), true));
  }

  // 5 allDay admin on Tuesday → avatar-bl overflow (>3)
  for (let i = 0; i < 5; i++) {
    events.push(mkEv(id(), `Admin ${i + 1}`, "admin", tue, addDays(tue, 1), true));
  }

  // 5 allDay social on Tuesday → avatar-br overflow (>3)
  for (let i = 0; i < 5; i++) {
    events.push(mkEv(id(), `Social ${i + 1}`, "social", tue, addDays(tue, 1), true));
  }

  // 2 allDay meeting/deadline on Tuesday → day-style (muted bg + modal)
  events.push(mkEv(id(), "Sprint meeting", "meeting", tue, addDays(tue, 1), true));
  events.push(mkEv(id(), "All hands", "deadline", tue, addDays(tue, 1), true));

  // 5 spanning block events — 3 fit in lanes, 2 overflow.
  // ponytail: all render in the catch-all rule's style now (per-event custom
  // styling was removed, and no rule matches these dev-only events) — the lane
  // overflow layout is still exercised, just without per-bar color variety.
  const bars: { title: string; s: number; e: number }[] = [
    { title: "Toute la semaine",  s: 0, e: 7 }, // Mon→Sun  (lane 0)
    { title: "Début de semaine", s: 0, e: 4 }, // Mon→Thu  (lane 1)
    { title: "Milieu semaine",   s: 1, e: 5 }, // Tue→Fri  (lane 2)
    { title: "Mar → Jeu",        s: 1, e: 4 }, // Tue→Thu  (overflow)
    { title: "Mer → Ven",        s: 2, e: 5 }, // Wed→Fri  (overflow)
  ];
  for (const b of bars) {
    events.push(mkEv(id(), b.title, "meeting", addDays(monday, b.s), addDays(monday, b.e), true));
  }

  return events;
}

function generateAllDayEvents(): CalendarEvent[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const events: CalendarEvent[] = [];
  let n = 0;

  const bar = (title: string, s: number, e: number): CalendarEvent =>
    mkEv(`ad-${n++}`, title, "meeting", addDays(monday, s), addDays(monday, e), true);

  // Week 1 — various span lengths and stacking
  events.push(bar("Lun → Jeu",        0, 4));
  events.push(bar("Mar → Ven",         1, 5));
  events.push(bar("Mer seul",          2, 3));
  events.push(bar("Toute la semaine",  0, 7));
  events.push(bar("Débord A (sem 1)",  1, 6)); // overflow

  // Spanning week boundary (Sun → Tue next week)
  events.push(bar("Sem 1 → Sem 2",     6, 9));

  // Week 2
  const w2 = 7;
  events.push(bar("Sprint",           w2 + 0, w2 + 5));
  events.push(bar("Conf 3j",          w2 + 1, w2 + 4));
  events.push(bar("Mer → Sam",        w2 + 2, w2 + 6));
  events.push(bar("Débord B (sem 2)", w2 + 0, w2 + 7)); // overflow

  return events;
}

// ── Scenario definitions ──────────────────────────────────────────────────────

type ScenarioKey = "standard" | "overflow" | "allday";

interface Scenario {
  label: string;
  description: string;
  view: CalendarView;
  events: () => CalendarEvent[];
}

const SCENARIOS: Record<ScenarioKey, Scenario> = {
  standard: {
    label: "Standard",
    description: "Données de test sur 4 semaines — couvre toutes les vues.",
    view: "month",
    events: generateSeedEvents,
  },
  overflow: {
    label: "Débordement",
    description: "Mardi saturé : 5 réunions, 5 badges/coin, 5 barres tout-jour, 2 fonds. Déclenche tous les débordements.",
    view: "month",
    events: generateOverflowEvents,
  },
  allday: {
    label: "Tout-jour",
    description: "Barres multi-jours sur deux semaines — empilées, continuations et débordements de lanes.",
    view: "month",
    events: generateAllDayEvents,
  },
};

// ── Showcase helpers ──────────────────────────────────────────────────────────

function ShowcaseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-3 border-b border-border last:border-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
        {title}
      </p>
      {children}
    </div>
  );
}

function BarSample({
  label, isStart, isEnd, color,
}: {
  label: string; isStart: boolean; isEnd: boolean; color: string;
}) {
  const rL = isStart ? "5px" : "0";
  const rR = isEnd ? "5px" : "0";
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-[14px] flex items-center overflow-hidden"
        style={{ backgroundColor: color, borderRadius: `${rL} ${rR} ${rR} ${rL}` }}
      >
        {isStart && (
          <span className="text-[9px] font-medium text-white px-1.5 truncate leading-none">{label}</span>
        )}
      </div>
      <span className="text-[9px] text-muted-foreground w-20 shrink-0">{label}</span>
    </div>
  );
}

// ── ShowcasePanel ─────────────────────────────────────────────────────────────

function ShowcasePanel() {
  const { types, getType } = useEventTypeStore();

  const sampleTimed = useMemo<CalendarEvent[]>(() =>
    types.map((t, i) => ({
      id: `sc-t-${i}`, title: t.label, calendarId: "sc",
      eventTypeId: t.id, start: new Date().toISOString(),
      end: new Date().toISOString(), allDay: false,
    })), [types]);

  const avatarTypes = types.filter((t) => t.allDayStyle.startsWith("avatar"));
  const dayTypes    = types.filter((t) => t.allDayStyle === "day");

  const overflowEvents = sampleTimed.slice(0, 5);

  const modalEvents = useMemo<CalendarEvent[]>(() =>
    types.slice(0, 4).map((t, i) => ({
      id: `sc-m-${i}`, title: t.label, calendarId: "sc",
      eventTypeId: t.id, start: new Date().toISOString(),
      end: new Date().toISOString(), allDay: true,
    })), [types]);

  return (
    <aside className="w-72 shrink-0 border-l border-border overflow-y-auto bg-card flex flex-col">
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-border bg-muted/40 sticky top-0 z-10 shrink-0">
        <p className="text-[11px] font-semibold text-foreground">Galerie de composants</p>
        <p className="text-[10px] text-muted-foreground">Rendu direct — sans interaction</p>
      </div>

      {/* 1 ── EventChip block (timed events) */}
      <ShowcaseSection title="EventChip · bloc horodaté">
        <div className="flex flex-col gap-1">
          {sampleTimed.map((e) => (
            <EventChip key={e.id} event={e} eventType={getType(e.eventTypeId)} view="month" compact />
          ))}
        </div>
      </ShowcaseSection>

      {/* 2 ── AllDay avatar badges */}
      <ShowcaseSection title="Badge avatar · tout-jour">
        <div className="flex gap-2 flex-wrap">
          {avatarTypes.map((t) => {
            const Icon = (Icons as any)[t.icon];
            return (
              <div key={t.id} title={t.label}
                style={{ backgroundColor: t.color }}
                className="size-6 rounded-full flex items-center justify-center shadow-sm shrink-0"
              >
                {Icon && <Icon size={9} color="#fff" />}
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          ↖ {avatarTypes.find(t => t.allDayStyle === "avatar-tl")?.label ?? "—"} ·
          ↙ {avatarTypes.find(t => t.allDayStyle === "avatar-bl")?.label ?? "—"} ·
          ↘ {avatarTypes.find(t => t.allDayStyle === "avatar-br")?.label ?? "—"}
        </p>
      </ShowcaseSection>

      {/* 3 ── Day-style background swatches */}
      <ShowcaseSection title="Fond de jour · day-style">
        <div className="flex gap-1.5 flex-wrap">
          {dayTypes.map((t) => (
            <div key={t.id} title={t.label}
              style={{ backgroundColor: t.color + "18", borderLeft: `3px solid ${t.color}` }}
              className="h-8 w-14 rounded flex items-end px-1 pb-0.5"
            >
              <span className="text-[9px] font-medium" style={{ color: t.color }}>
                {t.label.slice(0, 6)}
              </span>
            </div>
          ))}
        </div>
      </ShowcaseSection>

      {/* 4 ── Overflow popover content */}
      <ShowcaseSection title="Popover · déb. horodatés (+N)">
        <div className="bg-background border border-border rounded-xl shadow-md p-2 flex flex-col gap-1">
          <p className="text-[9px] text-muted-foreground mb-0.5">↓ contenu du popover</p>
          {overflowEvents.map((e) => (
            <EventChip key={e.id} event={e} eventType={getType(e.eventTypeId)} view="month" compact />
          ))}
        </div>
      </ShowcaseSection>

      {/* 5 ── All-day bar border-radius shapes */}
      <ShowcaseSection title="Barres tout-jour · bord-radius">
        <div className="flex flex-col gap-2">
          <BarSample label="Début + fin"  isStart={true}  isEnd={true}  color="#3b82f6" />
          <BarSample label="Début seul →" isStart={true}  isEnd={false} color="#8b5cf6" />
          <BarSample label="← Fin seule"  isStart={false} isEnd={true}  color="#10b981" />
          <BarSample label="Milieu"        isStart={false} isEnd={false} color="#f59e0b" />
        </div>
      </ShowcaseSection>

      {/* 6 ── Avatar badge overflow (+N muted button) */}
      <ShowcaseSection title="Badge avatar · déb. (+N)">
        <div className="flex flex-col gap-1.5">
          {avatarTypes.map((t, idx) => {
            const Icon = (Icons as any)[t.icon];
            const corner = ["↖ tl", "↙ bl", "↘ br"][idx] ?? "";
            return (
              <div key={t.id} className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground w-8 shrink-0">{corner}</span>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ backgroundColor: t.color }}
                    className="size-5 rounded-full flex items-center justify-center shadow-sm shrink-0"
                  >
                    {Icon && <Icon size={8} color="#fff" />}
                  </div>
                ))}
                <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-semibold text-muted-foreground shrink-0">
                  +2
                </div>
              </div>
            );
          })}
        </div>
      </ShowcaseSection>

      {/* 7 ── EventListModal inline card */}
      <ShowcaseSection title="Modal de sélection (inline)">
        <div className="bg-card rounded-2xl border border-border shadow-lg p-3 relative">
          <p className="text-[12px] font-semibold text-foreground mb-2.5 pr-6">
            {format(new Date(), "d MMMM yyyy")}
          </p>
          <div className="flex flex-col gap-1.5">
            {modalEvents.map((e) => (
              <EventChip key={e.id} event={e} eventType={getType(e.eventTypeId)} view="month" />
            ))}
          </div>
          <div className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-muted/60 text-muted-foreground">
            <X size={12} />
          </div>
        </div>
      </ShowcaseSection>

      {/* 8 ── Day-style multi-event cells */}
      <ShowcaseSection title="Fond de jour · 1 vs 2+ événements">
        <div className="flex gap-2">
          {/* Single day-style event → colored bg, underlined day number */}
          <div className="flex-1">
            <div
              className="h-16 rounded border border-border flex flex-col px-1"
              style={{ backgroundColor: (dayTypes[0]?.color ?? "#3b82f6") + "18" }}
            >
              <div className="flex justify-end pt-1">
                <span className="text-[11px] font-medium underline underline-offset-2 decoration-dotted cursor-pointer hover:text-primary">
                  14
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5">1 fond → clic modifie</span>
            </div>
          </div>
          {/* Multiple day-style events → muted bg, dotted underline day number */}
          <div className="flex-1">
            <div className="h-16 rounded border border-border flex flex-col px-1 bg-muted/30">
              <div className="flex justify-end pt-1">
                <span className="text-[11px] font-medium underline underline-offset-2 decoration-dotted cursor-pointer text-primary">
                  14
                </span>
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5">2+ fonds → clic liste</span>
            </div>
          </div>
        </div>
      </ShowcaseSection>
    </aside>
  );
}

// ── DevPage ───────────────────────────────────────────────────────────────────

export function DevPage() {
  const [scenario, setScenario] = useState<ScenarioKey>("overflow");
  const { setEvents } = useEventsStore();
  const { setView } = useUIStore();

  useEffect(() => {
    const s = SCENARIOS[scenario];
    setEvents(s.events());
    setView(s.view);
  }, [scenario]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* Dev toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-yellow-500/10 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <FlaskConical size={14} className="text-yellow-600 dark:text-yellow-400" />
          <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300 whitespace-nowrap">
            Dev Preview
          </span>
        </div>

        <div className="flex gap-1">
          {(Object.entries(SCENARIOS) as [ScenarioKey, Scenario][]).map(([key, s]) => (
            <button
              key={key}
              onClick={() => setScenario(key)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-lg font-medium transition-colors whitespace-nowrap",
                scenario === key
                  ? "bg-yellow-500 text-white"
                  : "bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate hidden sm:block">
          {SCENARIOS[scenario].description}
        </p>

        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap ml-auto"
        >
          <ArrowLeft size={13} />
          Retour
        </Link>
      </div>

      {/* Content row */}
      <div className="flex flex-1 overflow-hidden">

        {/* Calendar */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header />
          <CalendarGrid />
        </div>

        {/* Showcase panel */}
        <ShowcasePanel />
      </div>
    </div>
  );
}
