# Quickstart: Verifying the Settings Side Drawer

No automated test suite exists in this repo — verify manually with `npm run dev`.

1. **Live preview (SC-001, SC-002 / User Story 1)**
   - Open an event type editor from the sidebar. Confirm the calendar grid is still visible beside/behind the drawer (not fully hidden).
   - Change the event type's color. Confirm matching events on the calendar update immediately, drawer still open.
   - Open the theme editor. Change accent color / border radius. Confirm the calendar restyles immediately without closing the drawer.

2. **Connections & rules (User Story 2)**
   - Open "Add connection", fill in an ICS feed, save. Confirm the connection list and calendar events update, drawer closes or stays per existing save behavior.
   - Open the rules manager, reorder a rule, edit a rule's match condition. Confirm the calendar's displayed types update once saved, and the calendar was visible throughout.

3. **Preferences (User Story 3, FR-007)**
   - Click the Settings (gear) icon. Confirm it opens the Preferences panel in the drawer over the calendar — the URL does not navigate to a separate page.
   - Toggle 24h format. Confirm calendar times update immediately.
   - Manually visit `/settings` directly in the browser. Confirm it still resolves to the calendar with the Preferences drawer open (no broken page).

4. **Mutual exclusion (FR-005)**
   - With one panel open, trigger a different panel's entry point (e.g. click an event type's edit while the rules panel is open, if such a path exists). Confirm the drawer's content switches rather than a second drawer stacking on top.

5. **Dismissal (FR-004)**
   - For each panel: close via the close (X) button, via clicking outside the drawer, and via the Escape key. Confirm all three work and no unsaved-changes prompt blocks the user (edits are discarded, matching current modal behavior).

6. **Mobile (FR-008)**
   - Resize the browser to a narrow (mobile) width. Confirm each panel still opens, is fully usable, and is dismissible.

7. **Regressions**
   - Confirm existing keyboard shortcuts (arrow-key day/month navigation, 1/2/3 preset switching) still behave as before when no drawer is open, and don't fire unexpectedly while a drawer is open and focus is on a control inside it.
   - Run `npm run build` and `npm run lint` — both must pass.

8. **Real Drawer for settings surfaces** (added after user follow-up — see research.md Decisions 1 and 3)
   - Open any settings panel (Preferences, Connections, Event Types, Rules, Theme) and confirm it visibly slides in from the right and shares one consistent look — this is `vaul`'s own animation, not a Tailwind-only approximation.
   - Click the keyboard icon in the sidebar footer. Confirm "Raccourcis clavier" opens as a 6th panel in the same drawer (no longer a small popover).
   - Confirm `ThemeSelector`'s theme-picker popover (the small dropdown to choose an existing theme) still opens as a `Popover`, not a Drawer — this is deliberate, since it's a selection menu, not a form/detail popup.

9. **Event content stays as popup modals** (added after a second follow-up — see research.md Decision 3)
   - Click an event on the calendar. Confirm its detail view opens as a centered `Dialog` (not a right-side Drawer), and "Create a rule from this event" swaps in the rule form within that same `Dialog`.
   - On a month with a day that has more events than fit, click "+N more". Confirm the multi-event selector opens as a centered `Dialog`, not a Drawer.
   - Open the Rules panel's "New Rule" form (Drawer-embedded) and separately the event-detail "create a rule" form (Dialog-embedded). Confirm `RuleModal` looks and behaves consistently in both, including its close button, even though the two host different overlay primitives.
