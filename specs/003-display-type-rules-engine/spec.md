# Feature Specification: Display Type Rules Engine

**Feature Branch**: `003-display-type-rules-engine`
**Created**: 2026-07-21
**Status**: Draft
**Input**: User description: "Rules-based matching engine between calendar events and display types. Users can define rules that match events by unique event ID, calendar/connection source, or event title regex/text match, and each matching rule resolves to a specific display type for that event. Rules can be created and managed from three entry points: the event modal, the source/connection modal, and a dedicated global rules page. When multiple rules match, a precedence order resolves the conflict. Rules persist alongside existing event types and connections data."

## Clarifications

### Session 2026-07-21

- Q: What scale should the rule-matching engine be designed to handle well? → A: Moderate scale — up to ~100 rules, several thousand events rendered at once — still fine with a simple linear scan per event.
- Q: Should the system guard against pathological (catastrophic-backtracking) regex patterns beyond basic syntax validation? → A: No — syntax validation at save time (FR-007) is sufficient; no complexity cap or runtime timeout is required.
- Q: When two or more rules share the same default tier (e.g., two name-pattern rules) and the user hasn't manually reordered them, which wins by default? → A: The most recently created rule in that tier wins by default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Style Recurring-by-Name Events from the Event Modal (Priority: P1)

A user opens an event that keeps recurring under the same title but isn't a true calendar-recurring series (e.g., a "Dentist" appointment booked separately each time, or "1:1 with Sam" created ad hoc). From that event's modal, they create a rule that says "events titled like this get display type X" so every future and existing event matching that title is styled consistently without manual repetition.

**Why this priority**: This is the scenario the existing direct per-event and per-calendar assignment cannot solve — it's the core new value the rules engine adds. It requires no separate management page to deliver value, making it the smallest usable slice.

**Independent Test**: Can be fully tested by opening any event, creating a name-match rule with a chosen display type, and verifying every event (current and future) whose title matches renders with that display type.

**Acceptance Scenarios**:

1. **Given** a user has an event open, **When** they create a rule matching the event's exact title (or a custom pattern) and choose a display type, **Then** every existing and future event whose title matches renders with that display type.
2. **Given** the open event belongs to a recurring series, **When** the user creates a single-event rule from it, **Then** the rule matches the whole series (all past and future occurrences), not just the occurrence they had open.
3. **Given** a user enters an invalid regular expression as the match pattern, **When** they attempt to save the rule, **Then** the system rejects the save and explains the pattern is invalid.

---

### User Story 2 - Style All Events from a Calendar Source (Priority: P2)

A user opens the settings for one of their connected calendars (e.g., a shared team calendar) and creates a rule so that every event from that source uses a given display type, without touching individual events.

**Why this priority**: Source-wide styling is high value and mirrors the existing calendar-level assignment, but expressed as a rule it now composes with name-based and event-specific rules instead of being a single exclusive setting — that composition is this feature's differentiator over the prior simpler assignment.

**Independent Test**: Can be fully tested by opening a connection's settings, creating a source rule with a display type, and verifying all events from that source render with it, while events from other sources are unaffected.

**Acceptance Scenarios**:

1. **Given** a connected calendar source, **When** the user creates a rule assigning a display type to that source, **Then** all events from that source render with the chosen display type.
2. **Given** a source rule exists, **When** the user deletes the underlying connection, **Then** the rule is removed along with it and no longer appears anywhere rules are listed.

---

### User Story 3 - Manage All Rules from a Global Page (Priority: P3)

A user visits a dedicated rules page listing every rule regardless of where it was created, showing its match type, pattern/target, resulting display type, and priority. They can reorder, enable/disable, edit, or delete any rule from this single place.

**Why this priority**: This is the control-panel view that makes the rule set auditable and resolves conflicts explicitly. It depends on rules already being creatable (P1/P2) to have anything to manage, so it's ordered after them, but it's necessary for users to trust and untangle a growing rule set.

**Independent Test**: Can be fully tested by creating rules from the other two entry points, then opening the global page and verifying all of them appear, and that reordering, disabling, and deleting each work and take effect immediately on affected events.

**Acceptance Scenarios**:

