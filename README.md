# web-cal

A personal calendar app built with Next.js + TypeScript. Merges events from multiple CalDAV/WebCal connections (or local demo data) into one calendar, with per-event-type visual customisation.

---

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS + Radix UI + lucide-react
- Zustand (persist middleware) — all state is client-side, no backend database
- date-fns

---

## Project structure

```text
src/
  app/                # Next.js App Router — routes only, no logic
    page.tsx           # / — calendar
    settings/page.tsx  # /settings — Préférences only (Sources/Types/Rules live in the sidebar)
    dev/page.tsx       # /dev — component/scenario playground
    api/proxy/route.ts # same-origin CalDAV/WebCal fetch relay
    layout.tsx, providers.tsx, globals.css
  views/              # Route-level components (CalendarPage, SettingsPage, DevPage, RulesPage)
                       # NOT named "pages" — Next.js reserves that directory name
  components/
    calendar/          # CalendarGrid (view switcher), MonthView, TimeGridView, AgendaView
    events/            # EventChip (rendering + style resolution), EventDetail (read-only popup)
    settings/          # AddConnectionModal, EventTypeModal, RuleModal — all edit-in-modal,
                       # each with its own delete (click-to-confirm) button when editing
    sidebar/           # Header (nav + view switcher), Sidebar (mini calendar, sources, types,
                       # rules entry point, theme toggle, settings link)
    ui/                # shadcn/ui "new-york" primitives (button, dialog, input, switch, combobox…)
  context/            # DataProviderContext — wires connections to the active DataProvider
  lib/                # data-provider.ts (interface), mock/webcal/caldav providers,
                       # multi-source-provider.ts (fan-out + merge), rules.ts (matching engine)
  store/              # Zustand stores (ui, connections, event types, rules, events, legacy backend)
  types/              # CalendarEvent, EventType, DisplayStyle, Connection, Rule
```

---

## Event sync

**Provider selection** ([context/DataProviderContext.tsx](src/context/DataProviderContext.tsx)): on every change to the connections list, `DataProviderContext` builds one `DataProvider`:

- **Zero connections** → `MockDataProvider` — seeded demo events, read/write, persisted under a plain `localStorage` key (not Zustand).
- **One or more connections** → `MultiSourceProvider`, which wraps all of them.

Whenever `currentDate` changes (i.e. the visible calendar range moves), an effect calls `provider.getEvents(start, end)` for a `[currentDate − 1 month, currentDate + 2 months]` window and writes the result into `useEventsStore` (in-memory, not persisted — see below).

**Fan-out** ([lib/multi-source-provider.ts](src/lib/multi-source-provider.ts)): `MultiSourceProvider.getEvents()` calls every connection's own provider (`WebCalProvider` or `CalDAVProvider`) in parallel via `Promise.allSettled`, so one broken connection never blocks the others. Per-connection status (`unchecked` / `loading` / `active` / `error`) is reported through a callback into `DataProviderContext`'s local state, exposed to the UI via `useConnectionStatusMap()` — this status is never persisted, it's rebuilt on every fetch. All connections are **read-only**; `createEvent`/`updateEvent`/`deleteEvent` throw.

