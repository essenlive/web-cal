import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { useUIStore } from "../store";

export function SettingsPage() {
  const {
    weekStartsOnMonday, toggleWeekStart,
    use24h, setUse24h,
    dateFormatEU, setDateFormatEU,
  } = useUIStore();

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 h-14 px-4 border-b border-border bg-card">
        <Button variant="ghost" size="icon" className="text-muted-foreground" asChild>
          <Link href="/">
            <ArrowLeft size={18} />
          </Link>
        </Button>
        <h1 className="text-base font-semibold text-foreground">Paramètres</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Préférences</h2>
        <div className="rounded-xl border border-border bg-card p-4 space-y-5">

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

        </div>
      </div>
    </div>
  );
}
