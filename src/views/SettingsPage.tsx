import { useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, Upload, RotateCcw } from "lucide-react";
import { cn } from "../lib/utils";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { ActionButton } from "../components/ui/action-button";
import { PanelHeader } from "../components/settings/PanelHeader";
import { useUIStore } from "../store";
import { downloadSettingsExport, importSettingsFile, resetSettings } from "../lib/settings-export";

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

function ActionCard({ tone = "default", title, description, children }: {
  tone?: "default" | "amber" | "destructive"; title: string; description: string; children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-3",
        tone === "default" && "border-border bg-card",
        tone === "amber" && "border-amber-500/20 bg-amber-500/10",
        tone === "destructive" && "border-destructive/20 bg-destructive/10"
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
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
      </div>

      <p className="px-4 pb-3 text-sm text-muted-foreground">
        Cette application n&apos;a pas de serveurs, tout est stocké localement sur votre appareil. Pour la porter
        sur un autre appareil, exportez-la puis importez-la.
      </p>

      <div className="space-y-1.5 px-4 pb-4">
        <ActionCard
          title="Exporter"
          description="Exporte toute la configuration dans un fichier .json : presets, sources, types, règles, thèmes et réglages."
        >
          <Button size="sm" className="gap-1.5" onClick={handleExport}>
            <Download size={13} />
            Exporter
          </Button>
        </ActionCard>

        <ActionCard
          tone="amber"
          title="Importer"
          description="Importe et remplace toute la configuration : presets, sources, types, règles, thèmes et réglages."
        >
          <Button size="sm" className="gap-1.5 bg-amber-500 text-white hover:bg-amber-600" onClick={() => fileInputRef.current?.click()}>
            <Upload size={13} />
            Importer
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </ActionCard>

        <ActionCard
          tone="destructive"
          title="Réinitialiser"
          description="Supprime toute la configuration pour les valeurs par défaut : presets, sources, types, règles, thèmes et réglages."
        >
          <ActionButton
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onAction={resetSettings}
            confirmChildren="Confirmer"
          >
            <RotateCcw size={13} />
            Réinitialiser
          </ActionButton>
        </ActionCard>
      </div>
    </>
  );
}