`eventTypeId` on a fetched event is ingestion metadata only (currently always `"meeting"`) — actual display styling is resolved exclusively through the [rules engine](#display-rules), never read directly off the event. Event IDs are namespaced to avoid collisions across sources: CalDAV UIDs become `"${conn.id}::${uid}"`; WebCal IDs are already namespaced by `WebCalProvider` itself.

**CORS / the proxy route** — CalDAV servers and most `.ics` hosts don't send CORS headers, so the browser can't fetch them directly. Both providers default to routing requests through the app's own [`/api/proxy`](src/app/api/proxy/route.ts) same-origin relay unless a `Connection.proxyUrl` (an external CORS proxy, e.g. `corsproxy.io`) is explicitly configured, in which case that takes priority:

- `WebCalProvider` (GET-only, `.ics` text) hits `GET /api/proxy?url=<encoded target>`.
- `CalDAVProvider` needs WebDAV verbs (`PROPFIND` to discover calendars, `REPORT` for the calendar-query event fetch, plus `PUT`/`DELETE`) that Next.js route handlers can't dispatch on directly — only `GET/POST/PUT/...` exports are recognized. So it tunnels: `POST /api/proxy` with a JSON envelope `{ method, url, headers, body }`, and the route re-issues that exact request server-side.
- The route rejects targets on `localhost`, private/link-local IP ranges, and the cloud metadata IP (`169.254.169.254`) to stop it being used as an SSRF pivot into internal infrastructure. It does **not** resolve hostnames before checking (a DNS name that resolves to a private IP at request time would slip through) or restrict which public host it will fetch.

---

## Persistence (localStorage)

Everything lives in the browser. There is no server-side database — the Next.js API route is a stateless relay, not storage.

| Zustand store | localStorage key | Persisted? | Notes |
| --- | --- | --- | --- |
| `useConnectionStore` | `webcal:connections` | Yes, in full | CalDAV passwords are stored **in plaintext** in this key ([types/index.ts:101](src/types/index.ts#L101)) — there's no encryption layer. On first load it migrates any legacy `webcal:backend` config into a connection, then deletes that old key. Removing a connection also deletes any `source`-type rules that targeted it. |
| `useEventTypeStore` | `proton-cal:event-types` | Yes, in full | Runs `migrateType()` on rehydrate to upgrade older `EventType` shapes (e.g. old `style`/`styles` fields → `allDayStyle`/`timedStyle`). A type can't be deleted while the catch-all rule targets it — reassign that rule first. |
| `useRuleStore` | `webcal:rules` | Yes, in full | Ordered list of `Rule`s; array order is match priority. Always contains exactly one `matchType: "all"` catch-all rule, seeded on first load and re-seeded on rehydrate if missing. |
| `useUIStore` | `proton-cal:ui` | Partial (`partialize`) | Only `view`, `darkMode`, `weekStartsOnMonday`, `use24h`, `dateFormatEU` are persisted. `currentDate` and `sidebarOpen` reset every load. |
| `useBackendStore` | `webcal:backend` | Yes | **Deprecated** — kept only so `useConnectionStore`'s one-time migration has something to read, then it's deleted. |
| `useEventsStore` | — | **No** | Events are never persisted directly; they're always refetched from the active `DataProvider` on load and on date-range change. |
| `MockDataProvider` | `proton-cal:events` | Yes, in full | Separate from Zustand — a plain `localStorage.getItem/setItem` pair ([lib/mock-data-provider.ts](src/lib/mock-data-provider.ts)), since the demo backend needs read/write without going through a persisted store. |

**SSR guard:** Next.js server-renders "use client" components once to produce the initial HTML, where no `localStorage`/`window` exists. All persist configs share one `storage` wrapper ([store/index.ts](src/store/index.ts)) that returns a no-op storage when `typeof window === "undefined"`, and `MockDataProvider` checks the same condition directly — without these guards, `next build`'s prerender step crashes.

---

## Display types

An `EventType` ([types/index.ts](src/types/index.ts)) defines a **color**, **icon**, and two independent `DisplayStyle`s — one for all-day events (`allDayStyle`), one for timed events (`timedStyle`):

| Style | Rendering |
| --- | --- |
| `block` | Full-width filled chip with icon + title (classic) |
| `avatar-tl` / `avatar-bl` / `avatar-br` | Small circular icon badge, pinned to a corner of the day cell |
| `day` | Tints the whole day cell's background/border; `EventChip` itself renders nothing — the parent view (`MonthView`/`TimeGridView`) reads the resolved style separately to paint the cell |

Types are managed from the sidebar's **Types** section (`EventTypeModal`), not the Settings page. Editing an existing type opens the same modal with a delete (click-to-confirm) button; deletion is blocked while the catch-all rule targets that type.

---

## Display rules

Which `EventType` an event renders with is resolved entirely by an ordered list of `Rule`s ([types/index.ts](src/types/index.ts), [lib/rules.ts](src/lib/rules.ts)), not by anything on the event itself — `eventTypeId` on a `CalendarEvent` is ingestion metadata only, never read for display.

A `Rule` matches by:

| `matchType` | `matchValue` is… |
| --- | --- |
| `event` | a specific `CalendarEvent.id` |
| `name` | a text/regex pattern tested against the event title |
| `source` | a `Connection.id` |
| `all` | unused — the catch-all rule, matches every event |

**Resolution** ([components/events/EventChip.tsx:`resolveEventType`](src/components/events/EventChip.tsx) → [lib/rules.ts:`findMatchingRule`](src/lib/rules.ts)): rules are walked in array order (array order **is** priority), skipping any that are disabled or whose target type no longer exists; the first match wins. Exactly one catch-all (`matchType: "all"`) rule always exists — `useRuleStore` seeds one on first load and re-seeds it on rehydrate if missing — so there is always a fallback match. It can't be deleted, disabled, or reordered, and only its target display type can be changed.

New rules are inserted at the top of their own tier (event > name > source > catch-all), newest-first within a tier, via `tierOf()` in [store/index.ts](src/store/index.ts). Rules can also be reordered by hand (drag, or the up/down buttons) within the non-catch-all block, and dragging/removing a connection cleans up any `source` rules that pointed at it.

Rules are managed from **Règles d'affichage**, a modal opened from the sidebar (beneath the Types list) rather than a page — `RulesModal` in [views/RulesPage.tsx](src/views/RulesPage.tsx). Shortcuts into rule creation exist from the event detail popup ("by title" / "just this event") and from a connection's edit modal ("Create a rule for this source").

---

## Settings

- **Data Sources** — managed from the sidebar's **Sources** section: add/edit CalDAV or WebCal connections (`AddConnectionModal`), see live per-connection status. Editing shows a delete button (click-to-confirm) and a shortcut to create a source-matching rule.
- **Types d'événements** — managed from the sidebar's **Types** section, see [Display types](#display-types) above.
- **Règles d'affichage** — managed from the sidebar, see [Display rules](#display-rules) above.
- **Thème / Paramètres** — dark-mode toggle and the link to `/settings` now live at the bottom of the sidebar, not the top header.
- `/settings` page itself now holds only **Préférences** — week start (Monday/Sunday), 24h clock, date format (DD/MM/YYYY or MM/DD/YYYY).

---

## Development

```bash
npm install
npm run dev     # next dev --turbopack
npm run build   # next build (ESLint gate disabled — see next.config.ts; run `npm run lint` separately)
npm run start   # serve the production build
npm run lint
```

Unscheduled feature ideas live in [TODO.md](TODO.md).
