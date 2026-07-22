# Feature backlog

Ideas not yet scheduled into a spec. Pull one into `specs/` (via `/speckit.specify`) when it's ready to build.

- [x] **Settings export/import** — export all app settings (connections, types, rules, preferences, themes) to a single `.json` file, and import it back.
- [x] **Presets** — save/switch between named combinations of source & type visibility (e.g. "Work": only work calendar; "Personal": only personal events).
- [x] **Keyboard shortcuts** — view switching (month/week/day), preset switching (1/2/3…), and navigation (arrow keys = next day, shift+arrow = next month, etc).
- [x] **URL encoded views** — to easily reach a specific view, the URL should be able to encode presets, date, timeview (month, week, day, agenda).
- [x] **Settings side drawer** — move all modals (settings/events/display types/theming...) to a side drawer to allow for live preview of the modifications.
- [x] **Remove calDav** — remove options for CalDAV for now and only allow for ICS feeds. (add a small description in how to get them from popular providers. google, Apple, Microsoft...)
- [ ] **Augment theming** — Augment the theming options with fonts from google fonts and few border radiuses
- [ ] **Update dependencies** - Update as many dependencies as possible. Especially NEXTjs
- [x] **Move notifications system to toast** - Work on an homgenous notifications and feedback system through shadcn toasts.
- [ ] **Rework event display system** - Fix the different event display issues. Block event higher than the day number, multi event popover not working, multi event styling decider.
- [x] **Factorize button confimation system** Factorize the button system with destructive actions. The button should always stays and keep the same shape, only the content should change from the action verb to "confirm ?"
- [ ] **Add a get started tutorial** Create a get started tutorial with steps by steps information in how to 1.add a source 2. create a display type 3. create a rule

Shipped features (cloud connectors, custom display types, the rules engine, quick hide, global theming) are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and their originating specs under `specs/`.
