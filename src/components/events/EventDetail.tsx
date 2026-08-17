import { format } from "date-fns";
import { MapPin, StickyNote, ListOrdered, Pencil, Plus } from "lucide-react";
import { useEventTypeStore, useUIStore, useRuleStore, useEventsStore, useConnectionStore } from "../../store";
import { resolveEventType } from "./EventChip";
import { findMatchingRule, describeMatch } from "../../lib/rules";
import { getIconEl } from "../../lib/icons";
import { ItemBadge } from "../sidebar/ItemRow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type { CalendarEvent } from "../../types";

export interface EventDetailProps {
  event: CalendarEvent;
  onClose: () => void;
}

/** Read-only event view — sources are read-only, so there is no edit/save/delete here (FR-016). */
export function EventDetail({ event, onClose }: EventDetailProps) {
  const { getType } = useEventTypeStore();
  const { dateFormatEU, openDrawer } = useUIStore();
  const { rules, addRule } = useRuleStore();
  const { events } = useEventsStore();
  const { connections } = useConnectionStore();

  const type = resolveEventType(event, getType, rules);
  const matchedRule = findMatchingRule(event, rules);
  const isDefault = matchedRule.matchType === "all";
  const ruleDescription = describeMatch(
    matchedRule,
    (id) => events.find((e) => e.id === id)?.title,
    (id) => connections.find((c) => c.id === id)?.name,
  );

  const dateFmt = dateFormatEU ? "dd/MM/yyyy" : "MM/dd/yyyy";
  const start = new Date(event.start);
  const end = new Date(event.end);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <span
              className="flex items-center justify-center size-6 rounded-full shrink-0"
              style={{ backgroundColor: type.color + "20", color: type.color }}
            >
              {getIconEl(type.icon, 13, type.color)}
            </span>
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-3">
          <div className="text-sm text-muted-foreground">
            {event.allDay
              ? `${format(start, dateFmt)} – ${format(end, dateFmt)}`
              : `${format(start, dateFmt)} · ${format(start, "HH:mm")} – ${format(end, "HH:mm")}`}
          </div>

          {event.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={13} />
              {event.location}
            </div>
          )}

          {event.notes && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <StickyNote size={13} className="mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">{event.notes}</span>
            </div>
          )}

          {/* Applied rule + resolved type (FR-024) */}
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-1.5">
              <ListOrdered size={13} className="shrink-0" />
              <span>
                Règle correspondante : {isDefault ? "aucune (style par défaut)" : ruleDescription}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Stylé via :</span>
              <button
                type="button"
                onClick={() => { onClose(); openDrawer("eventType", type.id); }}
                className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground hover:text-primary"
              >
                <ItemBadge color={type.color}>{getIconEl(type.icon, 10, "#fff")}</ItemBadge>
                <span className="truncate">{type.label}</span>
                <Pencil size={11} className="shrink-0" />
              </button>
            </div>
          </div>

          {/* Create a rule from this event */}
          <button
            type="button"
            onClick={() => {
              addRule({ matchType: "name", matchValue: event.title, displayTypeId: type.id });
              onClose();
              openDrawer("rules");
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus size={12} /> Créer une règle
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
