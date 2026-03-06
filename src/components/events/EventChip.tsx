import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import type { CalendarEvent, EventType } from "../../types";

interface EventChipProps {
  event: CalendarEvent;
  eventType?: EventType;
  onClick?: (e?: React.MouseEvent) => void;
  compact?: boolean;
}

function getIcon(name: string, size = 12) {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon size={size} /> : null;
}

export function EventChip({ event, eventType, onClick, compact = false }: EventChipProps) {
  const color = eventType?.color ?? "#6366f1";
  const style = eventType?.style ?? "pill";
  const icon = eventType?.icon;

  const base = "cursor-pointer select-none overflow-hidden transition-all duration-150 hover:brightness-95 active:scale-95";

  if (style === "pill") {
    return (
      <div
        onClick={onClick}
        className={cn(base, "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium")}
        style={{ backgroundColor: color + "22", color }}
      >
        {icon && !compact && getIcon(icon, 10)}
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  if (style === "outline") {
    return (
      <div
        onClick={onClick}
        className={cn(base, "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium")}
        style={{ borderColor: color, color }}
      >
        {icon && !compact && getIcon(icon, 11)}
        <span className="truncate">{event.title}</span>
      </div>
    );
  }

  if (style === "card") {
    return (
      <div
        onClick={onClick}
        className={cn(base, "rounded-lg px-2 py-1 text-xs font-medium shadow-sm")}
        style={{ backgroundColor: color + "18", borderLeft: `3px solid ${color}`, color }}
      >
        <div className="flex items-center gap-1.5">
          {icon && !compact && getIcon(icon, 11)}
          <span className="truncate font-semibold">{event.title}</span>
        </div>
      </div>
    );
  }

  // block
  return (
    <div
      onClick={onClick}
      className={cn(base, "rounded-md px-2 py-1 text-xs font-medium")}
      style={{ backgroundColor: color, color: "#fff" }}
    >
      <div className="flex items-center gap-1.5">
        {icon && !compact && getIcon(icon, 11)}
        <span className="truncate">{event.title}</span>
      </div>
    </div>
  );
}
