import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "../../lib/utils";

export type SortDir = "asc" | "desc";

/** Clickable column header shared by every debug table — shows the active sort
 *  direction, or a faint bidirectional arrow when this isn't the active column. */
export function SortHeader<K extends string>({ label, sortKey, active, dir, onSort }: {
  label: string; sortKey: K; active: boolean; dir: SortDir; onSort: (key: K) => void;
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

/** Small color swatch — an event type's or connection's own color, shown next to its label. */
export function ColorDot({ color, className }: { color?: string; className?: string }) {
  if (!color) return null;
  return <span className={cn("inline-block size-2 rounded-full shrink-0", className)} style={{ backgroundColor: color }} />;
}
