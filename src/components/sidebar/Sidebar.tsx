import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, addMonths, subMonths, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings,
  Keyboard,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Sun,
  Moon,
  CircleHelp,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn, SECTION_LABEL } from "../../lib/utils";
import { zonedNow } from "../../lib/timezone";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { TimezoneSelect } from "../settings/TimezoneSelect";
import { ActionButton } from "../ui/action-button";
import { useUIStore, useConnectionStore, useEventTypeStore, useRuleStore, useThemeStore } from "../../store";
import { useConnectionStatusMap, useConnectionSyncMeta, useSourceSync } from "../../context/DataProviderContext";
import { getIconEl } from "../../lib/icons";
import { connectionStatusDetail, statusColor } from "../../lib/connection-status";
import { Section } from "./Section";
import { ItemRow, ItemBadge } from "./ItemRow";
import { PresetSelector } from "./PresetSelector";
import { SimpleTooltip } from "../ui/tooltip";
import { orderThemes } from "../../lib/theme";
import type { Connection, ConnectionStatus, ConnectionSyncMeta, EventType, Theme } from "../../types";

// ── Compact data source row ───────────────────────────────────────────────────

function ConnectionRow({ connection, status, syncMeta, onEdit, onToggleHidden }: {
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

function TypeRow({ type, onEdit, onToggleHidden }: {
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

function ThemeRow({ theme, active, onSelect, onEdit }: {
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

// ── Compact preference toggle ─────────────────────────────────────────────────

function PrefToggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 px-2 py-1 rounded-md text-xs text-foreground hover:bg-muted cursor-pointer">
      <span className="truncate">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="scale-75 origin-right" />
    </label>
  );
}

export function Sidebar() {
  const {
    currentDate, setCurrentDate, weekStartsOnMonday, toggleWeekStart, use24h, setUse24h, dateFormatEU, setDateFormatEU,
    sidebarOpen, openDrawer, openNewItemDrawer, timezone,
  } = useUIStore();
  const [miniDate, setMiniDate] = useState(currentDate);
  const weekStart = weekStartsOnMonday ? 1 : 0;

  const { connections, updateConnection } = useConnectionStore();
  const statusMap = useConnectionStatusMap();
  const syncMeta = useConnectionSyncMeta();
  const { refresh, lastUpdated } = useSourceSync();
  const { types, updateType, getDefaultType } = useEventTypeStore();
  const { addRule } = useRuleStore();
  const { customThemes, themeOrder, selectedThemeId, selectTheme } = useThemeStore();

  // Aggregate cached period across every source, for the refresh button's tooltip —
  // earliest cachedRange start to latest cachedRange end. null until at least one
  // connection has completed a fetch.
  const cachedSpan = Object.values(syncMeta).reduce<{ start: string; end: string } | null>((acc, m) => {
    if (!m.cachedRange) return acc;
    if (!acc) return m.cachedRange;
    return { start: m.cachedRange.start < acc.start ? m.cachedRange.start : acc.start, end: m.cachedRange.end > acc.end ? m.cachedRange.end : acc.end };
  }, null);
  const refreshLabel = lastUpdated
    ? `Actualisé à ${format(lastUpdated, "HH:mm", { locale: fr })}${
        cachedSpan
          ? ` · période en cache : ${format(new Date(cachedSpan.start), "d MMM", { locale: fr })} – ${format(new Date(cachedSpan.end), "d MMM", { locale: fr })}`
          : ""
      }`
    : "Actualiser";

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
  const today      = zonedNow(timezone);
  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    format(addDays(gridStart, i), "EEEEE", { locale: fr })
  );
  const themes = orderThemes(customThemes, themeOrder);

  return (
    <aside
      className="
      fixed top-14 bottom-0 left-0 z-40 w-56
      sm:relative sm:inset-auto sm:z-auto sm:translate-x-0
      shrink-0 border-r border-border flex flex-col bg-card overflow-hidden
      transition-transform duration-200
    "
    >
      <div className="flex-1 overflow-y-auto">
        {/* Mini calendar */}
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => setMiniDate(subMonths(miniDate, 1))}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs font-semibold text-foreground capitalize">
              {format(miniDate, "MMMM yyyy", { locale: fr })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => setMiniDate(addMonths(miniDate, 1))}
            >
              <ChevronRight size={14} />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px">
            {dayHeaders.map((d, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-medium text-muted-foreground py-0.5 uppercase"
              >
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayIsToday = isSameDay(day, today);
              const dayIsSelected = isSameDay(day, currentDate);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    setCurrentDate(day);
                    setMiniDate(day);
                  }}
                  className={cn(
                    "flex items-center justify-center size-6 mx-auto rounded-full text-[10px] transition-colors",
                    !isSameMonth(day, miniDate) && "opacity-30",
                    dayIsToday && "ring-2 ring-inset ring-primary font-semibold",
                    dayIsSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : cn("hover:bg-muted text-foreground", dayIsToday && "text-primary"),
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
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
              className={cn("flex-1 min-w-0 text-left truncate hover:text-foreground", SECTION_LABEL)}
            >
              Règles
            </button>
            <button
              onClick={handleAddRule}
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Ajouter une règle"
            >
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
            <SimpleTooltip label={refreshLabel}>
              <ActionButton
                variant="ghost"
                size="icon"
                confirm={false}
                onAction={refresh}
                aria-label={refreshLabel}
                className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent shrink-0"
              >
                <RefreshCw size={12} />
              </ActionButton>
            </SimpleTooltip>
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
              onToggleHidden={() =>
                updateConnection({ ...c, hidden: !c.hidden })
              }
            />
          ))}
        </Section>

        <div className="border-t border-border" />

        {/* Event types preview */}
        <Section
          id="eventType"
          label="Types"
          onOpen={() => openDrawer("eventType")}
          onAdd={() => openNewItemDrawer("eventType")}
        >
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
        <Section
          id="theme"
          label="Thème"
          onOpen={() => openDrawer("theme")}
          onAdd={() => openNewItemDrawer("theme")}
        >
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

        <div className="border-t border-border" />

        {/* Preferences — every option lives right here; the label opens the same
          options in the full drawer, with descriptions. */}
        <Section id="preferences" label="Réglages" onOpen={() => openDrawer("preferences")}>
          <PrefToggle label="Semaine dès lundi" checked={weekStartsOnMonday} onCheckedChange={toggleWeekStart} />
          <PrefToggle label="Format 24h" checked={use24h} onCheckedChange={setUse24h} />
          <PrefToggle label="Date européenne" checked={dateFormatEU} onCheckedChange={setDateFormatEU} />
          <TimezoneSelect compact />
        </Section>
      </div>

      {/* Bottom toolbar — outside the scroll container above, so it stays visible
          regardless of how much sidebar content there is to scroll through. */}
      <div className="shrink-0 border-t border-border px-2 py-2 flex items-center justify-around">
        <SimpleTooltip label="Raccourcis clavier">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => openDrawer("shortcuts")}
            aria-label="Raccourcis clavier"
          >
            <Keyboard size={16} />
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Mes données">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            asChild
            aria-label="Mes données"
          >
            <Link href="/data">
              <Settings size={16} />
            </Link>
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Statistiques">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            asChild
            aria-label="Statistiques"
          >
            <Link href="/stats">
              <BarChart3 size={16} />
            </Link>
          </Button>
        </SimpleTooltip>
        <SimpleTooltip label="Aide">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => openDrawer("help")}
            aria-label="Aide"
          >
            <CircleHelp size={16} />
          </Button>
        </SimpleTooltip>
      </div>
    </aside>
  );
}
