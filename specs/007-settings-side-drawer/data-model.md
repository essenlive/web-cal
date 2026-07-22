# Phase 1 Data Model: Settings Side Drawer

Per the spec's Key Entities section, this feature is presentation-only and introduces no new domain entities — it does not change the shape of `Connection`, `EventType`, `Rule`, `Theme`, or preference fields (`weekStartsOnMonday`, `use24h`, `dateFormatEU`).

The only new state is transient UI state (not a persisted domain entity):

## `ActiveDrawer` (UI state, added to `useUIStore`)

| Field | Type | Notes |
|---|---|---|
| `panel` | `"connection" \| "eventType" \| "rules" \| "theme" \| "preferences"` | Which settings surface the drawer is currently showing. `null`/absent when the drawer is closed. |
| `editId` | `string \| undefined` | ID of the existing `Connection`/`EventType` being edited, when applicable. Absent means "create new" for panels that support both (connection, event type). |

**Lifecycle**: Set by `openDrawer(panel, editId?)`, cleared by `closeDrawer()`. Not persisted (excluded from `useUIStore`'s `partialize`) — a page refresh always starts with the drawer closed, matching current modal behavior (modals don't reopen on refresh today either).

**Invariant**: At most one `ActiveDrawer` value exists at a time (it's a single field, not a stack), which is what makes FR-005 (no stacked panels) true by construction.
