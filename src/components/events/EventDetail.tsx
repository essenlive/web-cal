import { format } from "date-fns";
import DOMPurify from "dompurify";
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

// Notes come from external calendar feeds, so links must open safely (no opener/referrer leak).
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/** Read-only event view — sources are read-only, so there is no edit/save/delete here (FR-016). */
export function EventDetail({ event, onClose }: EventDetailProps) {
  const { getType } = useEventTypeStore();
  const { dateFormatEU, openDrawer } = useUIStore();
  const { rules, addRule } = useRuleStore();
  const { events } = useEventsStore();
  const { connections } = useConnectionStore();

  const type = resolveEventType(event, getType, rules);
  const source = connections.find((c) => c.id === event.calendarId);
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
      <DialogContent animation="fade" className="max-w-md rounded-2xl p-0 gap-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-2 pr-8">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 min-w-0">
              <span
                className="flex items-center justify-center size-6 rounded-full shrink-0"
                style={{ backgroundColor: type.color + "20", color: type.color }}
              >
                {getIconEl(type.icon, 13, type.color)}
              </span>
              <span className="min-w-0 wrap-anywhere">{event.title}</span>
            </DialogTitle>
            {source && (
              <span className="flex items-center gap-1.5 text-xs font-medium shrink-0 mt-0.5" style={{ color: source.color }}>
                <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: source.color }} />
                <span className="max-w-24 truncate">{source.name}</span>
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-3 overflow-y-auto min-h-0">
          <div className="text-sm text-muted-foreground">
            {event.allDay
              ? `${format(start, dateFmt)} – ${format(end, dateFmt)}`
              : `${format(start, dateFmt)} · ${format(start, "HH:mm")} – ${format(end, "HH:mm")}`}
          </div>

          {event.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={13} className="shrink-0" />
              <span className="min-w-0 wrap-anywhere">{event.location}</span>
            </div>
          )}

          {event.notes && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <StickyNote size={13} className="mt-0.5 shrink-0" />
              <div
                className="min-w-0 max-h-80 overflow-y-auto overflow-x-hidden whitespace-pre-wrap wrap-anywhere rounded-lg border border-border bg-muted/30 px-3 py-2 [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.notes) }}
              />
            </div>
          )}

          {/* Applied rule + resolved type (FR-024) */}
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-1.5">
              <ListOrdered size={13} className="shrink-0" />
              <span className="min-w-0 wrap-anywhere">
                Règle correspondante :{" "}
                {isDefault ? (
                  "aucune (style par défaut)"
                ) : (
                  <button
                    type="button"
                    onClick={() => { onClose(); openDrawer("rules", matchedRule.id); }}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {ruleDescription}
                  </button>
                )}
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
            <button
              type="button"
              onClick={() => {
                addRule({ matchType: "name", matchValue: event.title, displayTypeId: type.id });
                onClose();
                openDrawer("rules");
              }}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Plus size={12} /> Créer une règle
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
