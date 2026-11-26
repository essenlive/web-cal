"use client";

import { useState } from "react";
import { addDays, format, subDays } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { useServerStore } from "../../store";
import { serverHeaders } from "../../lib/server-api";
import { useSourceSync } from "../../context/DataProviderContext";
import type { CalendarEvent } from "../../types";

const DATE = "yyyy-MM-dd";
const LOCAL = "yyyy-MM-dd'T'HH:mm";

/** PATCH body for the edited form values; all-day ends are exclusive in the source, inclusive in the form. */
export function buildEventPatch(f: { title: string; allDay: boolean; start: string; end: string; startDay: string; endDay: string; location: string; notes: string }) {
  return {
    title: f.title.trim(),
    allDay: f.allDay,
    start: f.allDay ? f.startDay : new Date(f.start).toISOString(),
    end: f.allDay ? format(addDays(new Date(`${f.endDay}T00:00:00`), 1), DATE) : new Date(f.end).toISOString(),
    location: f.location.trim() || null,
    notes: f.notes.trim() || null,
  };
}

async function readError(res: Response): Promise<string> {
  if (res.status === 412) return "Cet événement a été modifié ailleurs entre-temps. Il vient d'être rechargé : rouvre-le puis recommence.";
  if (res.status === 422) return "Les événements récurrents ne sont pas modifiables ici.";
  const detail = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
  return detail ?? `Le serveur a répondu HTTP ${res.status}.`;
}

/** Edit / delete an event of a source the server can write to (CalDAV). The etag of the last sync guards against overwriting a concurrent change. */
export function EventEditDialog({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const token = useServerStore((s) => s.token);
  const { refresh } = useSourceSync();
  const start = new Date(event.start);
  const [form, setForm] = useState({
    title: event.title,
    allDay: event.allDay,
    start: format(start, LOCAL),
    end: format(new Date(event.end), LOCAL),
    startDay: event.allDay ? event.start.slice(0, 10) : format(start, DATE),
    endDay: event.allDay ? format(subDays(new Date(`${event.end.slice(0, 10)}T00:00:00`), 1), DATE) : format(start, DATE),
    location: event.location ?? "",
    notes: event.notes ?? "",
  });
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(method: "PATCH" | "DELETE", extra: Record<string, unknown>) {
    const res = await fetch("/api/events", {
      method,
      headers: serverHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ connectionId: event.calendarId, id: event.id, etag: event.etag, ...extra }),
    });
    if (!res.ok) {
      if (res.status === 412) void refresh();
      throw new Error(await readError(res));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      await call("PATCH", { patch: buildEventPatch(form) });
      toast.success("Événement modifié");
      void refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("Supprimer cet événement du calendrier ?")) return;
    setBusy("delete");
    setError(null);
    try {
      await call("DELETE", {});
      toast.success("Événement supprimé");
      void refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(null);
    }
  }

  const valid = form.title.trim() !== "" && (form.allDay ? form.startDay !== "" && form.endDay >= form.startDay : form.start !== "" && form.end > form.start);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Modifier l&rsquo;événement</DialogTitle>
            <DialogDescription>Enregistré dans le calendrier source, via le serveur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input aria-label="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
            <label className="flex items-center justify-between text-sm">
              Toute la journée
              <Switch checked={form.allDay} onCheckedChange={(allDay) => setForm({ ...form, allDay })} aria-label="Toute la journée" />
            </label>
            {form.allDay ? (
              <div className="grid grid-cols-2 gap-2">
                <Input aria-label="Premier jour" type="date" value={form.startDay} onChange={(e) => setForm({ ...form, startDay: e.target.value })} />
                <Input aria-label="Dernier jour" type="date" value={form.endDay} onChange={(e) => setForm({ ...form, endDay: e.target.value })} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input aria-label="Début" type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                <Input aria-label="Fin" type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </div>
            )}
            <Input aria-label="Lieu" placeholder="Lieu (facultatif)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <textarea
              aria-label="Notes"
              placeholder="Notes (facultatif)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-border bg-background text-foreground text-sm px-3 py-2"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={busy !== null}>
              {busy === "delete" && <Loader2 className="animate-spin" />} Supprimer
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={!valid || busy !== null}>
                {busy === "save" && <Loader2 className="animate-spin" />} Enregistrer
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
