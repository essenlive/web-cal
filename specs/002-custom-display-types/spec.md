# Feature Specification: Custom Events Display Types

**Feature Branch**: `002-custom-display-types`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User description: "Custom events display types. The users can define different display types and assign them to events or calendar. Make sure to use existing work."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign a Display Type to an Entire Calendar (Priority: P1)

A user wants all events from a specific calendar feed (e.g., their work calendar) to share a consistent visual appearance without configuring each event individually. They open the calendar's settings, choose a display type from those they've defined, and all events in that calendar immediately reflect the chosen appearance.

**Why this priority**: This is the highest-value scenario — it provides visual consistency at the source level without any per-event effort. It is the core new capability this feature introduces, since the existing system only supports assignment at the event or event-type level.

**Independent Test**: Can be fully tested by editing a calendar connection, assigning a display type, and verifying all its events render with the assigned visual appearance.

**Acceptance Scenarios**:

1. **Given** a user has defined at least one display type and has a connected calendar, **When** they open the calendar's settings and assign a display type, **Then** all events from that calendar render using that display type's color, icon, and style.
2. **Given** a calendar has a display type assigned, **When** an individual event within that calendar also has its own display type assigned, **Then** the event-level assignment takes precedence over the calendar-level one.
3. **Given** a calendar has a display type assigned, **When** the user removes the assignment, **Then** events from that calendar revert to the application's default display behavior.

---

### User Story 2 - Define and Manage Custom Display Types (Priority: P2)

A user wants to create named display types that go beyond the default set. They define a display type with a name, color, icon, and visual style for both timed and all-day events. They can later edit or delete their custom display types.

**Why this priority**: Without the ability to define display types, there is nothing to assign. This story enables the full vocabulary of visual presentations users can work with. Existing event-type infrastructure provides the foundation.

**Independent Test**: Can be fully tested by navigating to the Settings display types panel, creating a new display type with all properties, editing it, and deleting it — all without assigning it to anything.

**Acceptance Scenarios**:

1. **Given** a user opens the Settings panel, **When** they create a new display type with a name, color, icon, and timed-event style, **Then** the new type appears in all assignment selectors (event editor and calendar settings).
2. **Given** a display type exists, **When** the user edits its color or icon, **Then** all events and calendars currently using that display type immediately reflect the change.
3. **Given** a display type is assigned to one or more calendars or events, **When** the user attempts to delete it, **Then** the system warns that affected items will revert to default display before allowing deletion.
4. **Given** a display type exists with a name, **When** the user saves a second display type with the same name, **Then** the system prevents the duplicate and shows an error message.

---

### User Story 3 - Apply a Display Type to an Individual Event (Priority: P3)

A user wants a specific event to stand out visually from others in the same calendar. When creating or editing an event, they choose a display type from their defined list (or define a one-off custom appearance), and the event renders with that chosen style.

**Why this priority**: This extends an already partially-implemented capability (per-event custom color/icon) into the full display-type system. It is lower priority because the core value is at the calendar and type-definition level.

**Independent Test**: Can be fully tested by opening the event editor, selecting a display type from the defined list, saving, and verifying the event's visual appearance updates in all calendar views.

**Acceptance Scenarios**:

1. **Given** a user opens the event editor, **When** they select a defined display type from the dropdown, **Then** the event renders in all calendar views using that type's color, icon, and style for both timed and all-day contexts.
2. **Given** an event has a display type assigned, **When** the user changes the event's calendar (if it had a calendar-level display type), **Then** the explicit event-level display type continues to take precedence.
3. **Given** a user selects "Custom" in the event editor, **When** they configure a one-off color, icon, and style, **Then** the event renders with those exact properties independently of any defined display types.

---

### User Story 4 - Visual Style Applies to Both All-Day and Timed Events (Priority: P4)

A display type specifies how events look in both timed (scheduled) and all-day contexts. When a user defines a display type, they configure a style for timed events in addition to the already-supported all-day style. Both settings are respected in every calendar view.

**Why this priority**: This closes a current gap where display style only applies to all-day events — timed events always use the default block style regardless of the assigned type. Completing this makes the display type system coherent.

**Independent Test**: Can be fully tested by assigning a display type with a non-default timed style to an event and verifying its appearance in the week and day views.

