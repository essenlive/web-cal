import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { cn, stepDate } from "../../lib/utils";
import { Button } from "../ui/button";
import { useUIStore } from "../../store";
import type { CalendarView } from "../../types";

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month",  label: "Mois"   },
  { id: "week",   label: "Sem."   },
  { id: "day",    label: "Jour"   },
  { id: "agenda", label: "Agenda" },
];

export function Header() {
  const { view, setView, currentDate, setCurrentDate, toggleSidebar } = useUIStore();

  const navigate = (dir: 1 | -1) => setCurrentDate(stepDate(view, currentDate, dir));

  const title = () => {
    if (view === "day") return format(currentDate, "EEEE d MMMM yyyy", { locale: fr });
    return format(currentDate, "MMMM yyyy", { locale: fr });
  };

  return (
    <header className="flex items-center h-14 px-2 sm:px-4 border-b border-border bg-card shrink-0 gap-1 sm:gap-2">
      {/* Left */}
      <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-muted-foreground" aria-label="Afficher/masquer la barre latérale">
        <Menu size={18} />
      </Button>

      <span className="text-base font-bold text-foreground hidden sm:block sm:mr-2">Calendrier</span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setCurrentDate(new Date())}
        className="text-xs font-medium"
      >
        Auj.
      </Button>

      <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-muted-foreground" aria-label="Période précédente">
        <ChevronLeft size={18} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => navigate(1)} className="text-muted-foreground" aria-label="Période suivante">
        <ChevronRight size={18} />
      </Button>

      <h1 className="text-xs sm:text-sm font-semibold text-foreground capitalize ml-1 flex-1 truncate">{title()}</h1>

      {/* View switcher */}
      <div className="flex rounded-xl border border-border overflow-hidden bg-background shrink-0">
        {VIEWS.map((v) => (
          <Button
            key={v.id}
            variant="ghost"
            onClick={() => setView(v.id)}
            className={cn(
              "rounded-none px-2 sm:px-3 py-2.5 h-auto text-xs font-medium",
              view === v.id
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v.label}
          </Button>
        ))}
      </div>
    </header>
  );
}
