import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";

const KNOWN_PREFIXES = ["webcal:", "proton-cal:"];

function readLocalStorageSnapshot() {
  const rows: { key: string; bytes: number; preview: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !KNOWN_PREFIXES.some((p) => key.startsWith(p))) continue;
    const value = localStorage.getItem(key) ?? "";
    rows.push({ key, bytes: new Blob([value]).size, preview: value.length > 120 ? `${value.slice(0, 120)}…` : value });
  }
  return rows.sort((a, b) => a.key.localeCompare(b.key));
}

export function StoragePanel() {
  // localStorage isn't reactive — this panel is a point-in-time snapshot, re-read
  // on demand via the button below rather than wired into every store's persist call.
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` is a deliberate re-run trigger, not a real input to the read
  const rows = useMemo(() => (typeof window === "undefined" ? [] : readLocalStorageSnapshot()), [tick]);
  const total = rows.reduce((sum, r) => sum + r.bytes, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{rows.length} clés, {(total / 1024).toFixed(1)} Ko au total</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setTick((t) => t + 1)} aria-label="Actualiser">
          <RefreshCw size={12} />
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:py-2">
              <th>Clé</th>
              <th>Taille</th>
              <th>Aperçu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-3 py-1.5 font-mono text-foreground">{r.key}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.bytes < 1024 ? `${r.bytes} o` : `${(r.bytes / 1024).toFixed(1)} Ko`}</td>
                <td className="px-3 py-1.5 text-muted-foreground font-mono truncate max-w-md" title={r.preview}>{r.preview}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">Aucune clé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
