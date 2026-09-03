import { useMemo } from "react";
import { listTimezones, systemTimezoneLabel, SYSTEM_TIMEZONE } from "../../lib/timezone";
import { useUIStore } from "../../store";

export function TimezoneSelect() {
  const { timezone, setTimezone } = useUIStore();
  const timezones = useMemo(() => listTimezones(), []);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">Fuseau horaire</div>
        <div className="text-xs text-muted-foreground">Fuseau utilisé pour afficher les événements</div>
      </div>
      <select
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        className="shrink-0 max-w-[55%] rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
      >
        <option value={SYSTEM_TIMEZONE}>Système ({systemTimezoneLabel()})</option>
        {timezones.map((tz) => (
          <option key={tz} value={tz}>{tz}</option>
        ))}
      </select>
    </div>
  );
}
