# Feature Specification: Global Theming

**Feature Branch**: `005-global-theming`
**Created**: 2026-07-22
**Status**: Draft
**Input**: User description: "Global theming — replace the light/dark-only toggle with a theme selector; allow creating/saving more than two named themes."

## Clarifications

### Session 2026-07-22

- Q: Where should theme creation/editing (name, base mode, accent color, delete) live — a dialog reachable from the header selector, or a new tab in the Settings page (matching the existing "Types d'événements" tab pattern)? → A: A dialog reachable directly from the header theme selector. Rationale: keeps the feature self-contained to the header component (matches "reachable from the header" in the original ask), avoids growing the Settings page for a feature that is really about a single popover-driven control, and mirrors the existing `AddConnectionModal` dialog-from-a-trigger pattern already used in this codebase.
- Q: The app already persists a `darkMode: boolean` preference for existing users under `proton-cal:ui`. When this feature ships, should that prior preference carry over? → A: Yes — on first load after upgrade, if no theme selection has been made yet, a persisted `darkMode: true` maps to selecting the built-in "Dark" theme (and `false`/absent maps to "Light"). This is a one-time initialization read, not an ongoing sync between the two stores.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch Between Themes (Priority: P1)

A user who currently toggles between light and dark mode wants a quicker way to pick from several saved looks — not just two. From the header, they open a theme selector, see a list of named themes (starting with built-in "Light" and "Dark"), and pick one. The whole app immediately re-renders in that theme, and the choice is remembered the next time they open the app.

**Why this priority**: This replaces the existing toggle behavior 1:1 (at minimum) and is the baseline that every other story builds on. Without it, there is no selector to attach custom themes to.

**Independent Test**: Can be fully tested by opening the theme selector, choosing "Dark", confirming the whole app switches appearance, reloading the page, and confirming "Dark" is still active.

**Acceptance Scenarios**:

1. **Given** the app is showing the default "Light" theme, **When** the user opens the theme selector and chooses "Dark", **Then** the app immediately switches to the dark appearance and the selector reflects "Dark" as active.
2. **Given** a user has selected a theme, **When** they reload the page or reopen the app later, **Then** the previously selected theme is still active.
3. **Given** the theme selector is open, **When** the user views the list, **Then** both built-in themes ("Light", "Dark") are always present, in addition to any custom themes the user has created.

---

### User Story 2 - Create and Name a Custom Theme (Priority: P2)

A user wants a look that isn't just plain light or dark — e.g., a dark theme with a green accent instead of the default indigo. They create a new theme, give it a name, choose a base mode (light or dark) and an accent color, save it, and it appears in the selector alongside the built-in themes for future use.

**Why this priority**: This is the actual new capability the feature exists to deliver — going from a fixed binary choice to user-defined, saved themes. It depends on US1 existing as the mechanism that applies and lists themes.

**Independent Test**: Can be fully tested by creating a theme named "Forest" with a dark base and a green accent, saving it, confirming it appears in the selector, selecting it, and confirming the app renders with a dark background and green accent color (e.g. on primary buttons and the active view-switcher tab).

**Acceptance Scenarios**:

1. **Given** the user opens the "create theme" action from the selector, **When** they enter a name, pick a base mode, pick an accent color, and save, **Then** the new theme appears in the selector list and can be selected.
2. **Given** the user is creating a theme, **When** they leave the name blank, **Then** the system prevents saving and indicates a name is required.
3. **Given** the user is creating a theme, **When** they choose a name matching an existing theme (built-in or custom), **Then** the system prevents saving and shows an error.
4. **Given** a new custom theme has been saved, **When** the user selects it, **Then** the app's background/surface colors follow the chosen base mode and the app's accent/primary color follows the chosen accent throughout the UI (buttons, active states, focus rings).

---

### User Story 3 - Edit and Delete Custom Themes (Priority: P3)

A user revisits a custom theme they made earlier and wants to tweak its accent color, rename it, or remove it entirely because they no longer use it.

**Why this priority**: Editing and deleting are natural follow-ons to creation but aren't required for the core value (having more than two themes to switch between) to exist — a user can always delete-and-recreate in their absence, so this is lower priority than US1/US2.

**Independent Test**: Can be fully tested by editing an existing custom theme's accent color and confirming the change applies immediately if it's the active theme, then deleting a different custom theme and confirming it disappears from the selector.

**Acceptance Scenarios**:

