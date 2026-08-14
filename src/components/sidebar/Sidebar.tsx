import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay, isToday, addMonths, subMonths, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Settings, Keyboard, Eye, EyeOff, Pencil, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useUIStore, useConnectionStore, useEventTypeStore, useRuleStore, useEventsStore, useThemeStore } from "../../store";
import { useConnectionStatusMap } from "../../context/DataProviderContext";
import { getIconEl } from "../settings/EventTypeModal";
import { Section } from "./Section";
import { ItemRow, ItemBadge } from "./ItemRow";
import { PresetSelector } from "./PresetSelector";
import { describeMatch } from "../../lib/rules";
import { getAllThemes, isBuiltinTheme } from "../../lib/theme";
import type { Connection, ConnectionStatus, EventType, Rule, Theme } from "../../types";

/** Native HTML5 drag handlers for one row — see src/hooks/useDragReorder.ts. Omitted where a row isn't reorderable. */
export interface DragProps {
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
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

export function ConnectionRow({ connection, status, onEdit, onToggleHidden }: {
  connection: Connection; status: ConnectionStatus; onEdit: () => void; onToggleHidden: () => void;
}) {
  const hidden = !!connection.hidden;
  return (
    <ItemRow
      badge={<ItemBadge color={connection.color}>{connection.name.trim().charAt(0).toUpperCase()}</ItemBadge>}
      name={connection.name}
      muted={hidden}
      state={<span className={cn("size-1.5 rounded-full shrink-0", statusColor(status))} title={status} />}
      actions={[
        { icon: <Pencil size={12} />, label: "Modifier", onClick: onEdit },
        { icon: hidden ? <EyeOff size={12} /> : <Eye size={12} />, label: hidden ? "Afficher" : "Masquer", onClick: onToggleHidden },
      ]}
    />
  );
}

// ── Compact event type row ────────────────────────────────────────────────────

export function TypeRow({ type, onEdit, onToggleHidden, dragProps }: {
  type: EventType; onEdit: () => void; onToggleHidden: () => void; dragProps?: DragProps;
}) {
  const hidden = !!type.hidden;
  return (
    <ItemRow
      badge={<ItemBadge color={type.color}>{getIconEl(type.icon, 10, "#fff")}</ItemBadge>}
      name={type.label}
      muted={hidden}
      dragProps={dragProps}
      actions={[
        { icon: <Pencil size={12} />, label: "Modifier", onClick: onEdit },
        { icon: hidden ? <EyeOff size={12} /> : <Eye size={12} />, label: hidden ? "Afficher" : "Masquer", onClick: onToggleHidden },
      ]}
    />
  );
}

// ── Compact rule row ──────────────────────────────────────────────────────────

export function RuleRow({ rule, description, displayType, onEdit, onToggleEnabled }: {
  rule: Rule; description: string; displayType: EventType | undefined; onEdit: () => void; onToggleEnabled: () => void;
}) {
  return (
    <ItemRow
      badge={<ItemBadge color={displayType?.color ?? "#6366f1"}>{displayType && getIconEl(displayType.icon, 10, "#fff")}</ItemBadge>}
      name={description}
      muted={!rule.enabled}
      actions={[
        { icon: <Pencil size={12} />, label: "Modifier", onClick: onEdit },
        { icon: rule.enabled ? <Eye size={12} /> : <EyeOff size={12} />, label: rule.enabled ? "Désactiver" : "Activer", onClick: onToggleEnabled },
      ]}
    />
  );
}

// ── Compact theme row ─────────────────────────────────────────────────────────

export function ThemeRow({ theme, active, onSelect, onEdit, dragProps }: {
  theme: Theme; active: boolean; onSelect: () => void; onEdit?: () => void; dragProps?: DragProps;
}) {
  return (
    <ItemRow
      badge={<ItemBadge color={theme.accent}>{theme.mode === "dark" ? <Moon size={10} color="#fff" /> : <Sun size={10} color="#fff" />}</ItemBadge>}
      name={theme.name}
      selected={active}
      onSelect={onSelect}
      dragProps={dragProps}
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
  const { types, updateType, getType } = useEventTypeStore();
  const { rules, toggleRule } = useRuleStore();
  const { events } = useEventsStore();
  const { customThemes, selectedThemeId, selectTheme } = useThemeStore();

  if (!sidebarOpen) return null;

  const monthStart = startOfMonth(miniDate);
  const monthEnd   = endOfMonth(miniDate);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: weekStart });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: weekStart });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    format(addDays(gridStart, i), "EEEEE", { locale: fr })
  );
  const themes = getAllThemes(customThemes);

  return (
    <aside className="
      fixed top-14 bottom-0 left-0 z-40 w-56
      sm:relative sm:inset-auto sm:z-auto sm:translate-x-0
      shrink-0 border-r border-border flex flex-col bg-card overflow-y-auto
      transition-transform duration-200
    ">
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

      {/* Data sources preview */}
      <Section id="connections" label="Sources" onOpen={() => openDrawer("connection")} onAdd={() => openNewItemDrawer("connection")}>
        {connections.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">Aucune source.</p>
        )}
        {connections.map((c) => (
          <ConnectionRow
            key={c.id}
            connection={c}
            status={statusMap[c.id] ?? "unchecked"}
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

      {/* Rules preview */}
      <Section id="rules" label="Règles" onOpen={() => openDrawer("rules")} onAdd={() => openNewItemDrawer("rules")}>
        {rules.filter((r) => r.matchType !== "all").map((r) => (
          <RuleRow
            key={r.id}
            rule={r}
            description={describeMatch(r, (id) => events.find((e) => e.id === id)?.title, (id) => connections.find((c) => c.id === id)?.name)}
            displayType={getType(r.displayTypeId)}
            onEdit={() => openDrawer("rules", r.id)}
            onToggleEnabled={() => toggleRule(r.id)}
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
            onEdit={isBuiltinTheme(t.id) ? undefined : () => openDrawer("theme", t.id)}
          />
        ))}
      </Section>

      {/* Preferences — flat, no sub-items to collapse or reorder */}
      <div className="mt-auto border-t border-border px-3 py-3 flex items-center gap-1">
        <button
          onClick={() => openDrawer("preferences")}
          className="flex items-center gap-2 flex-1 min-w-0 rounded-lg px-2 py-1.5 hover:bg-muted text-xs text-foreground"
        >
          <Settings size={14} className="text-muted-foreground" />
          Réglages
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground shrink-0"
          onClick={() => openDrawer("shortcuts")}
          aria-label="Raccourcis clavier"
        >
          <Keyboard size={16} />
        </Button>
      </div>
    </aside>
  );
}
