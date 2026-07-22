# Feature Specification: View Presets

**Feature Branch**: `006-view-presets`
**Created**: 2026-07-22
**Status**: Draft
**Input**: User description: "Presets — save and switch between named combinations of source & type visibility (e.g. \"Work\": only work calendar; \"Personal\": only personal events). This is the foundational piece for the upcoming keyboard-shortcut preset switching (1/2/3…) and URL-encoded view state, both of which depend on presets existing first."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save the current visibility state as a preset (Priority: P1)

A user has hidden some calendar connections and event types via the existing show/hide controls so that only the sources and types relevant to a context (e.g. "Work") remain visible. They want to save this exact combination under a name so they can return to it later without re-toggling everything by hand.

**Why this priority**: Without the ability to save a state, there is nothing to switch to — this is the foundation the rest of the feature depends on.

**Independent Test**: Hide a subset of connections/event types, save the current state as a preset named "Work", then change visibility again — the saved preset still exists and reflects the state at the time it was saved.

**Acceptance Scenarios**:

1. **Given** the user has some connections and event types hidden and some visible, **When** they save the current state under a new name, **Then** a preset is created that records the hidden/visible state of every connection and event type at that moment.
2. **Given** a preset name the user wants to reuse, **When** they save a new preset with a name that already exists, **Then** the system asks them to confirm before overwriting, or requires a distinct name.

---

### User Story 2 - Apply a saved preset (Priority: P2)

A user who has saved presets for different contexts wants to switch between them quickly — picking "Work" to see only work-related sources and types, then later picking "Personal" to switch the view instantly.

**Why this priority**: This is the payoff of the feature — once presets can be saved, applying them is what delivers day-to-day value, and it's also the behavior the future keyboard-shortcut feature (1/2/3…) will trigger.

**Independent Test**: With at least two presets saved with different visibility combinations, selecting each preset in turn changes which connections/event types are shown, matching exactly what was saved.

**Acceptance Scenarios**:

1. **Given** a saved preset, **When** the user applies it, **Then** every connection and event type's visibility is set to match the state recorded in that preset.
2. **Given** a preset that was saved before a connection or event type was later deleted, **When** the user applies that preset, **Then** the deleted item is silently skipped and the rest of the preset is applied without error.
3. **Given** the user applies a preset, **When** they then manually toggle a connection or event type's visibility, **Then** the manual change takes effect immediately and does not alter the saved preset (presets only change when explicitly re-saved).

---

### User Story 3 - Manage saved presets (Priority: P3)

A user wants to rename a preset that no longer reflects its purpose, update a preset to capture a new combination under the same name, or delete a preset they no longer need.

**Why this priority**: Necessary for the feature to remain usable over time, but the feature already delivers value with P1+P2 alone; management is a refinement.

**Independent Test**: With one or more presets saved, rename one, update another to the current visibility state, and delete a third — each operation is reflected immediately in the list of saved presets.

**Acceptance Scenarios**:

1. **Given** an existing preset, **When** the user renames it, **Then** it appears under the new name and still applies the same visibility state as before.
2. **Given** an existing preset and a new current visibility state, **When** the user chooses to update that preset, **Then** the preset now records the new state, discarding the old one.
3. **Given** an existing preset, **When** the user deletes it, **Then** it no longer appears in the list of saved presets and can no longer be applied.

---

### Edge Cases

- What happens when the user has no saved presets yet? The preset list is empty and only the "save current state as a new preset" action is available.
- What happens when a user tries to save a preset with an empty or whitespace-only name? The system rejects it and asks for a valid name.
- What happens when every connection and event type is hidden and the user saves that as a preset? It is saved and can be applied like any other (an "all hidden" state is valid).
- What happens when a new connection or event type is added after a preset was saved, then that preset is applied later? The new item is left at its current visibility (not forced hidden or shown), since the preset has no recorded state for it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save the current visibility state of all calendar connections and event types as a new named preset.
- **FR-002**: Users MUST be able to view a list of all saved presets by name.
- **FR-003**: Users MUST be able to apply a saved preset, which sets every connection's and event type's visibility to match the state recorded in that preset.
- **FR-004**: When a preset is applied and it references a connection or event type that no longer exists, the system MUST skip that reference without error and apply the rest of the preset.
- **FR-005**: When a preset is applied and the current connections/event types include items that did not exist when the preset was saved, the system MUST leave those items' visibility unchanged.
- **FR-006**: Users MUST be able to rename an existing preset without altering the visibility state it applies.
- **FR-007**: Users MUST be able to update an existing preset to replace its recorded state with the current visibility state.
- **FR-008**: Users MUST be able to delete an existing preset.
- **FR-009**: The system MUST reject preset names that are empty or whitespace-only.
- **FR-010**: The system MUST prevent two presets from silently sharing the same name — on a naming conflict, the user MUST be asked to confirm an overwrite or choose a different name.
- **FR-011**: Saved presets MUST persist across browser sessions.
- **FR-012**: Applying a preset MUST NOT alter the preset itself; presets only change when the user explicitly saves or updates them.

### Key Entities

- **Preset**: A named, saved combination of visibility state. Attributes: name (unique, non-empty), and for each connection and event type that existed at save time, whether it was hidden or visible. Presets are ordered (order of creation), since that order is what the future keyboard-shortcut feature (1/2/3…) will map to.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch from one saved visibility combination to another in a single action, rather than manually toggling each connection and event type.
- **SC-002**: Saved presets remain available and apply correctly after closing and reopening the app.
- **SC-003**: Applying a preset never produces an error state, even when the underlying connections/event types have changed since the preset was saved.
- **SC-004**: A user managing 2-5 presets can save, apply, rename, update, and delete any of them without needing to consult documentation.

## Assumptions

- A preset captures only calendar-connection and event-type visibility (the "source & type visibility" described in the request) — it does not capture the current calendar view (month/week/day), the visible date, or theme settings. Those are addressed by separate backlog items (URL-encoded views, keyboard shortcuts) that build on top of this feature.
- There is no fixed limit on the number of presets a user can save; typical usage is expected to be a handful (2-5), matching the small number of connections and event types typical users already have.
- Presets are global to the app (not per-device or per-user-account), consistent with how connections and event types are already stored today.
- No confirmation step is required before applying a preset (applying is treated the same as the existing individual show/hide toggles — low-friction and instantly reversible by applying a different preset or toggling manually).
