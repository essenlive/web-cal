# Feature Specification: Quick Hide

**Feature Branch**: `004-quick-hide`
**Created**: 2026-07-22
**Status**: Draft
**Input**: User description: "Quick hide — a fast way to toggle visibility of individual data sources and display types without deleting them."

## Clarifications

### Session 2026-07-22

- Q: When a display type is hidden, does "every event that currently resolves to that type" include events that only reach it indirectly (via calendar-level fallback or the application default), or only events with that type assigned directly? → A: Indirect matches count too — hiding a type hides every event currently rendered with it, regardless of which step of the existing resolution chain produced that result. Filtering by anything narrower would leave visibly-styled-as-X events on screen after the user explicitly hid X, defeating the feature's purpose.
- Q: Should the system block a user from hiding every source and every type at once (leaving the calendar view empty), or allow it unconditionally? → A: Allow it unconditionally, with no confirmation step. It's instantly and fully reversible (FR-008), the calendar's existing empty-state already covers "nothing to show," and a blocking guard would contradict this feature's "fast, frictionless toggle" purpose for a self-inflicted, trivially-undone state.
- Q: While hidden, should a source or type still be selectable/assignable in the rest of the app (e.g. as a display-type choice when editing an event or a connection, or a source shown in other pickers), or should hidden items be excluded from such pickers too? → A: Remain fully selectable everywhere else. Hiding is scoped strictly to calendar-view rendering (FR-003/FR-004); excluding hidden items from pickers would conflate "hidden from the calendar" with "removed from the app," and would make a hidden item harder to find in order to unhide it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hide a Noisy Calendar Source (Priority: P1)

A user has connected several calendars (e.g. a personal WebCal feed and a work CalDAV account) but only wants to see one of them right now, without disconnecting or reconfiguring the other. From wherever they're already looking at their sources, they flip a single toggle to hide it; its events immediately disappear from every calendar view. Later, they toggle it back on and everything reappears exactly as configured.

**Why this priority**: This is the core value of the feature — decluttering the calendar without the friction (and data loss risk) of deleting and re-adding a connection. It's the smallest slice that's independently useful.

**Independent Test**: With two or more connected sources producing events in the visible date range, hide one source and verify none of its events appear in month, week, day, or agenda views while the other source's events are unaffected. Unhide it and verify its events reappear.

**Acceptance Scenarios**:

1. **Given** a connected source with events in the current view, **When** the user hides that source, **Then** none of its events appear in any calendar view (month/week/day/agenda).
2. **Given** a hidden source, **When** the user views the source in its management list, **Then** it is still listed with its full configuration (name, color, credentials) intact and visibly marked as hidden.
3. **Given** a hidden source, **When** the user unhides it, **Then** its events reappear in all calendar views without needing a page reload or re-adding the connection.

---

### User Story 2 - Hide a Display Type (Priority: P1)

A user has a display type (e.g. "Focus time") that's cluttering their view of the week. Rather than deleting the type — which is also applied via calendar-level and default fallback rules and would affect how other events are styled — they hide it. Every event that currently renders with that type, regardless of how it got that type, disappears from the calendar until they unhide it.

**Why this priority**: Equally core to the feature as source-hiding; types are the other axis of "what's cluttering my calendar." Symmetric priority with User Story 1.

**Independent Test**: With events resolving to a given display type (directly, via calendar-level fallback, or via the application default), hide that type and verify all such events disappear from every calendar view, while events of other types remain visible. Unhide it and verify they reappear.

**Acceptance Scenarios**:

1. **Given** a display type used by one or more currently-visible events, **When** the user hides that type, **Then** every event that currently resolves to that type disappears from all calendar views.
2. **Given** a hidden display type, **When** the user views it in the settings list, **Then** it is still listed with its full configuration (label, color, icon, style) intact and visibly marked as hidden.
3. **Given** a hidden display type, **When** the user unhides it, **Then** all affected events reappear immediately.

---

### User Story 3 - Toggle Visibility Without Leaving the Calendar (Priority: P2)

While actively browsing the calendar, a user wants to quiet down a source or type without navigating away to a settings page and back. A compact, always-available list of sources and types with a one-click toggle is reachable directly from the calendar screen.

**Why this priority**: This is what makes the feature "quick" rather than just "possible" — without it, hiding something requires a trip to Settings, which is functionally what already exists today for related state (e.g. per-type editing) and wouldn't be a new capability worth calling out. It depends on Stories 1 and 2 already working.

**Independent Test**: From the main calendar screen (not the settings page), locate a source or type in the always-visible quick list, toggle its visibility, and confirm the effect on calendar views without navigating to another page.

**Acceptance Scenarios**:

