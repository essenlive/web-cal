# Research: Display Type Rules Engine

**Branch**: `003-display-type-rules-engine` | **Date**: 2026-07-21

## Decision 1: Where rules slot into the existing resolution chain

**Decision**: Insert rule evaluation as a new level between the existing per-event "custom" override (Level 1) and the named-`EventType` lookup (Level 2) in `resolveEventType()` (`src/components/events/EventChip.tsx:27-62`) — but see Decision 2, which changes what Level 1 means for ingested events.

New chain:
1. `event.eventTypeId === "custom"` **and the event was explicitly hand-styled by the user** (see Decision 2) → per-event custom fields (unchanged).
2. **NEW**: Rule engine — evaluate enabled rules in priority order (array order = priority, top wins); first match's `displayTypeId` is used, skipping any rule whose target display type no longer exists (rendered as "broken" in the UI, not deleted).
3. Named `EventType` via `event.eventTypeId` (existing Level 2, unchanged).
4. `connection.displayTypeId` (existing Level 3, unchanged) — kept for backward compatibility; new source-level rules are the recommended path going forward but this field is not migrated or removed.
5. Per-connection color fallback (existing "custom" injection from `multi-source-provider.ts`, now conditional — see Decision 2).
6. App default type (existing Level 4, unchanged).

**Rationale**: The spec's own precedence (event-id rule > name rule > source rule) has to outrank the legacy mechanisms it's meant to extend, or it would never be visible to users — matches the spec's Story 1 acceptance criteria ("every existing and future event ... renders with that display type" unconditionally, not "unless the event already has a type").

