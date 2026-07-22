# Quickstart: Display Type Rules Engine

**Branch**: `003-display-type-rules-engine` | **Date**: 2026-07-21

Manual verification steps (no automated test runner is configured in this repo — see `plan.md` Technical Context).

## 1. Name-pattern rule from an event modal

1. `npm run dev`, open any event, create a rule matching its title (e.g. exact title) targeting a distinct display type.
2. Confirm the event re-renders immediately with the new display type.
3. Create a second event (mock/demo data) with the same title elsewhere in the calendar — confirm it also renders with that display type without any manual assignment.
4. Try saving a rule with an invalid regex (e.g. unbalanced `(`) — confirm the save is rejected with an explanatory message.

## 2. Source rule from a connection modal

1. Open an existing connection's settings, create a rule assigning a display type to that source.
2. Confirm all events from that connection render with the assigned display type.
3. Delete the connection — confirm the source rule disappears from the global rules page too.

## 3. Global rules page

1. Navigate to the rules page (`/settings/rules`).
2. Confirm every rule created above is listed with its match type, value, target display type, and position.
3. Drag a lower-priority rule above a higher one; confirm an event matching both immediately switches to the newly-top rule's display type.
4. Disable a rule; confirm affected events fall through to the next matching rule (or default) immediately.
5. Delete the display type targeted by a rule (Settings → display types); confirm the rule is flagged broken on the rules page and affected events fall back to default display, without the rule itself disappearing.

## 4. Regression check on the pre-existing precedence fix

1. With no rules active, confirm a connection with a color but no `displayTypeId` still colors its events (Level 5 fallback in `data-model.md`).
2. Assign a `displayTypeId` to a connection that has no rules — confirm its events now use that type's icon/style, not just its raw color (this previously silently failed — see `research.md` Decision 2).

## Build/lint gates

```bash
npx tsc -b
npm run lint
npm run build
```
