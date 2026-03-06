# WEB-CAL

## Core concept
A personal calendar interface that connects to Proton Calendar via CalDAV, with strong visual customization per event type.

---

## Tech stack
- React 18 + TypeScript
- Vite (PWA plugin: vite-plugin-pwa)
- Tailwind CSS + shadcn/ui
- tsdav (CalDAV client library) for Proton Calendar sync
- ical.js for iCalendar parsing
- date-fns for date manipulation
- Zustand for state management

---

## CalDAV Integration (Proton Calendar)
- Connect via CalDAV: https://calendar.proton.me
- Auth: username + app password (Proton-specific token), stored in localStorage
- On first launch, show a setup modal asking for CalDAV credentials
- Sync calendars list, then fetch events for current view range
- Support create / edit / delete events (PUT/DELETE on CalDAV)
- Handle multiple calendars (each Proton calendar = one CalDAV collection)

---

## Calendar views
Implement 4 views with a top navigation to switch between them:
1. **Month** – classic grid, show event pills per day, "+N more" overflow
2. **Week** – time-based column grid (7 days), hourly slots, drag-friendly layout
3. **Day** – single day time grid with detailed event blocks
4. **Agenda / List** – chronological list of upcoming events, grouped by date

---

## Event appearance system (key feature)
Each event has an "event type" field (user-defined category). For each event type, the user can configure:
- A **color** (color picker)
- An **icon** (from lucide-react icon set, searchable)
- A **display style** chosen from: `pill` (compact inline), `card` (elevated with shadow), `block` (flat filled rectangle), `outline` (border only)
- A **label** / name for the type

Store event type definitions in localStorage. Apply them consistently across all views.

When creating/editing an event, the user selects an event type from their custom list (or creates a new one inline).

---

## UI / UX requirements
- Full dark mode support (toggle in header)
- Responsive: works on mobile and desktop
- Today highlighted in all views
- Mini month navigator in sidebar for quick navigation
- Event creation: click on a time slot or day to open a creation modal
- Event editing: click on existing event to open edit modal
- Event modal fields: title, event type, start datetime, end datetime, location (optional), notes (optional), calendar (which Proton calendar)
- Color-coded calendar list in sidebar with show/hide toggle per calendar

---

## PWA requirements
- Manifest with name, icons, theme color
- Service worker with cache-first strategy for app shell
- Offline mode: show cached events when offline, queue writes for sync when back online

---

## Settings page
- CalDAV connection (credentials, test connection, disconnect)
- Event types manager: list, add, edit, delete custom event types
- Default view preference
- Week starts on: Monday / Sunday

---

## Project structure
src/
  components/
    calendar/       # view components (MonthView, WeekView, DayView, AgendaView)
    events/         # EventModal, EventCard, EventPill
    sidebar/        # MiniCalendar, CalendarList
    settings/       # EventTypeEditor, CalDAVSettings
  hooks/            # useCalDAV, useEvents, useEventTypes
  store/            # Zustand stores
  lib/              # caldav.ts, ical.ts, utils.ts
  types/            # Event, Calendar, EventType interfaces

---

Start by scaffolding the full project structure, then implement: the CalDAV connection layer, the event type system, and the Month view as the default landing screen.