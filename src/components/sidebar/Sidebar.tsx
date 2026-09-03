import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, addMonths, subMonths, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, RefreshCw, Settings, Keyboard, Eye, EyeOff, Pencil, Plus, Sun, Moon, Bug, Database, GitBranch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { ActionButton } from "../ui/action-button";
import { useUIStore, useConnectionStore, useEventTypeStore, useRuleStore, useThemeStore } from "../../store";
import { useConnectionStatusMap, useConnectionSyncMeta, useSourceSync } from "../../context/DataProviderContext";
import { getIconEl } from "../../lib/icons";
import { Section } from "./Section";
import { ItemRow, ItemBadge } from "./ItemRow";
import { PresetSelector } from "./PresetSelector";
import { SimpleTooltip } from "../ui/tooltip";
import { orderThemes } from "../../lib/theme";
import type { Connection, ConnectionStatus, ConnectionSyncMeta, EventType, Theme } from "../../types";

const REPO_URL = "https://github.com/essenlive/web-cal";

/** Pointer-based (mouse + touch) drag handle wiring for one row — see src/hooks/useDragReorder.ts. Omitted where a row isn't reorderable. */
export interface DragProps {
  ref: (el: HTMLElement | null) => void;
  dragging: boolean;
  over: boolean;
  onHandlePointerDown: (e: React.PointerEvent) => void;
}

// ── Compact data source row ───────────────────────────────────────────────────

export function statusColor(status: ConnectionStatus) {
  switch (status) {
    case "active":  return "bg-green-500";
    case "error":   return "bg-amber-500";
    case "loading": return "bg-muted-foreground animate-pulse";
    default:        return "bg-muted-foreground/40";
  }
}

export function statusLabel(status: ConnectionStatus) {
  switch (status) {
    case "active":  return "Connecté";
    case "error":   return "Échec de connexion";
    case "loading": return "Chargement…";
    default:        return "Non vérifié";
  }
}

/**
 * Full sync detail behind a connection's status dot: the last error (with when it'll
 * retry, if backed off) or, when healthy, when it last actually synced — see
 * useConnectionSyncMeta(). Falls back to the bare statusLabel() before any fetch attempt.
 */
export function connectionStatusDetail(status: ConnectionStatus, meta?: ConnectionSyncMeta): string {
  if (status === "error") {
    const retrying = meta?.nextRetryAt && meta.nextRetryAt > Date.now()
      ? ` — nouvelle tentative à ${format(meta.nextRetryAt, "HH:mm")}`
      : "";
    return (meta?.message ?? statusLabel(status)) + retrying;
  }
  if (meta?.lastSyncedAt) return `${statusLabel(status)} — synchronisé à ${format(meta.lastSyncedAt, "HH:mm")}`;
  return statusLabel(status);
}

export function ConnectionRow({ connection, status, syncMeta, onEdit, onToggleHidden }: {
  connection: Connection; status: ConnectionStatus; syncMeta?: ConnectionSyncMeta; onEdit: () => void; onToggleHidden: () => void;
}) {
  const hidden = !!connection.hidden;
  return (
    <ItemRow
      badge={<ItemBadge color={connection.color}>{connection.name.trim().charAt(0).toUpperCase()}</ItemBadge>}
      name={connection.name}
      muted={hidden}
      state={
        <SimpleTooltip label={connectionStatusDetail(status, syncMeta)}>
          <span aria-label={connectionStatusDetail(status, syncMeta)} className={cn("size-1.5 rounded-full shrink-0", statusColor(status))} />
        </SimpleTooltip>
      }
      actions={[
        { icon: <Pencil size={12} />, label: "Modifier", onClick: onEdit },
        { icon: hidden ? <EyeOff size={12} /> : <Eye size={12} />, label: hidden ? "Afficher" : "Masquer", onClick: onToggleHidden },
      ]}
    />
  );
}

// ── Compact event type row ────────────────────────────────────────────────────

export function TypeRow({ type, onEdit, onToggleHidden }: {
  type: EventType; onEdit: () => void; onToggleHidden: () => void;
}) {
  const hidden = !!type.hidden;
  return (
    <ItemRow
      badge={<ItemBadge color={type.color}>{getIconEl(type.icon, 10, "#fff")}</ItemBadge>}
      name={type.label}
      muted={hidden}
      actions={[
        { icon: <Pencil size={12} />, label: "Modifier", onClick: onEdit },
        { icon: hidden ? <EyeOff size={12} /> : <Eye size={12} />, label: hidden ? "Afficher" : "Masquer", onClick: onToggleHidden },
      ]}
    />
  );
}

// ── Compact theme row ─────────────────────────────────────────────────────────

export function ThemeRow({ theme, active, onSelect, onEdit }: {
  theme: Theme; active: boolean; onSelect: () => void; onEdit?: () => void;
}) {
  return (
    <ItemRow
      badge={<ItemBadge color={theme.accent}>{theme.mode === "dark" ? <Moon size={10} color="#fff" /> : <Sun size={10} color="#fff" />}</ItemBadge>}
      name={theme.name}
      selected={active}
      onSelect={onSelect}
      actions={onEdit ? [{ icon: <Pencil size={12} />, label: "Modifier", onClick: onEdit }] : undefined}
    />
  );
}

