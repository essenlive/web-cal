# Architecture

Deep-dive reference for how web-cal is built. For a quick start, see [README.md](../README.md). Each section below links back to the spec that introduced it under [`specs/`](../specs).

---

## Project structure

```text
src/
  app/                # Next.js App Router — routes only, no logic
    page.tsx           # / — calendar
    settings/page.tsx  # /settings — Préférences only (Sources/Types/Rules/Theme live in the sidebar)
    dev/page.tsx       # /dev — component/scenario playground
    api/proxy/route.ts # same-origin CalDAV/WebCal fetch relay
    layout.tsx, providers.tsx, globals.css
  views/              # Route-level components (CalendarPage, SettingsPage, DevPage, RulesPage)
                       # NOT named "pages" — Next.js reserves that directory name
  components/
    calendar/          # CalendarGrid (view switcher), MonthView, TimeGridView, AgendaView
    events/            # EventChip (rendering + style/visibility resolution), EventDetail (read-only popup)
    settings/          # AddConnectionModal, EventTypeModal, RuleModal — all edit-in-modal,
                       # each with its own delete (click-to-confirm) button when editing
    sidebar/           # Header, Sidebar (mini calendar, sources, types, rules entry point,
                       # theme selector, settings link), ThemeSelector, ThemeEditorDialog
    ui/                # shadcn/ui "new-york" primitives (button, dialog, input, switch, combobox…)
  context/            # DataProviderContext — wires connections to the active DataProvider
  lib/                # data-provider.ts (interface), mock/webcal/caldav providers,
                       # multi-source-provider.ts (fan-out + merge), rules.ts (matching engine),
                       # theme.ts (hex/HSL + CSS var resolution)
  store/              # Zustand stores (ui, connections, event types, rules, events, themes, legacy backend)
  types/              # CalendarEvent, EventType, DisplayStyle, Connection, Rule, Theme
```

## Building blocks

