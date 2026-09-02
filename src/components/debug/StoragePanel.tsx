import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { SortHeader, type SortDir } from "./table";
import { CopySnapshotButton } from "./CopySnapshotButton";

const KNOWN_PREFIXES = ["webcal:", "proton-cal:"];

interface Row {
  key: string;
  bytes: number;
  value: string;
}

type SortKey = "key" | "bytes";

function readLocalStorageSnapshot(): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !KNOWN_PREFIXES.some((p) => key.startsWith(p))) continue;
    const value = localStorage.getItem(key) ?? "";
    rows.push({ key, bytes: new Blob([value]).size, value });
  }
  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toFixed(1)} Ko`;
}

/** Pretty-prints the value as JSON when it parses as such, otherwise shows it raw. */
function formatValue(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function StoragePanel() {
  // localStorage isn't reactive — this panel is a point-in-time snapshot, re-read
  // on demand via the button below rather than wired into every store's persist call.
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [prefixFilter, setPrefixFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("key");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` is a deliberate re-run trigger, not a real input to the read
  const rows = useMemo(() => (typeof window === "undefined" ? [] : readLocalStorageSnapshot()), [tick]);
  const total = rows.reduce((sum, r) => sum + r.bytes, 0);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.key.toLowerCase().includes(q))
      .filter((r) => prefixFilter === "all" || r.key.startsWith(prefixFilter))
      .sort((a, b) => (sortDir === "asc" ? 1 : -1) * (sortKey === "key" ? a.key.localeCompare(b.key) : a.bytes - b.bytes));
  }, [rows, search, prefixFilter, sortKey, sortDir]);

  const selected = filtered.find((r) => r.key === selectedKey) ?? filtered[0] ?? null;

  const snapshotData = useMemo(() => ({
    keys: rows.map((r) => {
      let value: unknown = r.value;
      try { value = JSON.parse(r.value); } catch { /* keep raw string */ }
      return { key: r.key, bytes: r.bytes, value };
    }),
  }), [rows]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par clé…"
          className="w-56 max-w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        />
        <select value={prefixFilter} onChange={(e) => setPrefixFilter(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
          <option value="all">Tous les préfixes</option>
          {KNOWN_PREFIXES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setTick((t) => t + 1)} aria-label="Actualiser">
          <RefreshCw size={12} />
        </Button>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {filtered.length} / {rows.length} clés · {(total / 1024).toFixed(1)} Ko au total
        </span>
        <CopySnapshotButton
          context="web-cal debug snapshot — onglet Stockage. Contenu brut de localStorage pour les clés persistées par l'application (préfixes webcal: et proton-cal:) : connexions, règles, types d'événements, thème, préférences UI, et le cache local des événements. 'value' est l'objet JSON parsé quand c'est possible, sinon la chaîne brute."
          data={snapshotData}
        />
      </div>

      <div className="flex gap-3 items-start">
        <div className="flex-1 min-w-0 overflow-x-auto rounded-lg border border-border max-h-128 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground sticky top-0">
              <tr>
                <SortHeader label="Clé" sortKey="key" active={sortKey === "key"} dir={sortDir} onSort={onSort} />
                <SortHeader label="Taille" sortKey="bytes" active={sortKey === "bytes"} dir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr
                  key={r.key}
                  onClick={() => setSelectedKey(r.key)}
                  className={cn("cursor-pointer hover:bg-muted", selected?.key === r.key && "bg-muted")}
                >
                  <td className="px-3 py-1.5 font-mono text-foreground">{r.key}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{formatSize(r.bytes)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">Aucune clé.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="w-80 shrink-0 rounded-lg border border-border p-3 max-h-128 overflow-y-auto">
          {selected ? (
            <>
              <p className="font-mono text-xs font-semibold text-foreground break-all">{selected.key}</p>
              <p className="text-[10px] text-muted-foreground mb-2">{formatSize(selected.bytes)}</p>
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all">{formatValue(selected.value)}</pre>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sélectionnez une clé pour voir son contenu.</p>
          )}
        </div>
      </div>
    </div>
  );
}
