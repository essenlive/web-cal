# Quickstart: Manual Verification — Quick Hide

No automated test runner exists in this repo (see plan.md Technical Context). Verify manually with `npm run dev`.

## Setup

1. Ensure at least two connections are configured (Settings → Data Sources → Add Source), each producing events in the visible date range, and that the default six event types exist (fresh install has them by default).
2. Note which connection/type each visible event currently uses (hover/click an event, or check its color against Settings → Types).

## 1. Hide a source (User Story 1)

1. In the Sidebar's new "Sources" quick list, click the eye icon next to one connection.
2. **Expect**: every event from that connection disappears immediately from whichever view is open (Month/Week/Day/Agenda), with no reload.
3. Switch through all four views (Month, Week, Day, Agenda) without touching the toggle again.
4. **Expect**: that connection's events remain absent in every view.
5. Open Settings → Data Sources.
6. **Expect**: the connection is still listed with its name, color, type badge, and status — visibly dimmed/marked hidden — and its hide/show button reflects the hidden state.
7. Click the eye icon again (from either the sidebar or Settings).
8. **Expect**: its events reappear immediately in whatever view is open.

## 2. Hide a display type (User Story 2)

1. Pick a type currently used by at least one visible event (directly or via a connection's fallback display type).
2. In the Sidebar's "Types" quick list, toggle it hidden.
3. **Expect**: every event currently styled with that type disappears from all views, including ones that only got that style via calendar-level fallback or the application default (not just events with the type assigned directly).
4. Open Settings → Types.
5. **Expect**: the type is still listed with its full config (label, color, icon, style previews) and marked hidden.
6. Unhide it (from either surface).
7. **Expect**: affected events reappear immediately, styled exactly as before.

## 3. Quick access without leaving the calendar (User Story 3)

1. From the main calendar screen (not Settings), confirm the Sidebar lists every connection and every type with its current hidden/visible state at a glance.
2. Toggle two or three items in a row.
3. **Expect**: each toggle takes effect immediately; no navigation away from the calendar was needed at any point.

## 4. Regression checks

- With zero items hidden, all events render exactly as before this feature (no visual change).
- Hide every source and every type at once.
  - **Expect**: the calendar shows its existing empty state; no error, no crash, no confirmation prompt blocks the action.
  - Unhide everything again; all events return.
- Create a new event (or edit one) while its type is hidden.
  - **Expect**: the hidden type is still selectable in the type picker (hiding never removes it from pickers) — the event is simply absent from calendar views until the type is unhidden.
- Delete a hidden connection or a hidden type.
  - **Expect**: deletion behaves exactly as it does for a visible connection/type today (hidden is not a precondition for, or obstacle to, deletion).

## 5. Quality gates

```bash
npx tsc -b
npm run lint
npm run build
```

All three must pass with zero errors/warnings before considering this feature done.
