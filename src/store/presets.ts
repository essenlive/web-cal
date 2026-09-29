import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Preset } from "../types";
import { capturePresetState } from "../lib/presets";
import { storage } from "./storage";
import { useConnectionStore } from "./connections";
import { useEventTypeStore } from "./event-types";
import { useThemeStore } from "./themes";

// ── Preset Store ───────────────────────────────────────────────────────────────

/** Appends " (copie)", then " (copie 2)", " (copie 3)"… until the result doesn't collide (case-insensitively) with any name in `existing` — keeps Preset.name's documented uniqueness invariant on duplicate. */
function uniqueCopyName(base: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  let candidate = `${base} (copie)`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base} (copie ${n})`;
    n += 1;
  }
  return candidate;
}

interface PresetStore {
  presets: Preset[];
  addPreset: (name: string, color: string, description?: string) => void;
  updatePreset: (preset: Preset) => void;
  /** Copies an existing preset's captured connections/eventTypes as-is (not the live app state). */
  duplicatePreset: (id: string) => void;
  removePreset: (id: string) => void;
  applyPreset: (id: string) => void;
  /** Unhides every connection and event type — the "no preset" state (shortcut: 0). */
  clearPreset: () => void;
  /** Array order drives both the sidebar list and the 1-9 keyboard shortcuts. Moves `id` to `toIndex`. */
  reorderPreset: (id: string, toIndex: number) => void;
}

export const usePresetStore = create<PresetStore>()(
  persist(
    (set, get) => ({
      presets: [],
      addPreset: (name, color, description) =>
        set((s) => ({
          presets: [
            ...s.presets,
            {
              id: crypto.randomUUID(),
              name,
              color,
              description,
              ...capturePresetState(
                useConnectionStore.getState().connections,
                useEventTypeStore.getState().types,
                useThemeStore.getState().selectedThemeId
              ),
            },
          ],
        })),
      updatePreset: (preset) =>
        set((s) => ({ presets: s.presets.map((p) => (p.id === preset.id ? preset : p)) })),
      duplicatePreset: (id) =>
        set((s) => {
          const preset = s.presets.find((p) => p.id === id);
          if (!preset) return s;
          const name = uniqueCopyName(preset.name, s.presets.map((p) => p.name));
          return { presets: [...s.presets, { ...preset, id: crypto.randomUUID(), name }] };
        }),
      removePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
      reorderPreset: (id, toIndex) =>
        set((s) => {
          const idx = s.presets.findIndex((p) => p.id === id);
          if (idx === -1) return s;
          const presets = [...s.presets];
          const [item] = presets.splice(idx, 1);
          presets.splice(Math.max(0, Math.min(toIndex, presets.length)), 0, item);
          return { presets };
        }),
      applyPreset: (id) => {
        const preset = get().presets.find((p) => p.id === id);
        if (!preset) return;
        const { connections, updateConnection } = useConnectionStore.getState();
        for (const c of connections) {
          if (c.id in preset.connections) updateConnection({ ...c, hidden: preset.connections[c.id] });
        }
        const { types, updateType } = useEventTypeStore.getState();
        for (const t of types) {
          if (t.id in preset.eventTypes) updateType({ ...t, hidden: preset.eventTypes[t.id] });
        }
        if (preset.themeId) useThemeStore.getState().selectTheme(preset.themeId);
      },
      clearPreset: () => {
        const { connections, updateConnection } = useConnectionStore.getState();
        for (const c of connections) if (c.hidden) updateConnection({ ...c, hidden: false });
        const { types, updateType } = useEventTypeStore.getState();
        for (const t of types) if (t.hidden) updateType({ ...t, hidden: false });
      },
    }),
    { name: "overcal:presets", storage }
  )
);
