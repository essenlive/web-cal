# web-cal

A personal calendar PWA built with React 18 + TypeScript. Connects to CalDAV servers, WebCal/iCal subscriptions, or runs with local demo data. Strong visual customisation per event type.

---

## Tech stack

- React 18 + TypeScript + Vite (vite-plugin-pwa)
- Tailwind CSS
- react-big-calendar + date-fns
- Zustand (persist middleware)

---

## Views

| View    | Description                                    |
| ------- | ---------------------------------------------- |
| Month   | Grid with event chips per day, overflow hidden |
| Week    | Time-based column grid with hourly slots       |
| Agenda  | Chronological list grouped by date             |

---

## Event appearance system

Each event has an **event type** (user-defined category). Per type, configure:

- **Color** — color picker with presets
- **Icon** — from lucide-react
- **All-day display style** — `avatar-tl`, `avatar-bl`, `avatar-br` (corner badge), `block` (filled bar), `day` (full-day background tint)

Timed events always render as a filled block regardless of style.

Individual events can also use **Custom** type, which sets color/icon/style at the event level.

---

## Data backends

Switch provider in Settings → Source de données.

### Demo (local)

Seed events stored in `localStorage`. Full read/write. No network required.

### WebCal / iCal

Read-only subscription to one or more `.ics` URLs (`webcal://` or `https://`). If the server doesn't send CORS headers, configure a proxy prefix (e.g. `https://corsproxy.io/?`).

### CalDAV

Read/write via CalDAV (RFC 4791). Compatible with:

- Proton Calendar (`https://calendar.proton.me/dav`)
- Nextcloud, Fastmail, Baikal, Radicale
- Apple Calendar Server
- Google Calendar (`https://www.googleapis.com/caldav/v2/`)

Auth: HTTP Basic (username + app-password). Most servers block browser-direct CORS — use a local proxy or `corsproxy.io`.

---

## Settings

- **Source de données** — switch backend, configure credentials, test connection
- **Types d'événements** — add / edit / delete event types (color, icon, all-day style); pick the default type for new events
- **Préférences** — week start (Monday/Sunday), 24h clock, date format (DD/MM/YYYY or MM/DD/YYYY)

---

## PWA

Installable. Service worker caches the app shell for offline use.

---

## Project structure

```text
src/
  components/
    calendar/       # RBCCalendar, AgendaView
    events/         # EventChip, EventModal
    sidebar/        # Header, MiniCalendar
    settings/       # BackendSettings, EventTypeEditor
  context/          # DataProviderContext
  lib/              # data-provider.ts, mock-*, caldav-provider.ts, webcal-provider.ts
  pages/            # SettingsPage
  store/            # Zustand stores (ui, eventTypes, events, backend)
  types/            # CalendarEvent, EventType, DisplayStyle, CalendarView
```

---

## Development

```bash
npm install
npm run dev
npm run build
```
