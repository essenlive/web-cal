# UI Contract: Connection Settings Screen

**Branch**: `001-cloud-calendar-connector` | **Date**: 2026-03-30
**Scope**: The "Data Sources" section within Settings (`/settings`)

---

## Screen: Data Sources Settings

Replaces the existing "Backend" settings tab. Accessible at the same route/tab position.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Data Sources                         [+ Add Source] │
├─────────────────────────────────────────────────────┤
│  ● Work Calendar        CalDAV  [active]   [Remove]  │
│  ● Personal Holidays    WebCal  [active]   [Remove]  │
│  ● Team Shared          CalDAV  [error ⚠] [Remove]  │
├─────────────────────────────────────────────────────┤
│  (empty state when no connections)                   │
│  No data sources connected.                          │
│  Add a WebCal subscription or CalDAV account above.  │
└─────────────────────────────────────────────────────┘
```

### Connection Row

Each row in the list exposes:

| Element | Content | Behaviour |
|---------|---------|-----------|
| Colour swatch | 16×16 circle in `connection.color` | Static |
| Name | `connection.name` (truncated at 40 chars with ellipsis) | Static |
| Type badge | `"WebCal"` or `"CalDAV"` (pill, muted style) | Static |
| Status badge | `"active"` (green), `"error"` (amber + warning icon), `"loading"` (spinner), `"unchecked"` (grey) | Updates on each fetch |
| Remove button | Icon button (trash/x icon) | Opens inline confirmation: "Remove [name]? This will hide all its events." → [Cancel] [Remove] |

**Accessibility**: Each row is a `<li>` with `role="listitem"`. Remove button has `aria-label="Remove [name]"`. Status badge has `role="status"` and `aria-live="polite"`.

---

## Dialog: Add Connection

Triggered by the `[+ Add Source]` button. Uses Radix UI `Dialog`.

### Step 1 — Choose Type

```
┌────────────────────────────────────────┐
│  Add Calendar Source              [×]  │
├────────────────────────────────────────┤
│  Source type                           │
│  ┌──────────────┐  ┌────────────────┐  │
│  │  ○  WebCal   │  │  ○  CalDAV     │  │
│  │  ICS feed    │  │  CalDAV server │  │
│  └──────────────┘  └────────────────┘  │
├────────────────────────────────────────┤
│                           [Next →]     │
└────────────────────────────────────────┘
```

- Default selection: WebCal
- [Next →] advances to Step 2 (same dialog, form swaps in-place)

### Step 2a — WebCal Form

```
┌────────────────────────────────────────┐
│  Add WebCal Source                [×]  │
├────────────────────────────────────────┤
│  Name *                                │
│  [________________________]            │
│                                        │
│  Calendar URL *                        │
│  [________________________]            │
│  webcal:// or https:// URL to .ics     │
│                                        │
│  Colour                                │
│  [● ● ● ● ● ● ● ●]  (8 swatches)      │
│                                        │
│  ▼ Advanced                            │
│    CORS Proxy URL (optional)           │
│    [________________________]          │
├────────────────────────────────────────┤
│  [← Back]          [Test] [Add Source] │
└────────────────────────────────────────┘
```

### Step 2b — CalDAV Form

```
┌────────────────────────────────────────┐
│  Add CalDAV Source                [×]  │
├────────────────────────────────────────┤
│  Name *                                │
│  [________________________]            │
│                                        │
│  Server URL *                          │
│  [________________________]            │
│  e.g. https://nextcloud.example/dav/   │
│                                        │
│  Username *                            │
│  [________________________]            │
│                                        │
│  Password / App Password *             │
│  [________________________]  (masked)  │
│                                        │
│  Colour                                │
│  [● ● ● ● ● ● ● ●]  (8 swatches)      │
│                                        │
│  ▼ Advanced                            │
│    CORS Proxy URL (optional)           │
│    [________________________]          │
├────────────────────────────────────────┤
│  [← Back]          [Test] [Add Source] │
└────────────────────────────────────────┘
```

### Form Validation Rules

| Field | Rule |
|-------|------|
| Name | Required, non-empty, max 80 chars |
| URL (WebCal) | Required; must start with `https://`, `http://`, or `webcal://` |
| URL (CalDAV) | Required; must start with `https://` or `http://` |
| Username | Required for CalDAV |
| Password | Required for CalDAV; rendered as `type="password"` |
| Colour | Pre-selected (first unused palette colour); required |
| Proxy URL | Optional; if provided must start with `https://` or `http://` |

### [Test] Button Behaviour

| State | Visual |
|-------|--------|
| Idle | `[Test]` button enabled |
| Testing | Button disabled, spinner icon, label "Testing…" |
| Success | Green check icon + "Connection OK" inline message (3 s then reset) |
| Failure | Amber alert icon + short error message (e.g. "Could not reach server") |

Test does NOT save the connection — it only validates connectivity.

### [Add Source] Button Behaviour

- Disabled until all required fields pass validation.
- On click: validates, generates UUID for `id`, dispatches `addConnection()`, closes dialog.
- New connection appears immediately in the list with `status: "unchecked"`.
- `DataProviderContext` re-instantiates `MultiSourceProvider` on next render cycle, triggering a fetch.

### Keyboard & Accessibility

- Dialog traps focus while open (Radix default behaviour).
- `[×]` close button and `Escape` both dismiss without saving.
- All form inputs have associated `<label>` elements.
- Error messages linked via `aria-describedby`.
- Colour swatches keyboard-navigable with arrow keys; selected swatch has `aria-pressed="true"`.

---

## Component Props Contracts

### `<ConnectionList>`

```typescript
interface ConnectionListProps {
  connections: Connection[];
  statusMap: ConnectionStatusMap;
  onRemove: (id: string) => void;
}
```

### `<AddConnectionModal>`

```typescript
interface AddConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (conn: Omit<Connection, "id">) => void;
  existingColors: string[];  // for auto-selecting next unused palette color
}
```

### `<ConnectionRow>` (internal to ConnectionList)

```typescript
interface ConnectionRowProps {
  connection: Connection;
  status: ConnectionStatus;
  onRemove: (id: string) => void;
}
```
