import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, Upload, RotateCcw } from "lucide-react";
import { cn } from "../lib/utils";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { ActionButton } from "../components/ui/action-button";
import { PanelHeader } from "../components/settings/PanelHeader";
import { useUIStore } from "../store";
import { downloadSettingsExport, importSettingsFile, resetSettings, type ExportSection } from "../lib/settings-export";

const EXPORT_SECTION_LABELS: { key: ExportSection; label: string }[] = [
  { key: "presets", label: "Presets" },
  { key: "sources", label: "Sources" },
  { key: "rulesAndStyles", label: "Règles et styles" },
  { key: "themes", label: "Thèmes" },
  { key: "general", label: "Réglages généraux" },
];

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
  const [exportSections, setExportSections] = useState<Set<ExportSection>>(
    new Set(EXPORT_SECTION_LABELS.map((s) => s.key))
  );

  function toggleExportSection(key: ExportSection) {
    setExportSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExport() {
    downloadSettingsExport(Array.from(exportSections));
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
        <div className="rounded-lg border border-border bg-card px-3 py-3">
          <div className="text-sm font-medium text-foreground">Exporter</div>
          <div className="text-xs text-muted-foreground">
            Choisissez les sections à inclure dans le fichier .json exporté.
          </div>
          <div className="my-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {EXPORT_SECTION_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-foreground">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                  checked={exportSections.has(key)}
                  onChange={() => toggleExportSection(key)}
                />
                {label}
              </label>
            ))}
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleExport}>
            <Download size={13} />
            Exporter
          </Button>
        </div>

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