1. **Given** rules exist from any entry point, **When** the user opens the global rules page, **Then** every rule is listed with its match criteria, target display type, and current priority order.
2. **Given** two or more rules in the list, **When** the user drags a rule to a new position, **Then** its priority updates and events matching multiple rules immediately re-render using the new highest-priority match.
3. **Given** a rule in the list, **When** the user disables it (without deleting), **Then** affected events immediately stop using it and fall through to the next matching rule or the default display.
4. **Given** a rule whose target display type is later deleted, **When** the user views the rules page, **Then** the rule is flagged as broken and reverts affected events to the default display until fixed or removed.

---

### Edge Cases

- What happens when an event matches two or more rules of the same match type (e.g., two overlapping name-regex rules)? Resolved by the user-defined priority order in the global list (Story 3).
- What happens when a rule's calendar source is deleted? The rule is deleted with it (Story 2, scenario 2).
- What happens when a rule's target display type is deleted? The rule remains but is flagged as broken and the event falls back to default display (Story 3, scenario 4).
- What happens when a name-regex pattern matches zero events at creation time? The rule is still saved as-is and applies automatically if a matching event appears later.
- What happens when a user creates a duplicate rule (same match type + same pattern/value + same display type)? The system warns and prevents the exact duplicate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to create a rule that matches a single, specific event and assigns it a display type.
- **FR-002**: System MUST allow a user to create a rule that matches events by a text/regular-expression pattern against the event title, and assigns matching events a display type.
- **FR-003**: System MUST allow a user to create a rule that matches all events from a given calendar/connection source and assigns them a display type.
- **FR-004**: Users MUST be able to create rules from an individual event's modal, pre-filled with that event's identity and title for convenience.
- **FR-005**: Users MUST be able to create rules from a calendar/connection's settings modal, pre-filled with that source.
- **FR-006**: Users MUST be able to view, create, edit, reorder, enable/disable, and delete every rule from a single global rules page, regardless of where each rule was originally created.
- **FR-007**: System MUST validate regular-expression patterns at save time and reject invalid patterns with an explanatory message.
- **FR-008**: System MUST prevent saving an exact duplicate rule (same match type, same match value, same target display type).
- **FR-009**: When multiple enabled rules match the same event, system MUST resolve the conflict using a single, consistent priority order and apply only the highest-priority match's display type.
- **FR-010**: System MUST default new rules into the priority order such that single-event rules outrank name-pattern rules, which outrank source-wide rules; within the same tier, the most recently created rule MUST default to the higher priority; users MUST be able to override this default ordering explicitly from the global rules page.
- **FR-011**: System MUST re-evaluate and re-render affected events immediately whenever a rule is created, edited, reordered, enabled, disabled, or deleted.
- **FR-012**: System MUST automatically delete any source rule when its underlying calendar/connection is deleted.
- **FR-013**: System MUST NOT delete a rule when its target display type is deleted; instead it MUST flag the rule as broken/unresolved and affected events MUST fall back to the application's default display (or the next lower-priority matching rule, if any) until the rule is fixed or removed.
- **FR-014**: System MUST persist rules alongside existing display type and connection data so they survive reloads and remain available across all three management entry points.
- **FR-015**: A single-event rule created from an event that belongs to a recurring series MUST match the whole series (all past and future occurrences), not just the one occurrence the user had open when creating the rule.

### Key Entities

