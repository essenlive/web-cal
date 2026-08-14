import { useRef } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { ActionButton } from "../components/ui/action-button";
import { DrawerHeader, DrawerTitle } from "../components/ui/drawer";
import { useUIStore } from "../store";
import { downloadSettingsExport, importSettingsFile, resetSettings } from "../lib/settings-export";

/** Preferences — rendered as drawer content from the sidebar's Settings icon. */
export function PreferencesPanel() {
  const {
    weekStartsOnMonday, toggleWeekStart,
    use24h, setUse24h,
    dateFormatEU, setDateFormatEU,
  } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    downloadSettingsExport();
    toast.success("Paramètres exportés");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await importSettingsFile(file);
    } catch {
      toast.error("Fichier de paramètres invalide.");
    }
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Préférences</DrawerTitle>
      </DrawerHeader>

      <div className="mx-4 mb-4 rounded-xl border border-border bg-card p-4 space-y-5">

        {/* Week start */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Semaine commence le lundi</div>
            <div className="text-xs text-muted-foreground">Afficher lundi en premier dans la vue calendrier</div>
          </div>
          <Switch checked={weekStartsOnMonday} onCheckedChange={toggleWeekStart} />
        </div>

        <div className="border-t border-border" />

        {/* 24h clock */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Format 24h</div>
            <div className="text-xs text-muted-foreground">Afficher les heures au format 24h (ex : 14:30)</div>
          </div>
          <Switch checked={use24h} onCheckedChange={setUse24h} />
        </div>

        <div className="border-t border-border" />

        {/* Date format */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Format de date européen</div>
            <div className="text-xs text-muted-foreground">{dateFormatEU ? "JJ/MM/AAAA — ex : 15/03/2025" : "MM/JJ/AAAA — ex : 03/15/2025"}</div>
          </div>
          <Switch checked={dateFormatEU} onCheckedChange={setDateFormatEU} />
        </div>

        <div className="border-t border-border" />

        {/* Export / import */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Paramètres</div>
            <div className="text-xs text-muted-foreground">Exporter ou importer connexions, types, règles, préférences et thèmes</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>Exporter</Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Importer</Button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Reset */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">Réinitialiser</div>
            <div className="text-xs text-muted-foreground">Supprime sources, types, règles, préférences et thèmes personnalisés</div>
          </div>
          <ActionButton
            variant="outline"
            size="sm"
            onAction={resetSettings}
            confirmChildren={<><RotateCcw size={13} />Confirmer</>}
          >
            <RotateCcw size={13} />
            Réinitialiser
          </ActionButton>
        </div>

      </div>
    </>
  );
}