export function Sidebar() {
  const { currentDate, setCurrentDate, weekStartsOnMonday, sidebarOpen, openDrawer, openNewItemDrawer } = useUIStore();
  const [miniDate, setMiniDate] = useState(currentDate);
  const weekStart = weekStartsOnMonday ? 1 : 0;

  const { connections, updateConnection } = useConnectionStore();
  const statusMap = useConnectionStatusMap();
  const syncMeta = useConnectionSyncMeta();
  const { refresh, lastUpdated } = useSourceSync();
  const { types, updateType, getDefaultType } = useEventTypeStore();
  const { addRule } = useRuleStore();
  const { customThemes, themeOrder, selectedThemeId, selectTheme } = useThemeStore();

  const handleAddRule = () => {
    addRule({ matchType: "name", matchValue: "", displayTypeId: getDefaultType().id });
    openDrawer("rules");
  };

  if (!sidebarOpen) return null;

  const monthStart = startOfMonth(miniDate);
  const monthEnd   = endOfMonth(miniDate);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: weekStart });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: weekStart });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    format(addDays(gridStart, i), "EEEEE", { locale: fr })
  );
  const themes = orderThemes(customThemes, themeOrder);

  return (
    <aside className="
      fixed top-14 bottom-0 left-0 z-40 w-56
      sm:relative sm:inset-auto sm:z-auto sm:translate-x-0
      shrink-0 border-r border-border flex flex-col bg-card overflow-hidden
      transition-transform duration-200
    ">
      <div className="flex-1 overflow-y-auto">
      {/* Mini calendar */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setMiniDate(subMonths(miniDate, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <span className="text-xs font-semibold text-foreground capitalize">
            {format(miniDate, "MMMM yyyy", { locale: fr })}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setMiniDate(addMonths(miniDate, 1))}>
            <ChevronRight size={14} />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px">
          {dayHeaders.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-medium text-muted-foreground py-0.5 uppercase">
              {d}
            </div>
          ))}
          {days.map((day) => (
            <button
              key={day.toISOString()}
              onClick={() => { setCurrentDate(day); setMiniDate(day); }}
              className={cn(
                "flex items-center justify-center size-6 mx-auto rounded-full text-[10px] transition-colors",
                !isSameMonth(day, miniDate) && "opacity-30",
                isToday(day) && "bg-primary/20 text-primary font-semibold",
                isSameDay(day, currentDate) && "bg-primary text-primary-foreground font-semibold",
                !isSameDay(day, currentDate) && "hover:bg-muted text-foreground"
              )}
            >
              {format(day, "d")}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Presets */}
      <PresetSelector />

      <div className="border-t border-border" />

      {/* Rules — its own section, but purely a link to the rules drawer: unlike
          Sources/Types/Thème there's no compact per-item preview worth rendering here.
          A dot stands in for the other sections' chevron (nothing to collapse) so the
          label still lines up with theirs. */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-1 px-2">
          <span className="flex items-center justify-center size-3 shrink-0">
            <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          </span>
          <button
            onClick={() => openDrawer("rules")}
            className="flex-1 min-w-0 text-left text-[10px] font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wide truncate"
          >
            Règles
          </button>
          <button onClick={handleAddRule} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Ajouter une règle">
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Data sources preview */}
      <Section
        id="connections"
        label="Sources"
        onOpen={() => openDrawer("connection")}
        onAdd={() => openNewItemDrawer("connection")}
        extra={
          <ActionButton
            variant="ghost"
            size="icon"
            confirm={false}
            onAction={refresh}
            aria-label={lastUpdated ? `Actualiser (dernière actualisation à ${format(lastUpdated, "HH:mm")})` : "Actualiser"}
            className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent shrink-0"
          >
            <RefreshCw size={12} />
          </ActionButton>
        }
      >
        {connections.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">Aucune source.</p>
        )}
        {connections.map((c) => (
          <ConnectionRow
            key={c.id}
            connection={c}
            status={statusMap[c.id] ?? "unchecked"}
            syncMeta={syncMeta[c.id]}
            onEdit={() => openDrawer("connection", c.id)}
            onToggleHidden={() => updateConnection({ ...c, hidden: !c.hidden })}
          />
        ))}
      </Section>

      <div className="border-t border-border" />

      {/* Event types preview */}
      <Section id="eventType" label="Types" onOpen={() => openDrawer("eventType")} onAdd={() => openNewItemDrawer("eventType")}>
        {types.map((t) => (
          <TypeRow
            key={t.id}
            type={t}
            onEdit={() => openDrawer("eventType", t.id)}
            onToggleHidden={() => updateType({ ...t, hidden: !t.hidden })}
          />
        ))}
      </Section>

      <div className="border-t border-border" />

      {/* Theme preview */}
      <Section id="theme" label="Thème" onOpen={() => openDrawer("theme")} onAdd={() => openNewItemDrawer("theme")}>
        {themes.map((t) => (
          <ThemeRow
            key={t.id}
            theme={t}
            active={t.id === selectedThemeId}
            onSelect={() => selectTheme(t.id)}
            onEdit={() => openDrawer("theme", t.id)}
          />
        ))}
      </Section>
      </div>

      {/* Bottom toolbar — outside the scroll container above, so it stays visible
          regardless of how much sidebar content there is to scroll through. */}
      <div className="shrink-0 border-t border-border px-2 py-2 flex items-center justify-around">
        <SimpleTooltip label="Réglages">
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => openDrawer("preferences")} aria-label="Réglages">
            <Settings size={16} />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Raccourcis clavier">
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => openDrawer("shortcuts")} aria-label="Raccourcis clavier">
            <Keyboard size={16} />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Mes données">
          <Button variant="ghost" size="icon" className="text-muted-foreground" asChild aria-label="Mes données">
            <Link href="/data">
              <Database size={16} />
            </Link>
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Debug">
          <Button variant="ghost" size="icon" className="text-muted-foreground" asChild aria-label="Debug">
            <Link href="/debug">
              <Bug size={16} />
            </Link>
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Dépôt GitHub">
          <Button variant="ghost" size="icon" className="text-muted-foreground" asChild aria-label="Dépôt GitHub">
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <GitBranch size={16} />
            </a>
          </Button>
        </SimpleTooltip>
      </div>
    </aside>
  );
}