1. **Given** a custom theme exists, **When** the user edits its name, base mode, or accent color and saves, **Then** the selector reflects the updated name and, if that theme is currently active, the app appearance updates immediately.
2. **Given** a custom theme exists and is currently selected, **When** the user deletes it, **Then** the app falls back to the "Light" built-in theme and the deleted theme no longer appears in the selector.
3. **Given** the built-in "Light" or "Dark" theme, **When** the user views the selector, **Then** no edit or delete action is offered for built-in themes.

---

### Edge Cases

- What happens when a user deletes the theme that is currently active? → The app falls back to the built-in "Light" theme (see US3 Acceptance Scenario 2).
- What happens if a user has zero custom themes? → The selector shows only the two built-in themes ("Light", "Dark"); this is the default out-of-the-box state.
- What happens when a user tries to save a custom theme with the exact same name as a built-in theme ("Light" or "Dark")? → Prevented, same as any other duplicate name (case-insensitive match).
- How does the system handle a very large number of custom themes? → The selector remains scrollable/usable; no hard cap is imposed in this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a theme selector, reachable from the header, replacing the previous two-state light/dark toggle button.
- **FR-002**: System MUST ship two built-in themes named "Light" and "Dark" that are always present in the selector and cannot be edited or deleted.
- **FR-003**: Users MUST be able to create a new custom theme by specifying: a unique name, a base mode (light or dark), and an accent color.
- **FR-004**: System MUST apply the active theme's base mode and accent color across the entire application UI (not a single screen), consistently with how the previous light/dark toggle applied app-wide.
- **FR-005**: System MUST persist the user's currently selected theme across page reloads and app restarts.
- **FR-006**: System MUST persist all user-created custom themes across page reloads and app restarts.
- **FR-007**: Users MUST be able to edit an existing custom theme's name, base mode, and accent color.
- **FR-008**: Users MUST be able to delete a custom theme they created.
- **FR-009**: System MUST prevent saving a theme (new or edited) whose name duplicates another existing theme's name, case-insensitively, including the two built-in names.
- **FR-010**: System MUST require a non-empty name to save a custom theme.
- **FR-011**: When the active theme is deleted, system MUST fall back to the built-in "Light" theme.
- **FR-012**: Selecting a theme MUST take effect immediately, without requiring a page reload.
- **FR-013**: Theme creation, editing, and deletion MUST be reachable from the same header theme selector as a dialog — no separate settings page section is required for this feature.
- **FR-014**: On first load after this feature ships, if the user has never made an explicit theme selection, the system MUST honor their prior light/dark preference (if one was previously saved) by initializing the selected theme to "Dark" or "Light" accordingly, rather than defaulting silently to "Light".

### Key Entities *(include if feature involves data)*

- **Theme**: A named, saved appearance configuration. Attributes: unique id, display name, base mode (`light` | `dark`), accent color (a single color value applied as the app's primary/accent color). Two themes ("Light", "Dark") are built-in (system-provided, not stored as user data, not editable/deletable); any additional themes are user-created, named, and stored.
- **Theme Selection**: The currently active theme, referenced by id, persisted so it survives reloads.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch the app's entire visual appearance to a different saved theme in 2 clicks or fewer from any screen.
- **SC-002**: Users can create a new named custom theme (name + base mode + accent color) and see it available for selection in under 30 seconds.
- **SC-003**: 100% of previously light/dark-toggle-only functionality (instant, app-wide, persisted appearance switching) is preserved after the toggle is replaced by the selector.
- **SC-004**: A user can maintain 5 or more custom themes simultaneously without any degradation in selector usability or app load time.
- **SC-005**: The active theme choice survives a full page reload and a new browser session 100% of the time.

## Assumptions

- A "theme" in this feature's scope is limited to a base mode (light or dark) plus a single accent/primary color, matching the CSS-variable-driven token set already present in the app (background/foreground/card/primary/secondary/muted/accent/border/etc.), where the accent color drives the primary/accent-family tokens and the base mode drives the light/dark surface tokens. Full per-token palette editing is out of scope.
- Built-in "Light" and "Dark" themes correspond exactly to the app's existing default light and dark appearances (no visual change to those two).
- Theme data is local to the browser/device (localStorage), consistent with how existing preferences (dark mode, event types, connections) are stored; no account sync or cross-device theme sharing is in scope.
- No limit is placed on the number of custom themes a user may create in this feature.
- Renaming or restyling a theme that is currently in use elsewhere (e.g. referenced by nothing else in this app) has no side effects beyond updating its own appearance, since themes are not referenced by other entities (unlike event types).
