# Feature Specification: Settings Side Drawer

**Feature Branch**: `007-settings-side-drawer`
**Created**: 2026-07-22
**Status**: Draft
**Input**: User description: "Settings side drawer — move all settings-related modals (Settings, Add/Edit Connection, Event Type editor, Rule editor, Theming) from centered modal dialogs into a side drawer panel, so users can see the calendar update live behind the drawer while adjusting settings, instead of the calendar being fully obscured by a centered modal."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Live preview while editing event types and theme (Priority: P1)

A user adjusts an event type's color or the app's theme (font, radius, accent color) and wants to see the calendar update immediately, without the editing panel blocking their view of the events it affects.

**Why this priority**: This is the core value of the feature — today, centered modals fully cover the calendar, so users must close the dialog, look, then reopen it to iterate on a color or style choice. This is the most frequent and highest-friction editing loop.

**Independent Test**: Open the event type editor (or theme editor) from the sidebar, change a color/style value, and confirm the calendar grid remains visible and updates live without closing the panel.

**Acceptance Scenarios**:

1. **Given** the calendar is showing events of a given type, **When** the user opens that event type's editor and changes its color, **Then** matching events on the visible calendar update to the new color immediately, while the calendar stays visible next to the editor.
2. **Given** the theme editor is open, **When** the user changes an accent color or border radius, **Then** the calendar behind the drawer reflects the change immediately.

---

### User Story 2 - Editing connections and rules without losing calendar context (Priority: P2)

A user adds or edits a calendar connection, or reorders/edits display rules, and wants to keep the calendar visible for context (e.g. to check which events are affected) instead of it being hidden behind a centered dialog.

**Why this priority**: Same underlying problem as User Story 1, applied to the remaining editors. Slightly lower priority because connections and rules are edited less frequently than colors/theme.

**Independent Test**: Open the "Add/Edit Connection" panel and the "Rules" panel independently from the sidebar; confirm each renders as a side drawer with the calendar still visible, and that all existing add/edit/delete/reorder actions still work.

**Acceptance Scenarios**:

1. **Given** the user opens the connection editor to add a new ICS feed, **When** the drawer is open, **Then** the calendar remains visible and the connection list updates immediately after saving.
2. **Given** the user opens the rules manager, **When** they reorder or edit a rule, **Then** the calendar (still visible) reflects the updated display types once the change is saved.

---

### User Story 3 - Preferences accessible without leaving the calendar (Priority: P3)

A user opens general preferences (week start day, 24h clock, date format) and wants to toggle a setting and immediately see its effect on the calendar, rather than navigating to a separate settings page and back.

**Why this priority**: Preferences are changed the least often of the settings surfaces, but today this is the most jarring case — it currently navigates to a whole separate page instead of a modal, fully replacing the calendar. Bringing it into the same drawer pattern completes the consistency goal.

**Independent Test**: Open Preferences from the sidebar and toggle "24h format"; confirm the change applies to the still-visible calendar without a page navigation occurring.

**Acceptance Scenarios**:

1. **Given** the user is viewing the calendar, **When** they open Preferences and toggle the date format, **Then** the calendar's displayed times/dates update immediately and the URL/route does not change to a separate settings page.

---

### Edge Cases

- What happens when the viewport is narrow (mobile width)? The drawer MUST remain usable; it may expand to occupy the full width of the screen, but it must still be dismissible and must not silently trap the user without a way back to the calendar.
- What happens when a user triggers a second settings panel while one is already open (e.g. clicking "edit" on an event type from within the rules panel)? The system MUST switch the drawer's content to the newly requested panel rather than stacking multiple drawers.
- What happens if the user navigates directly to the existing `/settings` URL? It MUST still land the user on the calendar with the corresponding drawer panel open, so existing bookmarks/links keep working.
- What happens when the user dismisses the drawer (Escape, click outside, close button) while a form inside it is mid-edit? Unsaved edits are discarded, consistent with current modal behavior — no new confirmation step is introduced.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present Preferences, Connection add/edit, Event Type add/edit, Rules management, and Theme editing within a single, consistent side drawer UI pattern.
- **FR-002**: Opening any settings-related panel MUST keep the calendar visible at the same time, rather than fully covering it (as a centered modal does) or navigating away from it (as the current Preferences page does).
- **FR-003**: Changes made within any settings drawer panel (event type color, theme values, rule changes, preference toggles) MUST be reflected on the visible calendar immediately, without requiring the drawer to be closed.
- **FR-004**: The drawer MUST be dismissible via a visible close control, an outside click, and the Escape key, matching the current dismissal behavior of the existing modals.
- **FR-005**: Requesting a different settings panel while the drawer is already open MUST replace its content with the newly requested panel, not open a second overlapping drawer.
- **FR-006**: All actions currently available in the existing modals and the Preferences page (add/edit/delete connection, add/edit/delete event type, add/edit/delete/reorder/toggle rule, edit/select theme, toggle preferences) MUST remain available with equivalent functionality inside the drawer.
- **FR-007**: The existing `/settings` route MUST continue to resolve to a working experience (opening the Preferences panel in the drawer over the calendar) rather than becoming a broken link.
- **FR-008**: On narrow viewports, the drawer MUST remain fully operable (open, edit, close), adapting its width as needed.

### Key Entities

This feature changes presentation only; it introduces no new data entities and does not alter the shape of existing settings data (connections, event types, rules, theme, preferences).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When any settings panel is open, the calendar grid remains visible on screen 100% of the time (previously 0%, since modals fully overlaid it and Preferences fully replaced it).
- **SC-002**: A color, theme, or rule change made in an open drawer is visible on the calendar within the same interaction, with no explicit "close panel to see result" step required.
- **SC-003**: All settings actions that existed before this change (create/edit/delete connection, event type, rule; edit theme; toggle preference) are completable through the new drawer with zero loss of capability, verified by exercising each action.
- **SC-004**: Existing bookmarks/links to `/settings` continue to resolve to a working, equivalent experience after the change.

## Assumptions

- "Settings" in the feature description refers to the existing Preferences page (week start, 24h clock, date format), currently reached via full page navigation to `/settings` — it is included in this drawer consolidation since it has the same "calendar gets hidden" problem the feature targets, only more severe (full navigation instead of an overlay).
- The drawer replaces the *presentation* of the existing five settings surfaces (Preferences, Connections, Event Types, Rules, Theme); it does not add, remove, or rename any of their underlying fields or actions.
- Only one settings drawer is open at a time; there is no requirement to support multiple simultaneous drawer panels or a persistent/pinned drawer state.
- Keyboard shortcuts and URL-encoded view state (from prior features) are unaffected by this change other than the `/settings` route now opening the drawer instead of a separate page.