**Acceptance Scenarios**:

1. **Given** a display type has a timed-event style set to "compact", **When** a timed event uses that display type, **Then** the event renders in the compact style in week and day views.
2. **Given** a display type has both an all-day style and a timed style, **When** an all-day event uses that display type, **Then** the all-day style is applied; **When** a timed event uses the same type, **Then** the timed style is applied.

---

### Edge Cases

- What happens when a display type is deleted while assigned to one or more calendars or events? Affected items revert to the application default without data loss.
- What happens when a user assigns a display type at the calendar level and a conflicting one at the event level? The event-level assignment always wins.
- What happens when all defined display types are deleted? Event and calendar selectors fall back to the default display type gracefully.
- How does the system handle a calendar with no display type assigned? It uses the event's own type, or the application default if no event-level type is set.
- What if a calendar has a display type but an event within it uses the "Custom" option? The custom per-event configuration takes priority over the calendar-level type.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to define a display type with a name, color, icon, a style for timed events, and a style for all-day events.
- **FR-002**: Users MUST be able to edit any existing display type's name, color, icon, timed-event style, and all-day style.
- **FR-003**: Users MUST be able to delete a display type, with a confirmation warning when it is in use by calendars or events.
- **FR-004**: Each display type name MUST be unique; the system MUST prevent saving a duplicate name.
- **FR-005**: Users MUST be able to assign a display type to a calendar connection from the calendar's settings.
- **FR-006**: When a calendar has an assigned display type, all events from that calendar MUST render using that type's visual properties.
- **FR-007**: Users MUST be able to assign a display type to an individual event from the event editor.
- **FR-008**: An event-level display type assignment MUST take precedence over a calendar-level assignment.
- **FR-009**: The "Custom" per-event option MUST continue to allow one-off color, icon, and timed/all-day style overrides independently of defined display types.
- **FR-010**: Timed events MUST respect the timed-event style property of their assigned display type rather than always defaulting to the block style.
- **FR-011**: Deleting a display type MUST NOT corrupt event or calendar records; affected items MUST revert to the application default display.
- **FR-012**: All display type selectors (event editor, calendar settings) MUST list the user's defined display types plus the "Custom" option.
- **FR-013**: Changes to a display type's appearance MUST propagate immediately to all events and calendars using that type without requiring manual reassignment.

### Key Entities

- **DisplayType**: A named visual configuration comprising a label, color, icon, timed-event style, and all-day style. Defined and managed by the user. Referenced by events and calendars by ID. Extends the existing event-type concept.
- **CalendarConnection**: An existing entity (WebCal or CalDAV connection). Extended with an optional display type reference that applies to all events in that calendar.
- **CalendarEvent**: An existing entity. Its display type reference field continues to support named display types as well as the "Custom" special value for per-event overrides.
- **TimedDisplayStyle**: The visual rendering mode applied to scheduled (non-all-day) events — options mirror the existing all-day display styles (avatar badges, block, etc.).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can assign a display type to a calendar in under 30 seconds from the calendar settings panel.
- **SC-002**: Users can create a new display type with all required properties in under 60 seconds from the Settings panel.
- **SC-003**: Visual appearance changes to a display type are reflected across all affected calendar views within 1 second of saving, without a page reload.
- **SC-004**: 100% of events in a calendar inherit the calendar's assigned display type unless overridden at the event level.
- **SC-005**: Zero data loss occurs when a display type in use is deleted — all affected events and calendars revert to the default display type.
- **SC-006**: All four calendar views (month, week, day, agenda) correctly render timed events according to their assigned timed-event style.

## Assumptions

- The existing event-type entity (which already holds color, icon, and all-day style) will be extended — not replaced — to become the unified display type, adding a timed-event style property.
- The existing per-event "custom" override mechanism will be extended with a timed-style override field to maintain consistency with the new timed-event style capability.
- Display types are application-level configuration and are not synced to remote calendar providers (CalDAV/WebCal).
- The initial set of timed-event styles will reuse the same visual style options already available for all-day events.
- There is no role-based access control; all users of the application share the same display type definitions.
- Existing event records using the current type references remain valid without a destructive data migration; the existing store migration mechanism will handle any necessary field additions.
- Mobile responsiveness of the Settings panel and event editor is required to match the existing application standard.