**Alternatives considered**: Making rules a fallback *below* the legacy per-event/per-connection assignment (rejected — it would make rules pointless: users would have to first clear an event's default type before a name-pattern rule could ever apply, defeating the "set it and forget it" value proposition).

## Decision 2: Pre-existing conflict with per-connection event ingestion

**Finding**: `applyConnectionMeta()` (`src/lib/multi-source-provider.ts:46-53`) unconditionally sets `eventTypeId: "custom"` + `customColor: conn.color` on **every** event returned by a real WebCal/CalDAV connection, so that connection color shows up without further configuration. Because `resolveEventType()` checks `eventTypeId === "custom"` first, this already makes the existing `connection.displayTypeId` feature (002) inert for any event that came from a live connection — and would equally block the new rule engine if left as-is, regardless of where rules are inserted in the chain below it.

**Decision**: Change `applyConnectionMeta()` to stop unconditionally forcing `eventTypeId: "custom"`. Instead, leave the provider's own `eventTypeId` (already `"meeting"` from ingestion) in place and only fall back to the connection-color "custom" behavior at *render time*, as the lowest-but-one level in the chain (Level 5 above), when nothing else — no rule, no named type override, no `connection.displayTypeId` — resolved. Concretely: `multi-source-provider.ts` stops stamping `customColor`/`eventTypeId:"custom"` on ingested events; `resolveEventType()` gains a `getSourceColorFallback` step that returns a virtual custom type using `connection.color` only when levels 1–4 all miss.

**Rationale**: This is the minimal change that un-blocks both the pre-existing 002 calendar-assignment feature and the new rule engine, without migrating any persisted data (no field renames, no new required fields) and without changing behavior for users who configure nothing (they still see events colored by connection, just via one level lower in the chain instead of level 1).

**Alternatives considered**: Leaving it broken and shipping rules as effectively inert on real data (rejected by explicit user decision — see conversation). Migrating `connection.displayTypeId` fully into the new rule model and deleting the field (rejected — larger diff, no functional benefit over keeping both, violates YAGNI/simplicity principle for this feature).

## Decision 3: Rule storage & priority model

**Decision**: One new Zustand store, `useRuleStore`, persisted at key `webcal:rules`, holding `rules: Rule[]` where **array order is priority** (index 0 = highest). Reordering (drag on the global page) is a plain array move/splice, persisted directly — no fractional-index or separate `order` field needed.

New rules are inserted (not appended) at the position implied by FR-010's default tier order (event-id > name-pattern > source) and, within a tier, newest-first (per clarification: most recently created rule in a tier defaults to the higher priority). Concretely: insert the new rule immediately before the first existing rule whose tier is strictly lower (numerically higher weight), i.e., at the top of its own tier's block.

**Rationale**: Simplest data structure that satisfies FR-009/FR-010 exactly; avoids introducing a priority-number scheme, fractional indexing, or a sort-stability edge case. Matches constitution's Simplicity & YAGNI principle.

**Alternatives considered**: Integer `priority` field with gaps for reinsertion (rejected — solves a reordering-performance problem this app doesn't have at ~100-rule scale per SC-005).

## Decision 4: Rule "broken" state

**Decision**: Not stored. A rule is broken purely if `useEventTypeStore().getType(rule.displayTypeId)` returns `undefined` — the global rules page computes and shows this live, exactly like the existing dangling-`displayTypeId`-on-connection case is already handled today (data-model.md from 002: "the field becomes a dangling reference; the resolution chain gracefully falls through").

**Rationale**: Derived state; storing a redundant boolean risks going stale. Reuses an already-established pattern in this codebase.

## Decision 5: Regex/name matching implementation

**Decision**: Plain `RegExp` construction wrapped in `try/catch` at save time (FR-007) using case-insensitive flag (`"i"`) by default. Match is `regex.test(event.title)` — a substring/partial match by nature of `RegExp.test`, satisfying the "plain text or regex" requirement without a separate text-mode branch (a literal string is itself a valid, trivial regex).

**Rationale**: No existing regex-matching utility to build on (confirmed via codebase search — the one existing `RegExp` usage is unrelated XML tag parsing in `caldav-provider.ts`). Per the clarification session, no complexity cap or execution timeout is required, so this is a direct, minimal implementation — no new dependency needed (native `RegExp` covers it, per constitution's Simplicity principle and the stdlib-first instinct).

**Alternatives considered**: A dedicated glob/fuzzy-match library (rejected — unnecessary dependency for a feature the user already asked to support via regex).

## Decision 6: Recurring-series scope (spec FR-015)

**Finding**: This codebase has no recurrence/RRULE support at all — confirmed no `recurrenceId`, `seriesId`, or RRULE expansion anywhere in `src/`. Every `CalendarEvent.id` is already a single stable identifier per stored occurrence (the iCal `UID`, namespaced per connection).

**Decision**: FR-015 ("a single-event rule must match the whole recurring series") is currently a no-op / trivially satisfied: since there is no broader series to distinguish from a single occurrence today, an event-id rule already matches exactly and only the one persisted event it targets. No additional code is needed to satisfy FR-015 as written. This should be revisited if/when recurrence support is added to the app — at that point, event-id rules will need to decide whether to key off a series identifier instead of the per-occurrence id.

**Rationale**: Avoids inventing speculative recurrence-matching logic for a data shape that doesn't exist yet (YAGNI).

## Decision 7: Catch-all rule as a real Rule row, not a hidden default

**Decision**: Extend `RuleMatchType` with `"all"`. Exactly one `matchType: "all"` rule is seeded into `useRuleStore` on first load (lazily, the way `useEventTypeStore` seeds its built-in types), always sorted last regardless of `reorderRule` calls, and its `enabled` is fixed `true` (the toggle/delete/reorder controls are hidden or disabled for this row in `RulesPage`). `findMatchingRule` no longer returns `Rule | undefined` — with the catch-all always present and always matching, it always returns a `Rule`, which collapses the old multi-level `resolveEventType()` fallback chain (Levels 3–6 in data-model.md) down to nothing: rule resolution is the *only* resolution path now.

**Rationale**: The user explicitly wants the default expressed as a visible, editable rule (auditable from the same page as everything else) rather than a separate `useUIStore().defaultEventTypeId` setting — this also deletes code rather than adding it, since the old default-type store field and the connection-color/legacy-type fallback levels all become dead once every event is guaranteed to hit a rule.

**Alternatives considered**: Keep `defaultEventTypeId` as a separate store field and treat it as an implicit Level-N fallback (rejected — two places would express "the default," which is exactly the confusion FR-024/SC-007 is meant to eliminate).

**Guard**: Deleting a display type that is the catch-all's current target must be blocked (FR-021) — there's no lower level left to fall through to. Implemented as a check in `useEventTypeStore.removeType` (or the delete-confirmation UI) before the catch-all rule was introduced this check didn't need to exist because Level 6 (`defaultEventTypeId`) never pointed at a type; now that the catch-all *is* the last resort, it must always point at something real.

## Decision 8: Replace hand-rolled ICS parsing with `ical.js`

**Finding**: `src/lib/webcal-provider.ts`'s `parseICS`/`icsDateToISO`/`parseICSValue` (~90 lines) is a minimal line-scanner that doesn't handle folded lines (RFC 5545 line continuation), `TZID`-qualified `DTSTART`/`DTEND`, or RRULE expansion, and re-implements value unescaping by hand.

**Decision**: Add `ical.js` and replace the three functions with calls into it (`ICAL.parse` → `ICAL.Component` → `ICAL.Event`), keeping the same `parseICS(text: string): CalendarEvent[]` signature so `webcal-provider.ts`'s caller and the CORS proxy path are unaffected.

**Rationale**: This is an explicit exception to the base feature's "no new dependencies" constraint (see plan.md amendment) — the gaps above are correctness bugs in real-world feeds, not speculative robustness, and reimplementing RFC 5545 folding/escaping/timezone handling by hand is exactly the kind of wheel-reinvention the constitution's stdlib-first principle argues against once a well-maintained library exists.

**Alternatives considered**: `node-ical` (rejected — wraps `ical.js` plus Node-specific fs/network helpers this browser-only app doesn't need); keep hand-rolling and patch bugs as found (rejected — the gaps are structural to line-by-line scanning, not one-off bugs).

## Decision 9: Searchable combobox built on existing Radix Popover

**Decision**: No `cmdk`/combobox library is added. A small `Combobox` primitive (`src/components/ui/combobox.tsx`) is built from the already-installed `@radix-ui/react-popover` + a plain filtered `<input>`/list — single-select only, per the 2026-07-22 clarification. Used by `RuleModal` wherever `matchType` is `"event"` (options = `useEventsStore()` events, labeled by title) or `"source"` (options = `useConnectionStore()` connections, labeled by name).

**Rationale**: `cmdk` would be the "proper" answer if fuzzy search, keyboard nav, and grouping were all needed, but a single-select searchable list over at most a few hundred events/connections is a substring filter over an already-installed `Popover` — matches the constitution's Simplicity/YAGNI principle and Decision 5's "no new dependency needed" precedent for a comparably small string-matching need.

**Alternatives considered**: `cmdk` (rejected — new dependency for filtering a list shorter than what `Array.prototype.filter` handles instantly); native `<datalist>` (rejected — no control over label vs. value display, poor styling control, inconsistent browser behavior for showing all options on focus).

## Decision 10: Resolution chain collapses to one mandatory level

**Decision**: With per-event custom styling removed (FR-017), `connection.displayTypeId` removed (FR-018), and a mandatory catch-all rule always matching (Decision 7), `resolveEventType()` no longer needs Levels 1, 4, 5, or 6 from the original data-model.md chain. It becomes: call `findMatchingRule(event, rules)` (now non-optional return), then `getType(matchedRule.displayTypeId)`. The only remaining fallback is the broken-rule skip (FR-013): if the returned rule's display type was deleted, fall through to the next matching rule, which — because the catch-all can never be broken (Decision 7's guard) — always terminates.

**Rationale**: Direct consequence of the other decisions in this amendment; called out separately because it's a net deletion of code in `EventChip.tsx`, not just a rewiring — the `getConnection` parameter to `resolveEventType()` becomes unused and can be dropped.

## Technology choices confirmed (no new dependencies)

- **Framework**: Next.js 15 App Router (confirmed current stack post-migration; constitution's Vite reference predates the migration and is a pre-existing doc drift, not something this feature needs to fix).
- **State**: Zustand 5 with `persist` middleware, following the exact pattern of `useEventTypeStore`/`useConnectionStore`.
- **UI**: Existing shadcn/ui primitives (`dialog`, `input`, `label`, `switch`, `tabs`) plus the Sidebar's existing row-list + modal pattern (`ConnectionRow`/`TypeRow` in `src/components/sidebar/Sidebar.tsx`) as the template for rule rows; drag-reorder can reuse plain HTML5 drag-and-drop (no new drag library — none is currently installed and the interaction is simple list reordering).
- **Regex**: Native `RegExp`, no new dependency.
