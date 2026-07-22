# Feature backlog

Ideas not yet scheduled into a spec. Pull one into `specs/` (via `/speckit.specify`) when it's ready to build.

- [ ] **Settings export/import** — export all app settings (connections, types, rules, preferences, themes) to a single `.json` file, and import it back.
- [ ] **Presets** — save/switch between named combinations of source & type visibility (e.g. "Work": only work calendar; "Personal": only personal events).
- [ ] **Keyboard shortcuts** — view switching (month/week/day), preset switching (1/2/3…), and navigation (arrow keys = next day, shift+arrow = next month, etc).
- [ ] **URL encoded views** — to easily reach a specific view, the URL should be able to encode presets, date, timeview (month, week, day, agenda).
- [ ] **Settings side drawer** — move all modals (settings/events/display types/theming...) to a side drawer to allow for live preview of the modifications.
- [ ] **Settings side drawer** — remove options for CalDAV for now and only allow for ICS feeds. (add a small description in how to get them from popular providers. google, Apple, Microsoft...)

Shipped features (cloud connectors, custom display types, the rules engine, quick hide, global theming) are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and their originating specs under `specs/`.
