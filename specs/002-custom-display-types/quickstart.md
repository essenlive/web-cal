# Quickstart: Custom Events Display Types

**Branch**: `002-custom-display-types` | **Date**: 2026-03-30

## Overview

This feature extends the existing event type system to:
1. Add a `timedStyle` property to each display type (previously timed events always used "block")
2. Allow calendar connections to specify a default display type for all their events
3. Add `customTimedStyle` for per-event custom overrides

No new dependencies. No new stores. All changes are additive to existing code.

## Development Setup

```bash
git checkout 002-custom-display-types
npm install   # no new packages needed
npm run dev   # start dev server
```

## Implementation Order

Work through changes in this order to keep the app compilable at each step:

### Step 1 — Types (src/types/index.ts)
Add the three new optional/required fields:
- `EventType.timedStyle: DisplayStyle`
- `CalendarEvent.customTimedStyle?: DisplayStyle`
- `WebCalConnection.displayTypeId?: string`
- `CalDAVConnection.displayTypeId?: string`

After this step: TypeScript will report errors everywhere `EventType` is constructed without `timedStyle`. Fix those next.

### Step 2 — Store migration (src/store/index.ts)
- Update `DEFAULT_EVENT_TYPES` to include `timedStyle: "block"` on all defaults
- Update `migrateType()` to add `timedStyle: type.timedStyle ?? "block"` on migrated records
- TypeScript errors from Step 1 resolve here for store code

### Step 3 — Event resolution (src/components/events/EventChip.tsx)
- Update `resolveEventType()` to handle `customTimedStyle`
- Extend signature to accept `getConnection` and `defaultTypeId` params
- Update `resolveStyle()`: change `if (!allDay) return "block"` → `if (!allDay) return type?.timedStyle ?? "block"`

### Step 4 — Settings: EventTypeForm (src/pages/SettingsPage.tsx)
- Add `timedStyle` state to `EventTypeForm`
- Add a style selector and preview for timed events (duplicate the all-day selector pattern)
- Add duplicate name validation before calling `onSave`
- Update `handleSave` to pass `timedStyle`

### Step 5 — Settings: Connection display type (src/components/settings/ConnectionList.tsx)
- Add `eventTypes` and `onUpdate` props to `ConnectionList` / `ConnectionListProps`
- Add a compact display type selector to `ConnectionRow`
- Wire through `BackendSettings.tsx`

### Step 6 — Event editor: customTimedStyle (src/components/events/EventModal.tsx)
- Add timed style picker in the "Custom" event type section
- Store `customTimedStyle` on the event

### Step 7 — Wire resolution in rendering components
- Pass `getConnection` and `defaultTypeId` to `resolveEventType` calls in calendar view components
- Verify the precedence chain works end-to-end

## Testing Checklist

```
[ ] Create a new display type with a non-block timedStyle → verify timed events render differently
[ ] Edit a display type's color → verify all events using it update immediately
[ ] Delete a display type in use → confirm warning appears, events gracefully fall back
[ ] Assign a display type to a calendar → verify all its events inherit the style
[ ] Assign a type to both a calendar and one of its events → verify event-level wins
[ ] Remove calendar's display type → events revert to type-level or default
[ ] Create a custom event with a non-block timedStyle → verify it renders correctly
[ ] Verify all 4 views (month, week, day, agenda) respect the new timed styles
[ ] Test in dark mode
[ ] Run: npm run build && npm run lint
```

## Key Files

| File | What changes |
|------|-------------|
| [src/types/index.ts](../../src/types/index.ts) | New fields on EventType, CalendarEvent, Connection types |
| [src/store/index.ts](../../src/store/index.ts) | migrateType(), DEFAULT_EVENT_TYPES |
| [src/components/events/EventChip.tsx](../../src/components/events/EventChip.tsx) | resolveEventType(), resolveStyle() |
| [src/pages/SettingsPage.tsx](../../src/pages/SettingsPage.tsx) | EventTypeForm: timedStyle picker + duplicate validation |
| [src/components/settings/ConnectionList.tsx](../../src/components/settings/ConnectionList.tsx) | Display type selector on connections |
| [src/components/settings/BackendSettings.tsx](../../src/components/settings/BackendSettings.tsx) | Wire onUpdate + eventTypes props |
| [src/components/events/EventModal.tsx](../../src/components/events/EventModal.tsx) | customTimedStyle picker |
