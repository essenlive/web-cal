"use client";

import { useState } from "react";
import { addDays, addHours, format } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { useConnectionStore } from "../../store";
import { useBackend } from "../../lib/backend";
import { useSourceSync } from "../../context/DataProviderContext";

interface WritableConnection {
  id: string;
  name: string;
}

const DATE = "yyyy-MM-dd";

/** Body of the POST /api/events request for the form values — dates are sent as ISO, all-day as plain dates (end exclusive). */
export function buildNewEventPayload(f: { title: string; allDay: boolean; start: string; end: string; day: string; location: string }) {
  const start = f.allDay ? f.day : new Date(f.start).toISOString();
  const end = f.allDay ? format(addDays(new Date(`${f.day}T00:00:00`), 1), DATE) : new Date(f.end).toISOString();
  return { title: f.title.trim(), start, end, allDay: f.allDay, ...(f.location.trim() ? { location: f.location.trim() } : {}) };
}

/** "+" button in the header: creates an event on a connection the server can write to. Only shown once linked to the server. */
export function NewEventButton() {
  const backend = useBackend();
  const connections = useConnectionStore((s) => s.connections);
  const { refresh } = useSourceSync();
  const [open, setOpen] = useState(false);
  const [writable, setWritable] = useState<WritableConnection[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const [form, setForm] = useState({
    title: "",
    connectionId: "",
    allDay: false,
    day: format(now, DATE),
    start: format(addHours(now, 1), "yyyy-MM-dd'T'HH:00"),
    end: format(addHours(now, 2), "yyyy-MM-dd'T'HH:00"),
    location: "",
  });

  if (!backend) return null;

  async function openDialog() {
    setOpen(true);
    setError(null);
    try {
      const now = new Date();
      const entries = await backend!.events(now, now);
      const list = connections.filter((c) => entries[c.id]?.writable).map((c) => ({ id: c.id, name: c.name }));
      setWritable(list);
      setForm((f) => ({ ...f, connectionId: f.connectionId || list[0]?.id || "" }));
    } catch (err) {
      setWritable([]);
      setError(err instanceof Error ? err.message : "Serveur injoignable.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await backend!.createEvent(form.connectionId, buildNewEventPayload(form));
      toast.success("Événement créé");
      setOpen(false);
      setForm((f) => ({ ...f, title: "", location: "" }));
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  const valid = form.title.trim() !== "" && form.connectionId !== "" && (form.allDay ? form.day !== "" : form.start !== "" && form.end > form.start);

  return (
    <>
      <Button variant="ghost" size="icon" onClick={openDialog} className="text-muted-foreground" aria-label="Nouvel événement">
        <Plus size={18} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nouvel événement</DialogTitle>
              <DialogDescription>Créé sur le serveur, dans le calendrier choisi.</DialogDescription>
            </DialogHeader>

            {writable === null && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Chargement…</p>}
            {writable?.length === 0 && !error && (
              <p className="text-sm text-muted-foreground">Aucune source inscriptible sur ce serveur : attache un point CalDAV à une connexion lors de l&rsquo;import.</p>
            )}

            {writable && writable.length > 0 && (
              <div className="space-y-3">
                <Input aria-label="Titre" placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
                <select
                  aria-label="Calendrier"
                  value={form.connectionId}
                  onChange={(e) => setForm({ ...form, connectionId: e.target.value })}
                  className="w-full rounded-md border border-border bg-background text-foreground text-sm px-3 py-2"
                >
                  {writable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label className="flex items-center justify-between text-sm">
                  Toute la journée
                  <Switch checked={form.allDay} onCheckedChange={(allDay) => setForm({ ...form, allDay })} aria-label="Toute la journée" />
                </label>
                {form.allDay ? (
                  <Input aria-label="Jour" type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input aria-label="Début" type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                    <Input aria-label="Fin" type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                  </div>
                )}
                <Input aria-label="Lieu" placeholder="Lieu (facultatif)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={!valid || saving}>
                {saving && <Loader2 className="animate-spin" />} Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
