# Feature backlog

Ideas not yet scheduled into a spec. Pull one into `specs/` (via `/speckit.specify`) when it's ready to build.

- [x] **Settings export/import** — export all app settings (connections, types, rules, preferences, themes) to a single `.json` file, and import it back.
- [x] **Presets** — save/switch between named combinations of source & type visibility (e.g. "Work": only work calendar; "Personal": only personal events).
- [x] **Keyboard shortcuts** — view switching (month/week/day), preset switching (1/2/3…), and navigation (arrow keys = next day, shift+arrow = next month, etc).
- [x] **URL encoded views** — to easily reach a specific view, the URL should be able to encode presets, date, timeview (month, week, day, agenda).
- [x] **Settings side drawer** — move all modals (settings/events/display types/theming...) to a side drawer to allow for live preview of the modifications.
- [x] **Remove calDav** — remove options for CalDAV for now and only allow for ICS feeds. (add a small description in how to get them from popular providers. google, Apple, Microsoft...)
- [x] **Augment theming** — Augment the theming options with fonts from google fonts and few border radiuses
- [x] **Update dependencies** - Update as many dependencies as possible. Especially NEXTjs. (Next.js 15→16, Tailwind CSS 3→4 (via official `@tailwindcss/upgrade` codemod — `tailwind.config.js` removed, config moved into `globals.css` as `@theme`), TypeScript 5.9→6.0 (6.0, not 7 — 7.x is unsupported by `typescript-eslint`'s peer range `<6.1.0`), lucide-react 0→1, eslint 9→10, globals 16→17, plus all in-range patch/minor bumps.)
- [x] **Move notifications system to toast** - Work on an homgenous notifications and feedback system through shadcn toasts.
- [x] **Rework event display system** - Fix the different event display issues. Block event higher than the day number, multi event popover not working, multi event styling decider.
- [x] **Factorize button confimation system** Factorize the button system with destructive actions. The button should always stays and keep the same shape, only the content should change from the action verb to "confirm ?"
- [ ] Later **Add a get started tutorial** Create a get started tutorial with steps by steps information in how to 1.add a source 2. create a display type 3. create a rule. Check if libraries already fit this purpose correctly.
- [x] **Rework global UI** Rework the global UI of the app for a cleaner and more homogenous experience. Content should be better strutured and organized. Use a tool or create a skill if needed such. I want to use /impeccable — done via `/impeccable critique` + fixes: seeded demo rules so zero-config shows color-by-rule, localized remaining English screens to French, fixed two WCAG AA contrast failures, fixed mobile sidebar covering its own toggle, snapped off-token font sizes to the documented type ramp. See `DESIGN.md` and `.impeccable/critique/`.
- [x] **Change empty app setup** - Rework how the calendar initializes when it has no custom sources. It should always start with an initial source that can be deleted that seeds the initial data. Same for display type, there should always be an existing default type, that is displaying all blocks. — done via a seeded `DemoConnection` (visible "Démo" source, deletable, no network fetch) replacing the previous silent MockDataProvider fallback; the always-present default display type already existed (`isDefault` on `EventType`, undeletable, catch-all rule resolves to it).
- [ ] **Fix small UI bugs** :
  - [ ] The drawer has a bug with a full width horizontal scroll
  - [ ] The custom colors in global themeing should be behind a "avancé" accordion
  - [ ] The delete buttons in the drawer should always display text and not simply the bin icon. Exactly as it is in the theme settings.
  - [ ] The rules should be a section like the other sections in the sidebar.
  - [ ] In fact, all sidebar sections should be coherent and organized similarly.

Shipped features (cloud connectors, custom display types, the rules engine, quick hide, global theming) are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and their originating specs under `specs/`.
