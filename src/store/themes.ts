import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "../types";
import { BUILTIN_THEMES, orderThemes } from "../lib/theme";
import { storage } from "./storage";

// ── Theme Store ────────────────────────────────────────────────────────────────
//
// customThemes is seeded with the two defaults (src/lib/theme.ts BUILTIN_THEMES)
// and holds every theme from then on — all equally editable/renamable/deletable,
// except the store refuses to remove the last remaining theme. See
// specs/005-global-theming/data-model.md.

interface ThemeStore {
  customThemes: Theme[];
  selectedThemeId: string;
  /** Display order for all themes, by id — see lib/theme.ts orderThemes. */
  themeOrder: string[];
  /** "Suivre le système": when set, Providers keeps selectedThemeId on `light` or `dark`
   *  according to the OS color scheme. Cleared by any manual selectTheme. Per device, not synced. */
  systemThemes: { light: string; dark: string } | null;
  /** Draft theme being edited, applied app-wide instead of the selected one (live preview). Never persisted. */
  previewTheme: Theme | null;
  addTheme: (t: Omit<Theme, "id">) => void;
  updateTheme: (t: Theme) => void;
  /** No-ops when `id` is the only remaining theme — at least one theme must always exist. */
  removeTheme: (id: string) => void;
  selectTheme: (id: string) => void;
  setSystemThemes: (v: { light: string; dark: string } | null) => void;
  setPreviewTheme: (t: Theme | null) => void;
  /** Moves `id` to `toIndex` in the display order. */
  reorderTheme: (id: string, toIndex: number) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      customThemes: [...BUILTIN_THEMES],
      selectedThemeId: BUILTIN_THEMES[0].id, // "light"
      themeOrder: BUILTIN_THEMES.map((t) => t.id),
      systemThemes: null,
      previewTheme: null,
      addTheme: (t) =>
        set((s) => {
          const id = crypto.randomUUID();
          return { customThemes: [...s.customThemes, { ...t, id }], themeOrder: [...s.themeOrder, id] };
        }),
      updateTheme: (t) =>
        set((s) => ({ customThemes: s.customThemes.map((x) => (x.id === t.id ? t : x)) })),
      removeTheme: (id) =>
        set((s) => {
          if (s.customThemes.length <= 1) return s;
          const customThemes = s.customThemes.filter((x) => x.id !== id);
          return {
            customThemes,
            themeOrder: s.themeOrder.filter((x) => x !== id),
            selectedThemeId: s.selectedThemeId === id ? customThemes[0].id : s.selectedThemeId,
            systemThemes: s.systemThemes && (s.systemThemes.light === id || s.systemThemes.dark === id) ? null : s.systemThemes,
          };
        }),
      selectTheme: (id) => set({ selectedThemeId: id, systemThemes: null }),
      setSystemThemes: (systemThemes) => set({ systemThemes }),
      setPreviewTheme: (previewTheme) => set({ previewTheme }),
      reorderTheme: (id, toIndex) =>
        set((s) => {
          const ids = orderThemes(s.customThemes, s.themeOrder).map((t) => t.id);
          const idx = ids.indexOf(id);
          if (idx === -1) return s;
          ids.splice(idx, 1);
          ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, id);
          return { themeOrder: ids };
        }),
    }),
    {
      name: "overcal:themes",
      storage,
      partialize: (s) => ({
        customThemes: s.customThemes,
        selectedThemeId: s.selectedThemeId,
        themeOrder: s.themeOrder,
        systemThemes: s.systemThemes,
      }),
    }
  )
);
