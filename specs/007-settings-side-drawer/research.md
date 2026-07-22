# Phase 0 Research: Settings Side Drawer

No `NEEDS CLARIFICATION` markers remained in the Technical Context — both open questions were resolved by inspecting the existing codebase rather than external research.

## Decision 1: Use shadcn/ui's actual `Drawer` component (`vaul`), not a hand-rolled Radix Dialog variant

**Superseded**: The first pass of this feature built `src/components/ui/sheet.tsx` on the already-installed `@radix-ui/react-dialog`, reasoning that a side panel is just a repositioned dialog and a new dependency wasn't justified for that alone. The user explicitly requested the real shadcn `Drawer` component and the animation it ships with — a direct, explicit instruction overrides the default no-new-dependency bias. `sheet.tsx` was deleted and replaced with `src/components/ui/drawer.tsx`, the canonical shadcn/ui recipe (fetched from `shadcn-ui/ui` on GitHub) built on `vaul` (^1.1.2), used with `direction="right"` everywhere in this app. `tailwindcss-animate` (^1.0.7) was also added, since the canonical component's overlay fade classes (`animate-in`/`fade-in-0`/etc.) depend on it and this project didn't have the plugin installed.

**Rationale**: `vaul`'s own transition/animation implementation (not just Tailwind classes) is the specific thing that was requested — Radix Dialog alone doesn't reproduce it. Once one popup in the app uses the real Drawer, every other popup should too for visual consistency, which is also why `ui/dialog.tsx` was deleted entirely (see Decision 3).

**Alternatives considered** (from the original pass, now moot): a hand-rolled Radix-Dialog-based "Sheet" — rejected once the user asked for the real component; it could not reproduce vaul's motion.

## Decision 2: Centralize "which panel is open" in `useUIStore`, excluded from persistence

**Decision**: Add a single field to the existing `useUIStore` (`src/store/index.ts`), `activeDrawer: { panel: "connection" | "eventType" | "rules" | "theme" | "preferences" | "shortcuts"; editId?: string } | null`, with `openDrawer(panel, editId?)` and `closeDrawer()` actions. Exclude it from persistence the same way other transient fields already are, via the store's existing `partialize` option.

**Rationale**: Today, "is panel X open" is tracked as independent local `useState` booleans split across `Sidebar.tsx` (connection/type modals) and `RulesPage.tsx` (rules modal), with no shared source of truth. That's precisely why nothing currently prevents two panels from being open at once — there's no shared state to make them mutually exclusive. Centralizing into one field in the store that already holds cross-cutting UI state (`useUIStore` already holds `weekStartsOnMonday`, `use24h`, `dateFormatEU`, etc.) is the smallest change that makes "only one panel open at a time" (FR-005) structurally true, rather than something each component has to remember to enforce. A drawer that reopens on page refresh would be surprising/wrong, so this field must be excluded from persistence — `useUIStore` already uses `partialize` for exactly this kind of split (see `src/store/index.ts:429-433`), so no new mechanism is needed.

**Alternatives considered**:
- New standalone (non-persisted) Zustand store just for drawer state: rejected — an extra file and an extra store for one field is unjustified ceremony; `useUIStore` already is the home for cross-cutting, mostly-persisted UI state, and already knows how to keep a field out of persistence.
- Keep independent local `useState` per component, just swap `Dialog` → `Drawer`: rejected — satisfies FR-001/002/004 (visual/dismissal) but not FR-005 (mutual exclusion), since nothing would stop two independently-controlled panels from being open simultaneously.

## Decision 3: Convert every remaining *settings-adjacent* popup to the same Drawer — but not event content

**Decision**: The `ShortcutsHelp` popover was converted from a `Popover` into a `ShortcutsPanel` — a sixth panel (`"shortcuts"`) in the same `SettingsDrawer`/`activeDrawer` mechanism from Decision 2, rather than its own standalone overlay.

`EventDetail.tsx` (the single-event preview) and `MonthView.tsx`'s day-overflow `EventListModal` (the multi-event selector — shown when multiple events share a day-number link) were *also* converted to `Drawer` in an earlier pass of this decision, per an initial "every popup in the app" instruction — but were then explicitly reverted back to centered `Dialog`s: event-related content stays as popup modals, only the settings surfaces (Preferences, Connections, Event Types, Rules, Theme, Shortcuts) live in the drawer. `ui/dialog.tsx` and `@radix-ui/react-dialog` were restored accordingly.

**Consequence for `RuleModal`**: it's embedded inline in three places — the Rules panel and the connection editor (both inside the `SettingsDrawer`'s real `Drawer`/`vaul` context), and now `EventDetail`'s "create a rule from this event" flow (inside a plain `Dialog`, no `vaul` context at all). It can no longer use `DrawerHeader`/`DrawerTitle` (vaul's `Title` needs a `Drawer.Root` ancestor, which isn't present inside a `Dialog`) — it now renders a plain, primitive-agnostic `<div>`/`<h2>` header styled to match both contexts instead, with `pr-10` reserved since both `Dialog` and `Drawer`'s close (X) button sit in the same top-right spot.

**Rationale**: Direct user instruction, in two steps: first "use the drawer for all popup modal replacements", then a follow-up narrowing that back to "keep all event-related content ... as popup modals" (single-event preview and the multi-event selector) while keeping the settings surfaces in the drawer. `ThemeSelector`'s theme-picker `Popover` was separately left as a `Popover` throughout — it's a small anchored selection menu (pick an existing theme), not a form/detail popup being "replaced"; only the create/edit theme form (`ThemeEditorDialog`) went through the drawer.