- **Rule**: A user-defined instruction mapping a match condition to a display type. Attributes: match type (single event / source / name pattern), match value (an event's unique identity, a source's identity, or a text/regex pattern), target display type, priority/order, enabled state, broken/unresolved flag (set when its target display type no longer exists), and where it was created from (for display purposes only — all rules are editable from the global page regardless of origin).
- **Display Type** *(existing)*: The named color/icon/style definition a rule resolves an event to; unchanged by this feature except that it may now be referenced by zero or more rules in addition to direct assignments.
- **Event**: A calendar event evaluated against the full rule set at render time to determine its effective display type.
- **Calendar/Connection Source** *(existing)*: The calendar feed an event originates from; usable as a rule's match target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a rule from any of the three entry points (event modal, source modal, global page) and see it take effect on all matching events in under 5 seconds, with no page reload required.
- **SC-002**: 100% of events are styled according to the single, deterministic highest-priority matching rule — no event ever shows conflicting or flickering styles between two matching rules.
- **SC-003**: Users can locate and resolve any rule conflict (e.g., two rules fighting over one event's style) entirely from the global rules page, without needing to inspect individual events or sources.
- **SC-004**: Deleting a calendar source or a display type never leaves the application in a broken visual state — affected rules are either cleanly removed or clearly flagged, and affected events always render with a valid fallback display.
- **SC-005**: Matching remains instantaneous (no perceptible delay) with up to ~100 rules evaluated against several thousand rendered events at once.

## Assumptions

- This feature extends (does not replace) the existing display-types system: display types themselves are still defined and edited via existing Settings UI; this feature only adds the rule layer that decides which display type applies to which events.
- The three creation entry points are convenience shortcuts that pre-fill a new rule's match type and value; the resulting rule is a first-class record fully editable afterward from the global rules page, with no restriction tying it back to its origin.
- Name/title matching is case-insensitive by default and supports plain substring text as well as full regular expressions, since users are unlikely to know regex syntax by default but the underlying description explicitly calls for regex support.
- There is no hard limit on the number of rules a user can create; the global rules page is expected to remain usable via reordering, enabling/disabling, and deletion rather than a cap.
- Rules apply retroactively to already-existing events matching their condition, not only to newly-created events going forward.
- Rules and their priority order are stored per user/installation alongside existing event-types and connections data (i.e., in the same local persistence layer), with no server-side sync beyond what already exists for those entities.
- No safeguard against pathological regex patterns (e.g., complexity caps, execution timeouts) is required beyond the syntax validation in FR-007, since patterns are self-authored by the same user affected by them.

---

## Amendment (2026-07-22): Read-Only Sources & Mandatory Rule Resolution

**Input**: User description: "Remove event add/edit — sources are read-only, all styling is client-side. Remove default display styles on sources; all styling must go through the rules engine. The rules engine must always have a default catch-all rule. Remove per-event custom display styles. Use a searchable combobox (not a raw ID field) for event/source rule targets. Use a library like ical.js for .ics parsing. Show, per event, which rule applied and its priority."

This amendment removes two mechanisms the original 003 spec deliberately kept for backward compatibility (per-event custom styling, `connection.displayTypeId`) now that the rule engine is proven out, makes the rule engine the *only* path to a display style, and adds transparency (which rule fired) and two implementation-quality upgrades (a real combobox, a real ICS parser).

### Clarifications

#### Session 2026-07-22

- Q: Should the event/source rule picker support selecting multiple events or sources in a single rule? → A: No — single-select only. `Rule.matchValue` stays a single string; only the input changes from a raw-ID text field to a searchable dropdown showing the event's title or the source's name.

### User Scenarios & Testing *(additions)*

#### User Story 4 - See Which Rule Styled an Event (Priority: P2)

A user looks at an event and wants to know why it's styled the way it is — was it matched by a specific rule, and which one, or is it just using the catch-all default?

**Why this priority**: Once rules can stack and reorder (Story 3), understanding *why* a given event looks the way it does is what makes the system debuggable instead of a black box. It depends on rules already resolving events (Foundational + Story 1/2) but doesn't require the full management page.

**Independent Test**: Open any event's read-only detail view and confirm it names the exact rule that determined its style (or "default" when only the catch-all matched) along with that rule's position in the priority order.

**Acceptance Scenarios**:

1. **Given** an event matches a specific rule, **When** the user views that event's detail, **Then** the view names the matching rule (its match type and value) and its priority position.
2. **Given** an event matches no specific rule, **When** the user views that event's detail, **Then** the view indicates the catch-all/default rule is what applied.

#### User Story 5 - Guaranteed Default Style (Priority: P1)

A user should never see an event with no visual style at all — the system always has a fallback, expressed as a real, visible rule rather than a hidden default setting.

**Why this priority**: Without this, deleting or breaking rules could leave events unstyled; it's foundational, not incremental, so every other story depends on it existing.

**Independent Test**: With zero user-created rules, every event still renders using the catch-all rule's display type; changing the catch-all rule's display type restyles every event that isn't matched by a more specific rule.

**Acceptance Scenarios**:

1. **Given** no other rule matches an event, **When** the event is rendered, **Then** it uses the catch-all rule's display type.
2. **Given** the catch-all rule exists, **When** the user views the global rules page, **Then** it is listed last, cannot be disabled, deleted, or reordered, but its target display type can be changed.
3. **Given** the catch-all rule targets a display type, **When** the user attempts to delete that display type, **Then** the system blocks the deletion and prompts them to reassign the catch-all rule first.

### Edge Cases *(additions)*

- What happens when a user tries to delete the display type the catch-all rule targets? Blocked — see Story 5, scenario 3 (this is stricter than FR-013's "flag as broken" handling for non-catch-all rules, because the catch-all has nowhere further to fall through to).
- What happens when zero specific rules exist at all? Every event still resolves via the catch-all rule (Story 5, scenario 1) — there is no "unstyled" state.
- What happens when a user searches for an event/source in the rule-target combobox and nothing matches? The combobox shows an empty state; the rule cannot be saved without a selection.

### Requirements *(additions)*

- **FR-016**: System MUST NOT provide any UI to create or edit a calendar event. All connected sources (WebCal, CalDAV) are read-only; display styling is computed entirely client-side by the rules engine and never written back to the source.
- **FR-017**: System MUST NOT support per-event custom display-style overrides. Every event's display style MUST be resolved exclusively through the rules engine (no `eventTypeId: "custom"` escape hatch).
- **FR-018**: System MUST NOT support a per-source default display type configured outside the rules engine. A source-wide style MUST be expressed as a `matchType: "source"` rule.
- **FR-019**: The rules engine MUST include exactly one non-deletable, always-enabled catch-all rule that matches every event and is evaluated only after every other enabled, non-broken rule — guaranteeing every event resolves to a display type without a separate application-level default setting.
- **FR-020**: Users MUST be able to change the catch-all rule's target display type from the global rules page; they MUST NOT be able to delete, disable, or reorder it above any other rule.
- **FR-021**: System MUST prevent deleting a display type that is the catch-all rule's current target, and MUST prompt the user to reassign the catch-all rule to a different display type first.
- **FR-022**: When creating or editing a rule with `matchType: "event"` or `matchType: "source"`, the match value MUST be chosen from a searchable dropdown listing events by title / sources by name (single selection) — never entered or displayed as a raw ID.
- **FR-023**: System MUST parse `.ics` calendar data using a standards-compliant iCalendar parsing library rather than bespoke line-by-line parsing.
- **FR-024**: For any rendered event, the user MUST be able to see which rule determined its current display style (the specific rule, or the catch-all) and that rule's priority position among all rules.

**Supersedes**: FR-004's "event modal" becomes a read-only event detail view — same pre-fill behavior for rule creation, different name, no editing affordance. FR-013's "falls back to the application's default display" now means "falls through to the next matching rule, terminating at the catch-all rule" — there is no longer a separate app-level default setting distinct from a rule.

### Key Entities *(changes)*

- **Rule**: `matchType` gains a fourth value, `"all"` (the catch-all). Exactly one `matchType: "all"` rule always exists, is seeded on first load, cannot be deleted or disabled, and is always evaluated last.
- **CalendarEvent** *(existing, amended)*: `eventTypeId: "custom"` and its `customColor`/`customIcon`/`customAllDayStyle`/`customTimedStyle` fields are removed — no per-event override path remains.
- **Connection** *(existing, amended)*: `displayTypeId` is removed — a source's style is expressed as a rule, not a field on the connection.
- **Display Type** *(existing)*: unchanged, except it cannot be deleted while it is the catch-all rule's target (FR-021).

### Success Criteria *(additions)*

- **SC-006**: Every event, at all times, resolves to exactly one display type with no "unstyled" state possible — verified by the catch-all rule always being present and evaluated.
- **SC-007**: A user can determine which rule produced any event's current style, and that rule's priority, without leaving the event's own detail view.
- **SC-008**: Choosing an event or source as a rule's match target never requires knowing or typing an internal ID — it's always picked by name from a searchable list.

### Assumptions *(additions)*

- Read-only sources mean write-back (create/update/delete an event on the origin calendar) is out of scope for the foreseeable future, not merely deferred within this feature; no partial editing UI is kept "just in case."
- `ical.js` (or an equivalent standards-compliant library) is an accepted new dependency for `.ics` parsing — the constitution's "no new dependencies" preference for the base 003 feature does not extend to fixing a hand-rolled parser with known edge-case gaps (timezones, escaping, folded lines, RRULE).
- The searchable combobox is single-select and built from already-installed Radix primitives (`@radix-ui/react-popover`); no new combobox/command-palette library is required for this.
