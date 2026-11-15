# Architecture

Deep-dive reference for how web-cal is built. For a quick start, see [README.md](../README.md). Each section below links back to the spec that introduced it under [`specs/`](../specs).

---

## Project structure

```text
src/
  app/                # Next.js App Router — routes only, no logic
    page.tsx           # / — calendar
    data/ stats/ debug/  # /data (export, import, AI settings, sync, reset), /stats, /debug
    settings/page.tsx  # /settings — kept as a bookmark: opens the Préférences drawer
    api/proxy/route.ts # same-origin WebCal (.ics) fetch relay
    layout.tsx, providers.tsx, globals.css
  views/              # Route-level components (CalendarPage, DataPage, StatsPage, DebugPage)
                       # NOT named "pages" — Next.js reserves that directory name
  components/
    calendar/          # CalendarGrid (view switcher), MonthView, TimeGridView, AgendaView, DayCell
    events/            # EventChip (rendering + style/visibility resolution), EventDetail, EventSearch
    settings/          # SettingsDrawer (shared shell) and everything it shows: one *Panel per
                       # section (list) + one *Form per item (edit), PanelHeader/PanelFooter,
                       # RuleEditRow, SettingRow, PatternPicker, HelpPanel, GettingStarted
    sidebar/           # Header, Sidebar (mini calendar + uniform collapsible Sections),
                       # PresetSelector, SyncIndicator (+ sync dialog)
    data/ debug/       # tabs of /data and /debug
    ui/                # shadcn/ui primitives (button, dialog, drawer, input, switch, popover…)
  context/            # DataProviderContext — event cache, per-connection sync, status
  hooks/              # useResolvedEvents, useDragReorder, stats hooks…
  lib/                # data-provider.ts (interface), webcal-provider.ts, multi-source-provider.ts
                       # (per-connection fetch), event-cache*.ts, rules.ts (matching engine),
                       # theme.ts, connection-status.ts, url-state.ts, onboarding.ts, ai-*.ts, sync/
  store/              # Zustand stores, one file each (connections, event-types, rules, presets,
                       # ui, themes, onboarding, events) + index.ts (re-exports, sync clock)
  types/              # CalendarEvent, EventType, DisplayStyle, Connection, Rule, Theme
```

## Building blocks