1. **Given** the user is viewing the calendar, **When** they open the quick list, **Then** every configured source and every display type is listed with its current hidden/visible state.
2. **Given** the quick list, **When** the user toggles an item, **Then** the calendar view updates immediately and the toggle's own control reflects the new state.

---

### Edge Cases

- What happens when a user hides every source and every type? The calendar simply shows its existing "no events" empty state — there is no restriction on hiding everything, and it's trivially reversible.
- What happens when a source with zero events in the current date range is hidden? No visible change occurs immediately, but future events from it also stay hidden until unhidden.
- What happens when a hidden source is later deleted entirely? It's removed like any other source; hiding is not a precondition for or obstacle to deletion.
- What happens when a hidden display type is later deleted entirely? Existing deletion behavior (and any confirmation about events/sources using it) is unaffected by the hidden flag; deletion proceeds as it does for a visible type today.
- What happens to an event whose source is hidden but whose display type is visible (or vice versa)? Hiding either one is sufficient to hide the event — the two filters are independent and either can suppress it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to mark any individual connected calendar source as hidden or visible via a single, immediately-effective toggle.
- **FR-002**: Users MUST be able to mark any individual display type as hidden or visible via a single, immediately-effective toggle.
- **FR-003**: When a source is hidden, System MUST exclude every event originating from that source from all calendar views (month, week, day, agenda), regardless of that event's display type.
- **FR-004**: When a display type is hidden, System MUST exclude every event that currently resolves to that display type from all calendar views, regardless of whether the type was assigned directly to the event, applied via calendar-level fallback, or applied via the application's default type.
- **FR-005**: Hiding a source or a display type MUST NOT alter, remove, or reset any of its stored configuration (name, URL/credentials, color, label, icon, style, etc.) — hidden items remain fully intact and fully editable.
- **FR-006**: System MUST make the hidden/visible state of every source and every display type visible at a glance everywhere that source or type is listed (both the quick-access list reachable from the calendar screen and the settings management lists), including a visible indication (e.g. dimmed styling) distinguishing hidden items from visible ones.
- **FR-007**: Toggling a source's or type's visibility MUST take effect across all calendar views immediately, without a page reload or manual refresh.
- **FR-008**: Hiding MUST be trivially reversible — unhiding restores an item to exactly the same visible state and styling it had before it was hidden, with no data loss.
- **FR-009**: System MUST allow any number of sources and types to be hidden simultaneously, including all of them at once, without error.
- **FR-010**: The hidden/visible state of each source and each type MUST persist across page reloads and application restarts, the same way the rest of that source's or type's configuration already does.

### Key Entities

- **Connection (existing)**: A configured calendar source (WebCal or CalDAV). Gains a hidden/visible state that controls whether its events are ever rendered, independent of its other configuration.
- **Display Type / EventType (existing)**: A named color/icon/style definition applied to events. Gains a hidden/visible state that controls whether events resolving to it are ever rendered, independent of its other configuration.
- **Calendar Event (existing)**: Evaluated at render time against both its source's and its resolved display type's hidden state; suppressed from all views if either is hidden.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can hide or unhide any single source or display type in one interaction (one click/tap on its toggle), from either the calendar screen or the settings page.
- **SC-002**: Hiding or unhiding a source or type is reflected in every open calendar view within the same interaction — no separate refresh step is ever needed.
- **SC-003**: 100% of events belonging to a hidden source, or resolving to a hidden display type, are absent from month, week, day, and agenda views at all times while hidden.
- **SC-004**: A user can locate the hidden/visible state of any source or type at a glance, from both the quick-access list and the settings list, without opening an edit form.
- **SC-005**: Unhiding a previously-hidden source or type fully restores its prior visible behavior with zero configuration loss, verified immediately after toggling.

## Assumptions

- "Data sources" refers to the existing connection concept (WebCal subscriptions and CalDAV accounts); "display types" refers to the existing named event-type concept. No new entity types are introduced.
- Hiding is a pure display-time filter, not a data-layer change: hidden sources' events may still be fetched/cached in the background (or not — this is an implementation detail left to the plan), but they are never rendered while hidden.
- There is no permissions/multi-user dimension to this feature — hidden state is local per installation, same as the rest of the app's settings.
- The quick-access list mentioned in User Story 3 lives in the always-visible calendar chrome (the sidebar), since that's the only currently-visible, persistent surface during calendar browsing; this is an implementation placement decision, not a new UI concept.
- No new top-level navigation, page, or entity management (create/delete) is introduced by this feature — it strictly adds a visibility toggle to sources and types that already exist and are already manageable elsewhere.
- Hidden sources and types remain fully selectable everywhere else in the app (event-type pickers, connection pickers, etc.) — hidden only ever means "excluded from calendar-view rendering," never "excluded from the rest of the app."
