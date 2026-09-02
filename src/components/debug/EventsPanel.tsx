import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { useConnectionStore, useEventTypeStore, useEventsStore, useRuleStore } from "../../store";
import { describeMatch, findMatchingRule } from "../../lib/rules";
import { useResolvedEvents } from "../../hooks/useResolvedEvents";
import type { CalendarEvent } from "../../types";

interface Row {
  event: CalendarEvent;
  sourceName: string;
  ruleLabel: string;
  typeLabel: string;
  hidden: boolean;
  visibilityLabel: string;
}

type SortKey = "title" | "source" | "start" | "end" | "allDay" | "rule" | "type" | "visibility";
type SortDir = "asc" | "desc";

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

function SortHeader({ label, sortKey, active, dir, onSort }: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir; onSort: (key: SortKey) => void;
}) {
  return (
    <th className="px-3 py-2 text-left font-medium">
      <button onClick={() => onSort(sortKey)} className={cn("flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {label}
        {active ? (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}
      </button>
    </th>
  );
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
        ruleLabel: describeMatch(rule, getEventTitle, getConnectionName),
        typeLabel: r?.type.label ?? "—",
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
              <tr key={r.event.id}>
                <td className="px-3 py-1.5 font-medium text-foreground">{r.event.title}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.sourceName}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{format(new Date(r.event.start), "d MMM HH:mm", { locale: fr })}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{format(new Date(r.event.end), "d MMM HH:mm", { locale: fr })}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.event.allDay ? "Oui" : "Non"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.ruleLabel}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.typeLabel}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.visibilityLabel}</td>
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