| Building block | Spec | Summary |
| --- | --- | --- |
| [Event sync](#event-sync) | [001-cloud-calendar-connector](../specs/001-cloud-calendar-connector/spec.md) | Fetch every WebCal connection (and the local demo source) independently, merge into one event stream. |
| [Display types](#display-types) | [002-custom-display-types](../specs/002-custom-display-types/spec.md) | User-defined color/icon/style presets. |
| [Display rules engine](#display-rules-engine) | [003-display-type-rules-engine](../specs/003-display-type-rules-engine/spec.md) | Ordered rules resolve which display type an event renders with. |
| [Quick hide](#quick-hide) | [004-quick-hide](../specs/004-quick-hide/spec.md) | Toggle visibility of a source or type without deleting it. |
| [Global theming](#global-theming) | [005-global-theming](../specs/005-global-theming/spec.md) | Named themes (base mode + accent color) replace the old light/dark toggle. |
| Presets | [006-view-presets](../specs/006-view-presets/spec.md) | Saved combinations of source/type visibility, switchable from the sidebar. |
| [Settings map](#settings-map) | [007-settings-side-drawer](../specs/007-settings-side-drawer/spec.md) | Every settings surface (Sources/Types/Règles/Thème/Réglages) shares one side drawer. |
| [Event caching & sync feedback](#event-caching--sync-feedback) | [008-events-perf-caching](../specs/008-events-perf-caching/spec.md) | Session-only range cache with delta fetching and stale-while-revalidate, memoized rules resolution, and a global sync-state indicator. |

---

## Event sync

**Connections** ([store/connections.ts](../src/store/connections.ts)): every source is a `WebCalConnection` (an `.ics` / `webcal://` URL) except the seeded `DEMO_CONNECTION` (`type: "demo"`), a normal, visible, deletable connection whose events come from `generateSeedEvents()` ([lib/mock-seed.ts](../src/lib/mock-seed.ts)) via a local, offline `demoProvider`. On rehydrate, any persisted connection of an unsupported type (e.g. a leftover CalDAV one — CalDAV support was removed) is dropped.

**Per-connection fetch** ([lib/multi-source-provider.ts](../src/lib/multi-source-provider.ts)): `fetchConnectionEvents()` builds the connection's provider (`makeProvider()`: `WebCalProvider` or the demo provider) and returns a `FetchResult` — the events, or the failure info (message, 429 `Retry-After`) that drives smart-retry backoff — reporting `loading` / `active` / `error` status through a callback. `DataProviderContext` calls it once per connection from its `syncConnection` cycle (see [Event caching & sync feedback](#event-caching--sync-feedback)), so one broken connection never blocks the others. Status is exposed via `useConnectionStatusMap()` and never persisted. All connections are **read-only**; `DataProvider` has no create/update/delete methods.

`eventTypeId` on a fetched event is ingestion metadata only — actual display styling is resolved exclusively through the [rules engine](#display-rules-engine), never read directly off the event. WebCal event ids are namespaced `"${conn.id}::${uid}"` by `WebCalProvider` itself, so they can't collide across sources.

**CORS / the proxy route** — most `.ics` hosts don't send CORS headers, so the browser can't fetch them directly. `WebCalProvider` goes through the app's own [`/api/proxy`](../src/app/api/proxy/route.ts) same-origin relay (`GET /api/proxy?url=<encoded target>`) unless a `Connection.proxyUrl` (an external CORS proxy, e.g. `corsproxy.io`) is configured, in which case that takes priority. The route is GET-only; it rejects targets on `localhost`, private/link-local IP ranges, and the cloud metadata IP (`169.254.169.254`) to stop it being used as an SSRF pivot. It does **not** resolve hostnames before checking (a DNS name that resolves to a private IP at request time would slip through) or restrict which public host it will fetch.

---

## Event caching & sync feedback

A per-connection **range cache** (`src/lib/event-cache.ts`, driven from [`DataProviderContext.tsx`](../src/context/DataProviderContext.tsx)) sits in front of every fetch: each connection's `ConnectionCacheEntry` tracks which date ranges it has already fetched (`coveredRanges`), its events for those ranges, and when it was last fetched. On every navigation, only the **uncovered delta** of the requested window is actually fetched — a range that's already covered is served from the cache instantly, with no network request. A connection whose cache is covered but has gone stale (5-minute TTL, `STALE_TTL_MS`) is refreshed **in the background** (stale-while-revalidate): the currently-shown events are never cleared while that refresh is in flight. A per-connection sequence number (`fetchSeq`) discards any fetch result that's been superseded by a newer one (e.g. rapid navigation, or a connection edit invalidating the cache mid-fetch) rather than letting a stale result overwrite fresher data, and an in-flight-fetch map ensures at most one request per connection is ever outstanding at a time — a second caller (navigation, staleness, or the manual refresh button) joins the existing in-flight fetch instead of duplicating it.

All of the above lives in one extracted unit, **`syncConnection(conn, requested, forced)`** — the per-connection sync cycle both `loadWindow` (navigation/manual refresh) and the automatic-retry timer (below) call. Critically, each connection publishes to `useEventsStore` **the moment its own fetch resolves**, independent of every other connection — a fast source's events are never held back behind a slow or backed-off one. (`loadWindow` still does one final flatten-and-publish after every connection's `syncConnection` call settles, as a safety net for the zero-connections case.)

**Persistence** (`src/lib/event-cache-persistence.ts`): the cache survives a full page reload. Each connection's entry is clamped to a window centered on real "now" (`clampEntryToWindow`, `src/lib/event-cache.ts`) and debounce-written to `localStorage["overcal:event-cache"]` (~500ms after the last publish settles, plus an immediate flush on `pagehide`) — bounded so a long session's unbounded in-memory growth doesn't get persisted wholesale, and non-fatal on quota/serialization failure. On boot, `cacheRef` is seeded from this snapshot before the first `loadWindow` call, which then finds "covered but stale" entries — exactly the existing stale-while-revalidate branch above, not a new code path: publish immediately, refetch quietly. Net effect: a warm reload renders last-known events before any network request completes, and `CalendarSkeleton` rarely shows past the very first-ever load.

The cache is keyed by `computeFetchKey(connection)` — a hash of every field that affects what gets fetched (`id`, `type`, `url`, `proxyUrl`, — **not** just the connection's `id`. `DataProviderContext`'s provider-recreation key uses the same hash, so editing a connection's URL or proxy correctly re-instantiates its provider and invalidates its cache entry — that's the *only* thing that resets an entry to empty (the old data belongs to a different source at that point, so a brief empty state while refetching is correct, not a bug). Manually clicking refresh (`useSourceSync().refresh`) forces a full re-fetch of every connection regardless of staleness *and* regardless of retry backoff (see below), but does **not** reset anything first: `syncConnection` just treats the whole requested window as one gap to fetch, and `mergeFetchedRange` swaps the fresh result in atomically on arrival — exactly like the passive staleness path, so a forced refresh never blanks what's already on screen while it's in flight.

Every navigation/refresh/automatic-retry fetches a window wider than the single visible month — `windowAround()`, sized by the user-set `useUIStore.cacheMonths` (default −2/+3, picked in the sync dialog, persisted per device) — so a normal amount of navigation in either direction stays served from cache instead of hitting a genuine gap and showing an empty grid while it loads. The same span sizes the disk-persistence window (`computePersistWindow`, below).

**Smart retry** (`src/lib/event-cache.ts` `applyBackoff`/`isBackedOff`, `src/lib/data-provider.ts` `HttpError`): a connection whose fetch fails schedules its own cooldown on `ConnectionCacheEntry.nextRetryAt` — the server's own `Retry-After` header when the failure was a 429/503 (parsed by `parseRetryAfterMs`, forwarded by [`/api/proxy`](../src/app/api/proxy/route.ts)), otherwise a doubling backoff starting at `BASE_BACKOFF_MS` (30s) up to `MAX_BACKOFF_MS` (10min), reset to the floor on the next success. An unforced `syncConnection` call (navigation, staleness) skips a backed-off connection entirely rather than retrying it every tick; an explicit manual refresh always gets one immediate attempt. `WebCalProvider` throws `HttpError` (carrying the HTTP status and parsed `Retry-After`) instead of swallowing a fetch failure internally, so it reaches `fetchConnectionEvents` and drives both the "error" status and the backoff — a WebCal connection that's actually down now reports "error" rather than the pre-`HttpError` behavior of toasting but staying "active". (A malformed/empty ICS body is still handled separately and doesn't trip this machinery: `parseICS` returns `null` — one "Flux illisible" toast, no backoff — rather than throwing; its try/catch covers `getAllSubcomponents()` too, not just the initial parse, since that call can itself throw on structurally-empty content.)

**Automatic retry timers**: a backed-off connection isn't just left alone until the user happens to navigate again — `DataProviderContext` schedules a `setTimeout` for `nextRetryAt` (`retryTimersRef`, keyed by connection id) that re-invokes `syncConnection` on its own, re-deriving the current visible window at fire time rather than closing over whatever window was active when it was scheduled. A boot-time effect re-arms this timer for any connection whose persisted `nextRetryAt` was still in the future when the tab was closed, so automatic retry resumes correctly after a reload too. These silent, timer-triggered attempts use a status callback that swallows the transient `"loading"` transition (passing `"active"`/`"error"` through normally) so a persistently-down connection's sidebar dot doesn't flicker on every retry — and the failure/recovery toast (below) only ever fires once per transition regardless of how many silent retries happen in between.

**Toast on transition, not on every attempt**: `fetchConnectionEvents` itself no longer toasts — that decision moved into `DataProviderContext`'s `recordFailure`/`recordSuccess`, which track an `erroredConnectionsRef` set of currently-failing connection ids. A toast fires only when a connection's status actually changes: once on the transition into "error", once on the transition back to "active" ("Connexion rétablie"). A connection retried automatically every 30s–10min while genuinely down toasts exactly once, not on every retry.

**Rules resolution** is resolved once per relevant change, not once per event per render per view: `useResolvedEvents()` (`src/hooks/useResolvedEvents.ts`) memoizes a `Map<eventId, { type, hidden }>` over `[events, rules, types, connections]`, calling the existing `resolveEventType`/`isEventHidden` (`components/events/EventChip.tsx`) once per event; `MonthView`, `TimeGridView`, and `AgendaView` all consume this same map instead of independently re-walking the rules engine. `lib/rules.ts` also caches each `name`-type rule's compiled `RegExp` (keyed by `${rule.id}:${rule.matchValue}`), rebuilt only when a rule's pattern actually changes. `MonthView` additionally buckets events by day once per render (`Map<dayKey, CalendarEvent[]>`) instead of linearly re-filtering the full event list per cell, and its `DayCell`/`EventChip`/`AvatarBadge`/`OverflowPopover` are `React.memo`'d so an unrelated local state change (e.g. opening one day's overflow popover) doesn't re-render the whole grid.

**Background loop**: every `BACKGROUND_SYNC_MS` (= `STALE_TTL_MS`, 5 min) while the tab is visible, and on every return to the tab (`visibilitychange`), `DataProviderContext` re-runs the ordinary unforced `loadWindow` on the current window — so stale sources refresh on their own instead of waiting for the user to navigate. The existing staleness/backoff logic decides what, if anything, is actually fetched.

**Sync dialog**: clicking `SyncIndicator` opens a dialog (same file) showing the cache period with its picker (`cacheMonths`), and per source its connection status (`connectionStatusDetail`), cache state (`cacheState()` in `event-cache.ts`: vide / partiel / complet / périmé against the current window), cached span and event count, plus a "Tout synchroniser" button. `SyncIndicator` is mounted in both `Header.tsx` and the `/debug` page header.

**Sync feedback**: `SyncIndicator` (`components/sidebar/SyncIndicator.tsx`, mounted in `Header.tsx` and `DebugPage.tsx`) shows a small, non-intrusive global state — a muted cloud-check when idle, a spinner while any connection is loading or a background refresh is running, an error badge (its tooltip naming the earliest scheduled retry across every backed-off source) when a connection has failed — derived entirely from the same `useConnectionStatusMap()`/`useConnectionSyncMeta()`/`useSourceSync()` data the sidebar's per-connection dots and "last updated" timestamp already use, never a second source of truth. `CalendarSkeleton` (`components/calendar/CalendarSkeleton.tsx`) replaces the calendar grid only for the very first fetch of a session — gated on `useEventsStore().hasLoadedOnce`, which flips to `true` the first time `setEvents` runs and stays `true` for the rest of the session, so a later background refresh never brings the skeleton back.

Each connection's status dot (`ConnectionRow` in `Sidebar.tsx`, and its `ConnectionsPanel.tsx` drawer counterpart) carries a tooltip built by `connectionStatusDetail()`: while healthy it shows when that connection last actually synced (`ConnectionSyncMeta.lastSyncedAt`), while erroring it shows the specific failure reason plus, if backed off, when it'll be retried automatically (`ConnectionSyncMeta.nextRetryAt`) — both exposed via `useConnectionSyncMeta()` alongside the existing `useConnectionStatusMap()`.

---

## Display types

An `EventType` ([types/index.ts](../src/types/index.ts)) defines a **color**, **icon**, an optional **`badgeLetter`** flag, and two independent `DisplayStyle`s — one for all-day events (`allDayStyle`), one for timed events (`timedStyle`):

| Style | Rendering |
| --- | --- |
| `block` | Full-width filled chip with icon + title (classic) |
| `avatar-tr` / `avatar-bl` / `avatar-br` | Small circular badge — the icon, or the event's first letter when `badgeLetter` is set — pinned to a corner of the day cell (top-right, bottom-left, bottom-right) |
| `text` | Event title shown next to the day number, no fill |
| `background` | Tints the whole day cell **and** shows the title next to the number (same label slot as `text`) |
| `border-top` / `border-bottom` | Thin colored line along the cell's top/bottom edge |

`text`/`background`/`border-top`/`border-bottom` are whole-cell-exclusive: `EventChip` renders nothing for these (returns `null`) — `MonthView`'s `DayCell` resolves each of the four slots separately per day. When more than one of that day's events wants the same slot, **the first event in the day's list wins the render** (`cellStyleEvents`, built while bucketing each day's events in [MonthView.tsx](../src/components/calendar/MonthView.tsx)); clicking the day number then opens the same multi-event picker (`EventListModal`) used for badge/block overflow, listing every event that resolved to one of those four styles that day.

`EventChip`'s `listMode` prop overrides all of the above: aggregation surfaces (overflow popovers, the multi-event modal) always need a titled row per event, so they pass `listMode` to force `block` rendering regardless of the event's resolved style — otherwise a cell with only `background`-style events would list as empty rows.

Exactly one type has `isDefault: true` at all times — it's the fallback used when no rule matches (see below) and can't be deleted until another type is made default first ([store/event-types.ts](../src/store/event-types.ts) `useEventTypeStore`).

Types are managed from the sidebar's **Types** section (`EventTypeForm`). The icon picker searches the full `lucide-react` icon set (~1750 icons) instead of a fixed shortlist; results are capped at 60 rendered buttons per query. [lib/icons.tsx](../src/lib/icons.tsx) derives `ALL_ICON_NAMES` from `lucide-react/dynamicIconImports`' kebab-case slugs (not from importing all ~1750 icon components), and `getIconEl()` renders any icon by name through `React.lazy`, code-split per icon and cached after first use — so no view that renders an icon (calendar grid, sidebar, this picker) ever ships the full icon set, only the handful actually on screen. Editing an existing type shows its linked rules inline — a "Textes" list (add/reorder/delete name-pattern rules) and a "Sources" list — plus a delete (click-to-confirm) button, disabled while it's the default type.

---

## Display rules engine

Which `EventType` an event renders with is resolved entirely by an ordered list of `Rule`s ([types/index.ts](../src/types/index.ts), [lib/rules.ts](../src/lib/rules.ts)), not by anything on the event itself — `eventTypeId` on a `CalendarEvent` is ingestion metadata only, never read for display.

A `Rule` matches by:

| `matchType` | `matchValue` is… |
| --- | --- |
| `event` | a specific `CalendarEvent.id` — legacy; the "just this event" quick action that created these was retired, existing ones still resolve and show read-only under "Autres" |
| `name` | a text/regex pattern tested against the event title |
| `source` | a `Connection.id` — every connection gets exactly one, auto-created the first time it's rendered ([`useSourceRule`](../src/components/settings/RuleEditRow.tsx)) |
| `all` | unused — the catch-all rule, matches every event |

**Resolution** ([components/events/EventChip.tsx:`resolveEventType`](../src/components/events/EventChip.tsx) → [lib/rules.ts:`findMatchingRule`](../src/lib/rules.ts)): rules are walked in array order (array order **is** priority), skipping any that are disabled; the first match wins. The catch-all rule always matches — `useRuleStore` seeds one on first load and re-seeds it on rehydrate if missing — so there is always a fallback. Resolving to the catch-all rule, or to any other rule whose target type has since been deleted (a "broken" rule), both fall back to the current **default `EventType`** (`useEventTypeStore.getDefaultType()`), not to a fixed `displayTypeId` on the rule itself. The catch-all rule can't be deleted, disabled, reordered, or retargeted — change which type it resolves to by making a different type the default instead.

New rules are inserted at the top of their own tier (event > name > source > catch-all), newest-first within a tier, via `tierOf()` in [store/rules.ts](../src/store/rules.ts). Rules can also be reordered by hand (drag, or the up/down buttons) within the non-catch-all block, and dragging/removing a connection cleans up any `source` rules that pointed at it.

Rules are managed from **Règles**, a drawer panel (`RulesPanel` in [components/settings/RulesPanel.tsx](../src/components/settings/RulesPanel.tsx)) reachable from its sidebar section — the same shared drawer as every other section (see [Settings map](#settings-map)) — split into "Textes" (name-pattern rules, freely addable/reorderable/deletable) and "Sources" (one fixed rule per connection). The same rules are also editable inline wherever they're relevant: a type's edit drawer lists and creates the name-pattern rules that target it, a connection's edit drawer shows its fixed source rule, and the event detail popup has a "create a rule from this event's title" shortcut.

---

## Quick hide

Both `Connection` and `EventType` carry an optional `hidden` boolean ([types/index.ts](../src/types/index.ts)). Toggling it (the eye icon next to each row in the sidebar's Sources/Types lists) never deletes or alters the underlying configuration — it's a pure display-time filter, and the item stays fully selectable everywhere else (pickers, rule targets, connection edit).

**Filtering** ([components/events/EventChip.tsx:`isEventHidden`](../src/components/events/EventChip.tsx)): an event is excluded from every calendar view (`MonthView`, `TimeGridView`, `AgendaView`) if its source connection is hidden, *or* if the `EventType` it resolves to via the [rules engine](#display-rules-engine) is hidden — including indirect matches through the catch-all/default-type fallback. All three views call `isEventHidden` when building their filtered event list, so there's a single source of truth for "should this render."

Hiding every source and every type at once is allowed unconditionally (no confirmation) — it's instantly reversible and the calendar's existing empty state covers it.

---

## Global theming

A `Theme` ([types/index.ts](../src/types/index.ts)) is a name + base `mode` (`light`/`dark`) + accent hex color, plus optional `fontFamily` (a Google Fonts family name, e.g. `"Roboto"`), `radius` (a CSS length), and `background`/`card`/`border`/`muted` base-color overrides. The two built-ins (`"light"`, `"dark"`, [lib/theme.ts](../src/lib/theme.ts) `BUILTIN_THEMES`) live in `useThemeStore.customThemes` alongside every user-created theme ([store/index.ts](../src/store/index.ts)) and are equally editable, renamable, and deletable — nothing is special-cased read-only.

**Applying a theme** ([app/providers.tsx](../src/app/providers.tsx)): on mount and whenever the selection changes, an effect toggles the `.dark` class on `<html>` per the theme's `mode`, then calls `resolveThemeCssVars()` to override `--primary`/`--primary-foreground`/`--accent`/`--accent-foreground`/`--ring`, `--font-sans`, `--radius`, and the base surface tokens (`--background`/`--card`/`--border`/`--muted`, all defined in [globals.css](../src/app/globals.css)) — unset base colors fall back to `DEFAULT_BASE_COLORS[mode]`. Only hue+saturation come from the picked accent; lightness stays fixed per mode at the app's existing hand-tuned values, so custom accents don't wreck contrast. `radius` is chosen from a small preset scale (None/Subtle/Full) in `ThemeForm`, applied consistently everywhere `rounded-*` is used. `fontFamily` is loaded via a Google Fonts `<link>` injected at selection time; themes saved before this field existed may hold a full CSS font-family stack instead of a bare family name — see `rawFamilyName()` in [lib/theme.ts](../src/lib/theme.ts).

Managed via the sidebar's **Thème** section ([Settings map](#settings-map)): every theme is listed and selectable inline; editing (including the two built-ins) opens `ThemeForm` ([components/settings/ThemeForm.tsx](../src/components/settings/ThemeForm.tsx)), which also offers duplicate. Custom `background`/`card`/`border`/`muted` overrides live behind a collapsed "Avancé" toggle. The accent picker offers a vivid row (`THEME_ACCENT_PRESETS`) and a soft row (`THEME_ACCENT_SOFT_PRESETS`, same hues at half saturation — since only hue+saturation are applied, these give a genuinely calmer primary).

**Background pattern**: `Theme.pattern` (`none`/`dots`/`grid`/`diagonal`/`ruled`, `THEME_PATTERNS` in [lib/theme.ts](../src/lib/theme.ts)) becomes `--pattern`/`--pattern-size`, drawn by the `.bg-pattern` class ([globals.css](../src/app/globals.css)) on each page's root surface, so it shows through the transparent calendar cells. Every pattern is inked in `hsl(var(--foreground) / 0.07)` — near-black on light themes, near-white on dark — so it stays monochrome and subtle whatever the accent.

Display types can use the same textures: `EventType.pattern` is drawn in the type's own color (~35% alpha, `typePatternStyle()`) on top of the `background` style's tint — in `DayCell` (month grid, week/day header) and `AgendaView`. The type editor only offers it when one of its two styles is "Fond", via the `PatternPicker` shared with the theme editor.

**Font preview**: the font search loads every suggested family on open, so each entry renders in its own face with a sample line; the chosen font's sample shows under the field.

**Live preview**: while `ThemeForm` is open it writes its draft to `useThemeStore.previewTheme` (never persisted), which `Providers` applies instead of the selected theme; unmounting the form (save, cancel, closing the drawer) clears it.

**Suivre le système**: `useThemeStore.systemThemes` (`{ light, dark }` theme ids, persisted per device, not part of the sync bundle) makes `Providers` keep `selectedThemeId` in step with `prefers-color-scheme` via a `matchMedia` listener. Any manual `selectTheme` (sidebar click, preset) turns it off; deleting one of its two themes does too.

---

## Onboarding ("Bien démarrer")

A checklist at the top of the Help drawer ([GettingStarted.tsx](../src/components/settings/GettingStarted.tsx)). Its steps are **derived from the stores, not tracked** ([lib/onboarding.ts](../src/lib/onboarding.ts) `onboardingSteps()`): a non-demo source exists; a type outside `DEFAULT_EVENT_TYPES`; a name/event rule whose id isn't a seeded `seed-…` one; and, as bonus steps, removing the demo source (offered once a real source exists), a preset, a custom or non-"Clair" theme, and a successful AI import. That last one is the only thing not derivable, so it's a flag in the one new persisted key, `overcal:onboarding` (`aiImported`, plus `dismissed`). Deleting what ticked a step un-ticks it, and importing settings ticks whatever they contain.

`CalendarPage`'s `useOnboarding()` opens the Help drawer by itself on a fresh instance (only the demo source, not dismissed) — at most once per tab session (a `sessionStorage` flag) — and toasts "C'est prêt" on the transition to all core steps done (never on load). "Réinitialiser" clears `overcal:onboarding` too.

Each open step's "Commencer" button opens the form that completes it — the same action as the matching sidebar "+" (for rules: a blank rule, edited inline in the rules drawer). No guided-tour library: an earlier driver.js version was tried and dropped as not worth the dependency.

---

## URL & browser history

The calendar page's URL encodes `?view=&date=&preset=` plus the open settings drawer (`panel=`, `edit=`, `new=1`) — [lib/url-state.ts](../src/lib/url-state.ts) `toSearch`/`fromSearch`, wired in `CalendarPage`. On mount the store is hydrated from the URL (so any of those is deep-linkable); after that every store change is recorded in browser history per `historyAction()`, so Back/Forward step through app states instead of leaving the page:

- **push** — opening a drawer, changing view or period, a preset becoming active;
- **replace** — everything else (visibility tweaks that make a preset stop matching, switching panels inside an open drawer);
- **back** — closing a drawer whose entry we pushed (marked `history.state.webcalDrawer`), so the next Back doesn't reopen it.

`popstate` re-applies the popped URL with store subscriptions muted (`restoring`), then canonicalizes the URL. One known gap: an entry without `preset=` can't *un-apply* a preset, since the URL doesn't hold the visibility the preset replaced.

---

## Notifications

Transient feedback (export/import confirmations, errors) uses [sonner](https://sonner.emilkowal.ski/) — call `toast.success(...)` / `toast.error(...)` from any client component, no plumbing needed. The host `<Toaster />` ([components/ui/sonner.tsx](../src/components/ui/sonner.tsx)) is mounted once in [app/providers.tsx](../src/app/providers.tsx), styled with the app's `popover`/`border` tokens so it matches whichever theme is active. This doesn't replace `ActionButton`'s inline armed/pending/success/error state (used for connection tests and destructive confirmations) — that pattern stays for feedback that's local to a specific button.

---

## Persistence (localStorage)

Everything lives in the browser. There is no server-side database — the Next.js API route is a stateless relay, not storage.

| Zustand store | localStorage key | Persisted? | Notes |
| --- | --- | --- | --- |
| `useConnectionStore` | `overcal:connections` | Yes, in full | WebCal connections + the seeded demo one. Removing a connection also deletes its `source` rule. A `hidden` flag (see [Quick hide](#quick-hide)) lives on each connection. Rehydrate drops connections of unsupported types. |
| `useEventTypeStore` | `overcal:event-types` | Yes, in full | Rehydrate ensures exactly one type has `isDefault: true`. A type can't be deleted while it's the default — make another type default first. A `hidden` flag lives on each type. |
| `useRuleStore` | `overcal:rules` | Yes, in full | Ordered list of `Rule`s; array order is match priority. Always contains exactly one `matchType: "all"` catch-all rule, seeded on first load and re-seeded on rehydrate if missing. |
| `usePresetStore` | `overcal:presets` | Yes, in full | Saved visibility (+ optional theme) combinations, see [006-view-presets](../specs/006-view-presets/spec.md). |
| `useThemeStore` | `overcal:themes` | Partial (`partialize`) | `customThemes` (seeded with the two built-ins, then holds every theme — all equally editable), `selectedThemeId`, `themeOrder`, `systemThemes`. Not `previewTheme` (live preview only). |
| `useUIStore` | `overcal:ui` | Partial (`partialize`) | `view`, week start, 24h clock, date format, timezone, collapsed sidebar sections, `cacheMonths`. `currentDate`, `sidebarOpen` and `activeDrawer` reset every load. |
| `useOnboardingStore` | `overcal:onboarding` | Yes | "Bien démarrer" state not derivable from the other stores — see [Onboarding](#onboarding-bien-démarrer). |
| `useEventsStore` | — | **No** | Events are never persisted directly; they're served from the [event cache](#event-caching--sync-feedback) (`overcal:event-cache`), which fetches only what isn't already cached. Also holds `hasLoadedOnce`, driving the first-load skeleton. |

Stores live one per file in [store/](../src/store/); [store/index.ts](../src/store/index.ts) re-exports them, lists `SETTINGS_STORAGE_KEYS` (what /data's Reset clears) and wires the sync clock.

**SSR guard:** Next.js server-renders "use client" components once to produce the initial HTML, where no `localStorage`/`window` exists. All persist configs share one `storage` wrapper ([store/storage.ts](../src/store/storage.ts)) that returns a no-op storage when `typeof window === "undefined"` — without it, `next build`'s prerender step crashes.

---

## Settings map

Everything below opens in one shared side drawer (`SettingsDrawer`, [components/settings/SettingsDrawer.tsx](../src/components/settings/SettingsDrawer.tsx)) whose content swaps on `useUIStore().activeDrawer` — there are no separate settings pages or modals.

- **Presets** — sidebar **Presets** section (`PresetSelector`): saved source/type-visibility combinations, see [006-view-presets](../specs/006-view-presets/spec.md).
- **Sources** — sidebar **Sources** section: add/edit ICS/WebCal connections (`ConnectionForm`), see live per-connection status, hide/show, delete.
- **Types** — sidebar **Types** section, see [Display types](#display-types).
- **Règles** — sidebar **Règles** section, see [Display rules engine](#display-rules-engine).
- **Thème** — sidebar **Thème** section: every theme, including the two built-ins, is listed and selectable inline; editing opens the same drawer. See [Global theming](#global-theming).
- **Réglages** — sidebar **Réglages** section (toggles and timezone inline); its label opens `PreferencesPanel` ([components/settings/PreferencesPanel.tsx](../src/components/settings/PreferencesPanel.tsx)) with the same options described. Export, import, AI settings, sync and reset live on the `/data` page. `/settings` is kept only as a redirect (`src/app/settings/page.tsx`) that opens this panel then bounces to `/`.
- **Aide** — sidebar footer "?" button: the "Bien démarrer" checklist and how the app fits together (`HelpPanel`).

## Server feed (009-server-ics-presets)

Optional read/write server slice under `src/server/`. Sources are read through *connectors* (`src/server/connectors/`): ICS/WebCal (read-only) and CalDAV (read and create, e.g. Radicale, Nextcloud, iCloud, Fastmail). Environment variables:

- `ADMIN_TOKEN` — bearer token for `POST /api/admin/import` and `POST /api/events` (both disabled when unset).
- `SECRET_KEY` — encrypts endpoint passwords stored in SQLite (required to import `endpoints`).
- `WEBCAL_SERVER_DB_PATH` — SQLite file (default `./webcal-server.sqlite`).
- `AGGREGATION_INTERVAL_MS` — aggregation cadence (default 5 min).

`POST /api/admin/import` takes a settings-export JSON, optionally with an `endpoints` array (`{ connectionId, kind: "caldav", url, username, password, calendar? }`) that attaches a CalDAV endpoint to a connection by id, and returns each preset's feed URL. `GET /api/feed/[token]` serves a preset as `.ics`. `POST /api/events` (`{ connectionId, calendarId?, event: { title, start, end, allDay? } }`) creates an event on a writable endpoint.
