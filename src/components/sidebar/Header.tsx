import { format, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Settings, Menu, Sun, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../store";
import type { CalendarView } from "../../types";

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month",  label: "Mois"   },
  { id: "week",   label: "Sem."   },
  { id: "agenda", label: "Agenda" },
];

export function Header() {
  const { view, setView, currentDate, setCurrentDate, toggleSidebar, darkMode, toggleDark } = useUIStore();

  const navigate = (dir: 1 | -1) => {
    const fns: Record<CalendarView, (d: Date, n: number) => Date> = {
      month:  (d, n) => (n > 0 ? addMonths(d, 1) : subMonths(d, 1)),
      week:   (d, n) => (n > 0 ? addWeeks(d, 1) : subWeeks(d, 1)),
      agenda: (d, n) => (n > 0 ? addMonths(d, 1) : subMonths(d, 1)),
    };
    setCurrentDate(fns[view](currentDate, dir));
  };

  const title = () => {
    return format(currentDate, "MMMM yyyy", { locale: fr });
  };

  return (
    <header className="flex items-center h-14 px-2 sm:px-4 border-b border-border bg-card shrink-0 gap-1 sm:gap-2">
      {/* Left */}
      <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
        <Menu size={18} />
      </button>

      <span className="text-base font-bold text-foreground hidden sm:block sm:mr-2">Calendrier</span>

      <button
        onClick={() => setCurrentDate(new Date())}
        className="text-xs font-medium px-2 sm:px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
      >
        Auj.
      </button>

      <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
        <ChevronRight size={18} />
      </button>

      <h1 className="text-xs sm:text-sm font-semibold text-foreground capitalize ml-1 flex-1 truncate">{title()}</h1>

      {/* View switcher */}
      <div className="flex rounded-xl border border-border overflow-hidden bg-background shrink-0">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors",
              view === v.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Right */}
      <button onClick={toggleDark} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Basculer le thème">
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <Link to="/settings" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
        <Settings size={17} />
      </Link>
    </header>
  );
}