| Building block | Spec | Summary |
| --- | --- | --- |
| [Event sync](#event-sync) | [001-cloud-calendar-connector](../specs/001-cloud-calendar-connector/spec.md) | Fan out to CalDAV/WebCal connections (or a local mock), merge into one event stream. |
| [Display types](#display-types) | [002-custom-display-types](../specs/002-custom-display-types/spec.md) | User-defined color/icon/style presets. |
| [Display rules engine](#display-rules-engine) | [003-display-type-rules-engine](../specs/003-display-type-rules-engine/spec.md) | Ordered rules resolve which display type an event renders with. |
| [Quick hide](#quick-hide) | [004-quick-hide](../specs/004-quick-hide/spec.md) | Toggle visibility of a source or type without deleting it. |
| [Global theming](#global-theming) | [005-global-theming](../specs/005-global-theming/spec.md) | Named themes (base mode + accent color) replace the old light/dark toggle. |

---

## Event sync

**Provider selection** ([context/DataProviderContext.tsx](../src/context/DataProviderContext.tsx)): on every change to the connections list, `DataProviderContext` builds one `DataProvider`:

- **Zero connections** → `MockDataProvider` — seeded demo events, read/write, persisted under a plain `localStorage` key (not Zustand).
- **One or more connections** → `MultiSourceProvider`, which wraps all of them.

Whenever `currentDate` changes (i.e. the visible calendar range moves), an effect calls `provider.getEvents(start, end)` for a `[currentDate − 1 month, currentDate + 2 months]` window and writes the result into `useEventsStore` (in-memory, not persisted — see [Persistence](#persistence-localstorage)).

**Fan-out** ([lib/multi-source-provider.ts](../src/lib/multi-source-provider.ts)): `MultiSourceProvider.getEvents()` calls every connection's own provider (`WebCalProvider` or `CalDAVProvider`) in parallel via `Promise.allSettled`, so one broken connection never blocks the others. Per-connection status (`unchecked` / `loading` / `active` / `error`) is reported through a callback into `DataProviderContext`'s local state, exposed to the UI via `useConnectionStatusMap()` — this status is never persisted, it's rebuilt on every fetch. All connections are **read-only**; `createEvent`/`updateEvent`/`deleteEvent` throw.

`eventTypeId` on a fetched event is ingestion metadata only (currently always `"meeting"`) — actual display styling is resolved exclusively through the [rules engine](#display-rules-engine), never read directly off the event. Event IDs are namespaced to avoid collisions across sources: CalDAV UIDs become `"${conn.id}::${uid}"`; WebCal IDs are already namespaced by `WebCalProvider` itself.

**CORS / the proxy route** — CalDAV servers and most `.ics` hosts don't send CORS headers, so the browser can't fetch them directly. Both providers default to routing requests through the app's own [`/api/proxy`](../src/app/api/proxy/route.ts) same-origin relay unless a `Connection.proxyUrl` (an external CORS proxy, e.g. `corsproxy.io`) is explicitly configured, in which case that takes priority:

- `WebCalProvider` (GET-only, `.ics` text) hits `GET /api/proxy?url=<encoded target>`.
- `CalDAVProvider` needs WebDAV verbs (`PROPFIND` to discover calendars, `REPORT` for the calendar-query event fetch, plus `PUT`/`DELETE`) that Next.js route handlers can't dispatch on directly — only `GET/POST/PUT/...` exports are recognized. So it tunnels: `POST /api/proxy` with a JSON envelope `{ method, url, headers, body }`, and the route re-issues that exact request server-side.
- The route rejects targets on `localhost`, private/link-local IP ranges, and the cloud metadata IP (`169.254.169.254`) to stop it being used as an SSRF pivot into internal infrastructure. It does **not** resolve hostnames before checking (a DNS name that resolves to a private IP at request time would slip through) or restrict which public host it will fetch.

---

## Display types

An `EventType` ([types/index.ts](../src/types/index.ts)) defines a **color**, **icon**, and two independent `DisplayStyle`s — one for all-day events (`allDayStyle`), one for timed events (`timedStyle`):

| Style | Rendering |
| --- | --- |
| `block` | Full-width filled chip with icon + title (classic) |
| `avatar-tl` / `avatar-bl` / `avatar-br` | Small circular icon badge, pinned to a corner of the day cell |
| `day` | Tints the whole day cell's background/border; `EventChip` itself renders nothing — the parent view (`MonthView`/`TimeGridView`) reads the resolved style separately to paint the cell |

Exactly one type has `isDefault: true` at all times — it's the fallback used when no rule matches (see below) and can't be deleted until another type is made default first ([store/index.ts](../src/store/index.ts) `useEventTypeStore`).

Types are managed from the sidebar's **Types** section (`EventTypeModal`), not the Settings page. Editing an existing type shows which rules currently resolve to it ("Règles liées") and a delete (click-to-confirm) button, disabled while it's the default type.

---

## Display rules engine

Which `EventType` an event renders with is resolved entirely by an ordered list of `Rule`s ([types/index.ts](../src/types/index.ts), [lib/rules.ts](../src/lib/rules.ts)), not by anything on the event itself — `eventTypeId` on a `CalendarEvent` is ingestion metadata only, never read for display.

A `Rule` matches by:

| `matchType` | `matchValue` is… |
| --- | --- |
| `event` | a specific `CalendarEvent.id` |
| `name` | a text/regex pattern tested against the event title |
| `source` | a `Connection.id` |
| `all` | unused — the catch-all rule, matches every event |

**Resolution** ([components/events/EventChip.tsx:`resolveEventType`](../src/components/events/EventChip.tsx) → [lib/rules.ts:`findMatchingRule`](../src/lib/rules.ts)): rules are walked in array order (array order **is** priority), skipping any that are disabled; the first match wins. The catch-all rule always matches — `useRuleStore` seeds one on first load and re-seeds it on rehydrate if missing — so there is always a fallback. Resolving to the catch-all rule, or to any other rule whose target type has since been deleted (a "broken" rule), both fall back to the current **default `EventType`** (`useEventTypeStore.getDefaultType()`), not to a fixed `displayTypeId` on the rule itself. The catch-all rule can't be deleted, disabled, reordered, or retargeted — change which type it resolves to by making a different type the default instead.

New rules are inserted at the top of their own tier (event > name > source > catch-all), newest-first within a tier, via `tierOf()` in [store/index.ts](../src/store/index.ts). Rules can also be reordered by hand (drag, or the up/down buttons) within the non-catch-all block, and dragging/removing a connection cleans up any `source` rules that pointed at it.

Rules are managed from **Règles d'affichage**, a modal opened from the sidebar (beneath the Types list) rather than a page — `RulesModal` in [views/RulesPage.tsx](../src/views/RulesPage.tsx). Shortcuts into rule creation exist from the event detail popup ("by title" / "just this event") and from a connection's edit modal ("Create a rule for this source").

---

## Quick hide

Both `Connection` and `EventType` carry an optional `hidden` boolean ([types/index.ts](../src/types/index.ts)). Toggling it (the eye icon next to each row in the sidebar's Sources/Types lists) never deletes or alters the underlying configuration — it's a pure display-time filter, and the item stays fully selectable everywhere else (pickers, rule targets, connection edit).

**Filtering** ([components/events/EventChip.tsx:`isEventHidden`](../src/components/events/EventChip.tsx)): an event is excluded from every calendar view (`MonthView`, `TimeGridView`, `AgendaView`) if its source connection is hidden, *or* if the `EventType` it resolves to via the [rules engine](#display-rules-engine) is hidden — including indirect matches through the catch-all/default-type fallback. All three views call `isEventHidden` when building their filtered event list, so there's a single source of truth for "should this render."

Hiding every source and every type at once is allowed unconditionally (no confirmation) — it's instantly reversible and the calendar's existing empty state covers it.

---

## Global theming

A `Theme` ([types/index.ts](../src/types/index.ts)) is a name + base `mode` (`light`/`dark`) + a single accent hex color. Two built-ins (`"light"`, `"dark"`, [lib/theme.ts](../src/lib/theme.ts) `BUILTIN_THEMES`) are never persisted, editable, or deletable; user-created themes live in `useThemeStore.customThemes` ([store/index.ts](../src/store/index.ts)).

**Applying a theme** ([app/providers.tsx](../src/app/providers.tsx)): on mount and whenever the selection changes, an effect toggles the `.dark` class on `<html>` per the theme's `mode`, then calls `resolveThemeCssVars()` to override `--primary`/`--primary-foreground`/`--accent`/`--accent-foreground`/`--ring` (defined in [globals.css](../src/app/globals.css)). Only hue+saturation come from the picked accent; lightness stays fixed per mode at the app's existing hand-tuned values, so custom accents don't wreck contrast.

**Migration**: existing users had a `darkMode: boolean` under `proton-cal:ui`. On first load after upgrade, if no theme selection exists yet, `useThemeStore` reads that legacy value once (read-only — `useUIStore`/`proton-cal:ui` are left untouched) and maps `true → "dark"`, `false/absent → "light"`.

Managed via `ThemeSelector` ([components/sidebar/ThemeSelector.tsx](../src/components/sidebar/ThemeSelector.tsx)), a popover in the sidebar footer listing every theme with inline create/edit (`ThemeEditorDialog`); built-ins can be selected but not edited or deleted.

---

## Persistence (localStorage)

Everything lives in the browser. There is no server-side database — the Next.js API route is a stateless relay, not storage.

| Zustand store | localStorage key | Persisted? | Notes |
| --- | --- | --- | --- |
| `useConnectionStore` | `webcal:connections` | Yes, in full | CalDAV passwords are stored **in plaintext** in this key ([types/index.ts](../src/types/index.ts)) — there's no encryption layer. On first load it migrates any legacy `webcal:backend` config into a connection, then deletes that old key. Removing a connection also deletes any `source`-type rules that targeted it. A `hidden` flag (see [Quick hide](#quick-hide)) lives on each connection. |
| `useEventTypeStore` | `proton-cal:event-types` | Yes, in full | Runs `migrateType()` on rehydrate to upgrade older `EventType` shapes, and ensures exactly one type has `isDefault: true` (migrating from the old "catch-all rule's target" convention if needed). A type can't be deleted while it's the default — make another type default first. A `hidden` flag lives on each type. |
| `useRuleStore` | `webcal:rules` | Yes, in full | Ordered list of `Rule`s; array order is match priority. Always contains exactly one `matchType: "all"` catch-all rule, seeded on first load and re-seeded on rehydrate if missing. |
| `useThemeStore` | `proton-cal:themes` | Yes, in full (`partialize`) | `customThemes`, `selectedThemeId`, and a one-time migration guard. Built-in themes are never stored here. |
| `useUIStore` | `proton-cal:ui` | Partial (`partialize`) | Only `view`, `weekStartsOnMonday`, `use24h`, `dateFormatEU` are persisted. `currentDate` and `sidebarOpen` reset every load. The legacy `darkMode` field is gone from this store — it's superseded by `useThemeStore`, and is only ever read once, raw, for the migration above. |
| `useBackendStore` | `webcal:backend` | Yes | **Deprecated** — kept only so `useConnectionStore`'s one-time migration has something to read, then it's deleted. |
| `useEventsStore` | — | **No** | Events are never persisted directly; they're always refetched from the active `DataProvider` on load and on date-range change. |
| `MockDataProvider` | `proton-cal:events` | Yes, in full | Separate from Zustand — a plain `localStorage.getItem/setItem` pair ([lib/mock-data-provider.ts](../src/lib/mock-data-provider.ts)), since the demo backend needs read/write without going through a persisted store. |

**SSR guard:** Next.js server-renders "use client" components once to produce the initial HTML, where no `localStorage`/`window` exists. All persist configs share one `storage` wrapper ([store/index.ts](../src/store/index.ts)) that returns a no-op storage when `typeof window === "undefined"`, and `MockDataProvider` checks the same condition directly — without these guards, `next build`'s prerender step crashes.

---

## Settings map

- **Data Sources** — sidebar **Sources** section: add ICS/WebCal connections, edit any existing connection including legacy CalDAV ones (`AddConnectionModal`), see live per-connection status, hide/show, delete, shortcut to create a source-matching rule. CalDAV is no longer offered for new connections — see [types/index.ts](../src/types/index.ts) `CalDAVConnection` — but `CalDAVProvider` keeps serving any already-persisted one.
- **Types d'événements** — sidebar **Types** section, see [Display types](#display-types).
- **Règles d'affichage** — sidebar modal, see [Display rules engine](#display-rules-engine).
- **Thème** — `ThemeSelector` popover in the sidebar footer, see [Global theming](#global-theming).
- **`/settings` page** — holds only **Préférences**: week start (Monday/Sunday), 24h clock, date format (DD/MM/YYYY or MM/DD/YYYY).
