import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Connection } from "../types";
import { storage } from "./storage";
import { useRuleStore } from "./rules";

// ── Connection Store ──────────────────────────────────────────────────────────

/**
 * First-run-only seed: gives a fresh install a visible, deletable source
 * instead of silently faking data behind an empty sources list (see
 * the demo provider in multi-source-provider.ts and generateSeedEvents in mock-seed.ts).
 * Only used as useConnectionStore's initial state — same pattern as
 * useRuleStore's seedDemoRules, never re-applied once connections are persisted.
 */
const DEMO_CONNECTION: Connection = { type: "demo", id: "demo", name: "Démo", color: "#6366f1" };

interface ConnectionStore {
  connections: Connection[];
  /** Honors a caller-supplied `id` (e.g. a form that reserved one upfront to link draft rules to it) — mints one otherwise. */
  addConnection: (conn: Omit<Connection, "id"> & { id?: string }) => void;
  removeConnection: (id: string) => void;
  updateConnection: (conn: Connection) => void;
  /** Array order is display order. Moves `id` to `toIndex`. */
  reorderConnection: (id: string, toIndex: number) => void;
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set) => ({
      connections: [DEMO_CONNECTION],
      addConnection: (conn) =>
        set((s) => ({
          connections: [...s.connections, { ...conn, id: conn.id ?? crypto.randomUUID() } as Connection],
        })),
      removeConnection: (id) => {
        set((s) => ({ connections: s.connections.filter((c) => c.id !== id) }));
        useRuleStore.getState().removeRulesForConnection(id);
      },
      updateConnection: (conn) =>
        set((s) => ({ connections: s.connections.map((c) => (c.id === conn.id ? conn : c)) })),
      reorderConnection: (id, toIndex) =>
        set((s) => {
          const idx = s.connections.findIndex((c) => c.id === id);
          if (idx === -1) return s;
          const connections = [...s.connections];
          const [item] = connections.splice(idx, 1);
          connections.splice(Math.max(0, Math.min(toIndex, connections.length)), 0, item);
          return { connections };
        }),
    }),
    {
      name: "overcal:connections",
      storage,
      // Drops connections of a type this version no longer supports (e.g. a leftover
      // "caldav" one) — makeProvider() has no case for them.
      onRehydrateStorage: () => (state) => {
        if (state) state.connections = state.connections.filter((c) => c.type === "webcal" || c.type === "demo");
      },
    }
  )
);
