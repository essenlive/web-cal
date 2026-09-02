import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "../../lib/utils";
import { useConnectionStore, useEventTypeStore, useEventsStore, useRuleStore } from "../../store";
import { describeMatch, findMatchingRule } from "../../lib/rules";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import { SortHeader, ColorDot } from "./table";
import type { SortDir } from "./table";
import { CopySnapshotButton } from "./CopySnapshotButton";
import type { CalendarEvent } from "../../types";

interface Row {
  event: CalendarEvent;
  sourceName: string;
  sourceColor?: string;
  ruleLabel: string;
  typeLabel: string;
  typeColor?: string;
  hidden: boolean;
  visibilityLabel: string;
}

type SortKey = "title" | "source" | "start" | "end" | "allDay" | "rule" | "type" | "visibility";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Titre" },
  { key: "source", label: "Source" },
  { key: "start", label: "Début" },
  { key: "end", label: "Fin" },
  { key: "allDay", label: "Journée entière" },
  { key: "rule", label: "Règle appliquée" },
  { key: "type", label: "Type résolu" },
  { key: "visibility", label: "Visibilité" },
];

function compareRows(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "title": return a.event.title.localeCompare(b.event.title);
    case "source": return a.sourceName.localeCompare(b.sourceName);
    case "start": return new Date(a.event.start).getTime() - new Date(b.event.start).getTime();
    case "end": return new Date(a.event.end).getTime() - new Date(b.event.end).getTime();
    case "allDay": return Number(a.event.allDay) - Number(b.event.allDay);
    case "rule": return a.ruleLabel.localeCompare(b.ruleLabel);
    case "type": return a.typeLabel.localeCompare(b.typeLabel);
    case "visibility": return a.visibilityLabel.localeCompare(b.visibilityLabel);
  }
}

export function EventsPanel() {
  const { events } = useEventsStore();
  const { connections } = useConnectionStore();
  const { types } = useEventTypeStore();
  const { rules } = useRuleStore();
  const { resolved } = useResolvedEvents();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("all");
  const [sortKey, setSortKey] = useState<SortKey>("start");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const getEventTitle = (id: string) => events.find((e) => e.id === id)?.title;
  const getConnectionName = (id: string) => connections.find((c) => c.id === id)?.name;

  const rows = useMemo<Row[]>(() => {
    return events.map((event) => {
      const rule = findMatchingRule(event, rules);
      const r = resolved.get(event.id);
      const connection = connections.find((c) => c.id === event.calendarId);
      const hidden = !!r?.hidden;
      const visibilityLabel = !hidden ? "Visible" : connection?.hidden ? "Masqué (source masquée)" : "Masqué (type masqué)";
      return {
        event,
        sourceName: connection?.name ?? event.calendarId,
        sourceColor: connection?.color,
        ruleLabel: describeMatch(rule, getEventTitle, getConnectionName),
        typeLabel: r?.type.label ?? "—",
        typeColor: r?.type.color,
        hidden,
        visibilityLabel,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, rules, resolved, connections]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.event.title.toLowerCase().includes(q) || r.event.id.toLowerCase().includes(q))
      .filter((r) => sourceFilter === "all" || r.event.calendarId === sourceFilter)
      .filter((r) => typeFilter === "all" || r.typeLabel === typeFilter)
      .filter((r) => visibilityFilter === "all" || (visibilityFilter === "hidden") === r.hidden)
      .sort((a, b) => (sortDir === "asc" ? 1 : -1) * compareRows(a, b, sortKey));
  }, [rows, search, sourceFilter, typeFilter, visibilityFilter, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const snapshotData = useMemo(() => ({
    events: rows.map((r) => ({
      id: r.event.id,
      title: r.event.title,
      source: r.sourceName,
      start: r.event.start,
      end: r.event.end,
      allDay: r.event.allDay,
      matchedRule: r.ruleLabel,
      resolvedType: r.typeLabel,
      hidden: r.hidden,
      visibility: r.visibilityLabel,
    })),
  }), [rows]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par titre ou id…"
          className="w-56 max-w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value="all">Toutes les sources</option>
          {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value="all">Tous les types</option>
          {types.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
        </select>
        <select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value as typeof visibilityFilter)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value="all">Visibilité : toutes</option>
          <option value="visible">Visible</option>
          <option value="hidden">Masqué</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">{filtered.length} / {events.length} événements</span>
        <CopySnapshotButton
          context="web-cal debug snapshot — onglet Événements. Chaque entrée est un événement de calendrier actuellement chargé, avec le résultat de sa résolution par le moteur de règles : 'matchedRule' est la règle qui s'applique (la première correspondance, par ordre de priorité), 'resolvedType' est le type d'affichage qui en résulte, et 'visibility'/'hidden' indiquent s'il est affiché ou masqué — masqué soit parce que sa source est masquée, soit parce que son type résolu est masqué."
          data={snapshotData}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border max-h-128 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground sticky top-0">
            <tr>
              {COLUMNS.map((col) => (
                <SortHeader key={col.key} label={col.label} sortKey={col.key} active={sortKey === col.key} dir={sortDir} onSort={onSort} />
              ))}
              <th className="px-3 py-2 text-left font-medium">Id</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.event.id} className={r.hidden ? "opacity-60" : undefined}>
                <td className="px-3 py-1.5 font-medium text-foreground">{r.event.title}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  <span className="flex items-center gap-1.5"><ColorDot color={r.sourceColor} />{r.sourceName}</span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">{format(new Date(r.event.start), "d MMM HH:mm", { locale: fr })}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{format(new Date(r.event.end), "d MMM HH:mm", { locale: fr })}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.event.allDay ? "Oui" : "Non"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.ruleLabel}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  <span className="flex items-center gap-1.5"><ColorDot color={r.typeColor} />{r.typeLabel}</span>
                </td>
                <td className={cn("px-3 py-1.5 font-medium", r.hidden ? "text-amber-600 dark:text-amber-500" : "text-green-600 dark:text-green-500")}>
                  {r.visibilityLabel}
                </td>
                <td className="px-3 py-1.5 text-muted-foreground font-mono truncate max-w-40" title={r.event.id}>{r.event.id}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={COLUMNS.length + 1} className="px-3 py-4 text-center text-muted-foreground">Aucun événement.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
