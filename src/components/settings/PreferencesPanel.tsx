import { Switch } from "../components/ui/switch";
import { PanelHeader } from "../components/settings/PanelHeader";
import { TimezoneSelect } from "../components/settings/TimezoneSelect";
import { useUIStore } from "../store";

function ToggleRow({ title, description, checked, onCheckedChange }: {
  title: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/** Preferences — rendered as drawer content from the sidebar's Settings icon. */
export function PreferencesPanel() {
  const {
    weekStartsOnMonday, toggleWeekStart,
    use24h, setUse24h,
    dateFormatEU, setDateFormatEU,
  } = useUIStore();

  return (
    <>
      <PanelHeader title="Réglages" description="Ces réglages généraux s'appliquent à tous les thèmes et presets." />

      <div className="space-y-1.5 px-4 pb-4">
        <ToggleRow
          title="Semaine commence le lundi"
          description="Afficher lundi en premier dans la vue calendrier"
          checked={weekStartsOnMonday}
          onCheckedChange={toggleWeekStart}
        />
        <ToggleRow
          title="Format 24h"
          description="Afficher les heures au format 24h (ex : 14:30)"
          checked={use24h}
          onCheckedChange={setUse24h}
        />
        <ToggleRow
          title="Format de date européen"
          description={dateFormatEU ? "JJ/MM/AAAA — ex : 15/03/2025" : "MM/JJ/AAAA — ex : 03/15/2025"}
          checked={dateFormatEU}
          onCheckedChange={setDateFormatEU}
        />
        <TimezoneSelect />
      </div>
    </>
  );
}
