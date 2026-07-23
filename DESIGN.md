---
name: web-cal
description: A dense, legible personal calendar dashboard where every event's look is resolved by user rules, never by its source.
colors:
  primary: "#3e50f4"
  primary-dark: "#5666f5"
  neutral-bg: "#fafafa"
  neutral-bg-dark: "#12151c"
  neutral-card: "#ffffff"
  neutral-card-dark: "#191c24"
  neutral-fg: "#1a1c23"
  neutral-fg-dark: "#e8eaed"
  neutral-muted-fg: "#686f7d"
  neutral-border: "#e2e4e9"
  neutral-border-dark: "#272b35"
  status-destructive: "#d31212"
  status-destructive-dark: "#dc2828"
typography:
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    letterSpacing: "0.05em"
  mono:
    fontFamily: "DM Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  none: "0rem"
  sm: "0.375rem"
  md: "0.75rem"
  lg: "1.25rem"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-fg}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  badge:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.625rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-fg}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
---

# Design System: web-cal

## Overview

**Creative North Star: "The Personal Dashboard"**

Dense, simple, and legible — with legibility earned *through* customization rather than in spite of it. The interface itself carries almost no fixed opinion about color: the user's own choices (accent hue, font, corner radius, and, above all, the rules that assign a display type to each event) are what make the calendar legible to *them* specifically. The shell stays warm and approachable — soft corners, calm neutrals, no sharp edges or technical chrome — so the customization surface reads as a personal instrument, not a generic SaaS settings page.

Almost every piece of interface text runs at 12px or smaller; hierarchy comes from weight, case, and color, not from large type jumps. This is deliberate: the app's job is to stay out of the way of a dense grid of events, so its own chrome whispers.

**Key Characteristics:**
- Warm and approachable, not clinical — rounded corners, calm neutrals, one accent used sparingly.
- Dense-but-legible: small type (mostly 12px), tight row padding, weight/case carry hierarchy instead of size.
- Near-flat: shadows are reserved for things that float above the calendar (dialogs, popovers, toasts), never for resting chrome.
- Personalization is structural, not decorative: accent color, font, and corner radius are all runtime-resolved theme variables, never hardcoded.

## Colors

One accent, warm neutrals, no invented secondary/tertiary hues — the palette stays intentionally quiet so user-assigned event colors are what actually carries color meaning on screen.

### Primary
- **Confident Indigo** (`#3e50f4` light / `#5666f5` dark): the *shipped default* accent — selection state (current day, focus ring), primary actions, and links. Not a fixed brand hue.

**The Accent Is Yours Rule.** The primary/accent color is a user-chosen theme variable resolved at runtime (`resolveThemeCssVars`, `src/lib/theme.ts`), never a hardcoded hex in a component. Indigo is only the default new users see; no component should assume this specific hue is permanent, and no visual guidance in this file should be read as "must be indigo."

### Neutral
- **Paper** (`#fafafa` light / `#12151c` dark): app background.
- **Card** (`#ffffff` light / `#191c24` dark): raised surfaces — dialogs, drawers, popovers, the sidebar.
- **Ink** (`#1a1c23` light / `#e8eaed` dark): default text.
- **Quiet Gray** (`#686f7d`): secondary/muted text — timestamps, helper copy, section labels before their uppercase treatment. Darkened from an earlier `#7a8190` after the global-ui-rework critique measured it at 3.75–3.91:1 against Paper/Card, below WCAG AA's 4.5:1 for normal-size text; `#686f7d` clears ~4.8–5.0:1 at the same hue.
- **Hairline** (`#e2e4e9` light / `#272b35` dark): borders, dividers, input outlines. Always thin (1px), never used to imply depth.
- **Alert Red** (`#d31212` light / `#dc2828` dark): destructive actions and error states only — the one non-accent color the system owns outright. Light-mode value darkened from an earlier `#ef4343` (3.78:1 with white text, below AA) to ~5.4:1.

**The Event Color Is Data Rule.** Per-event-type colors (the palette a user picks in the display-type editor) are user content, not system tokens — they are deliberately excluded from this file's palette. The system's own chrome never competes with them for attention.

## Typography

**Body Font:** DM Sans (with system sans-serif fallback)
**Label/Mono Font:** DM Mono, used only for keyboard-shortcut badges (`<kbd>`)

**Character:** Both font and body-text scale are user-configurable (theme editor offers ~140 curated Google Fonts families plus the shipped DM Sans/DM Mono pairing); DM Sans is the default — a plain, warm, highly legible grotesque with no display flourish, matching the "quiet chrome" philosophy.

### Hierarchy
- **Headline** (600, 0.875rem/14px, 1.3 line-height): the current page/month title and dialog titles. Used sparingly — this is close to the largest type in the whole app.
- **Body** (400, 0.75rem/12px, 1.4 line-height): the default for nearly everything — sidebar rows, event chip labels, form copy, settings text.
- **Label** (600, 0.625rem/10px, uppercase, 0.05em tracking): section headers only (`PRESETS`, `SOURCES`, `TYPES`) and calendar weekday abbreviations. Muted-gray, never the accent color.
- **Mono** (500, 0.75rem/12px, DM Mono): keyboard-shortcut badges exclusively — the one place a second typeface is allowed, to visually mark "this is a key, not text."

### Named Rules
**The Whisper Label Rule.** Section labels run at 10px uppercase with wide tracking specifically so they read as structural scaffolding, not content — never scale a label up to compete with real event data.

## Layout

Three zones: a fixed-width left sidebar (mini calendar, then stacked `Presets` / `Sources` / `Types` sections, each under a whisper-label header, with a pinned bottom bar for avatar/keyboard-help/settings), a fluid calendar grid as the dominant content area, and a right-side Sheet/Drawer (not a full-screen modal) for settings panels — chosen specifically so editing a display type or theme previews live against the still-visible calendar.

Density is tight by design: sidebar rows use `gap-2 px-2 py-1.5`, calendar cells stay compact, and per-row actions (hide/show, edit) are hover-revealed rather than always-on chrome, so a dense list of sources/types/events doesn't out-noise the calendar itself. On narrow viewports the header condenses to icon-only controls and the brand wordmark hides — the calendar grid is the one thing that's never sacrificed.

## Elevation & Depth

Flat by default. Resting chrome — buttons, sidebar rows, inputs, the calendar grid itself — carries at most a 1px hairline border and a near-invisible `shadow-xs`; there is no ambient drop shadow vocabulary for things sitting on the canvas. Real elevation (`shadow-md`/`shadow-lg`) is reserved for content that floats *above* the canvas: dialogs, popovers, and toasts, which also get a scale/fade-in entrance motion to reinforce that they're temporarily lifted.

### Named Rules
**The Flat Canvas Rule.** If it's part of the calendar's resting layout, it stays flat. If it's floating above the calendar (dialog, popover, toast, dropdown), it may cast a shadow. Nothing in between.

## Shapes

Corners are soft everywhere by default (no sharp rectangles) — but exactly how soft is itself a user setting, not a fixed opinion. A single `--radius` variable (theme-editor presets: **Aucun** 0rem, **Discret** 0.375rem, **Défaut** 0.75rem, **Arrondi** 1.25rem) drives every rounded corner in the app, from buttons to dialogs. Small circular elements — avatar-style event badges, status dots, the today-indicator — always use a full `9999px` pill regardless of the global radius setting, since those are meant to read as dots/tokens, not boxed content.

## Components

Buttons, inputs, and panels stay **tactile and warm**: soft rounded corners, gently-tinted hover states (`hover:bg-muted`, `hover:brightness-90`), and a small active-state press (`active:scale-95`) on interactive chips — nothing sharp, nothing that feels like a dense enterprise data table.

### Buttons
- **Shape:** rounded corners at the small step of the global radius scale (`rounded-md`, ≈0.375–0.75rem depending on theme).
- **Primary:** solid accent fill, white text, `h-9 px-4` (36px tall); hover darkens 10% (`hover:bg-primary/90`).
- **Outline / Secondary / Ghost:** hairline border or no fill at rest; hover fills with the neutral `accent` tint, never the brand accent color itself.
- **Destructive:** same shape language, `Alert Red` fill — reserved exclusively for delete/remove confirmations.

### Chips & Badges
- **Event chip (block style):** solid event-type color, white text, `rounded-md`, `active:scale-95` + `hover:brightness-90` — the one place in the UI where color is 100% user data.
- **Small icon badges** (event-type dot in the sidebar row): background is the event color at ~12% opacity (`color + "20"`), icon/text drawn in the full-strength color on top — a tint, not a fill, so dense rows of many types stay calm.

**The Tinted Icon Rule.** Small inline status/type indicators use a `color + 20% alpha` background tint rather than a solid fill; solid fill is reserved for the larger, single-focus event chip itself.

### Cards / Containers
- **Sidebar rows** (source/type list items): `rounded-lg`, transparent at rest, `hover:bg-muted`; per-row actions (hide, edit) fade in on hover/focus rather than sitting visible by default.
- **Settings drawer (Sheet):** slides in from the right, card-colored background, left hairline border — deliberately a partial-width panel, not a full-screen takeover, so the calendar stays visible and live-previews theme/type changes as you edit.
- **Dialogs:** centered, `rounded-lg`, `shadow-lg`, scale+fade entrance (200ms) — used for content that needs full focus (add/edit a connection).

### Inputs / Fields
- **Style:** hairline border, transparent background, `rounded-md`, `h-9`.
- **Focus:** a single 1px accent-colored ring (`ring-1 ring-ring`) — no border-color shift, no glow.

### Navigation
- **Header:** icon menu-toggle + brand wordmark (hidden on narrow viewports) on the left, view switcher (Month/Week/Day/Agenda) as a segmented control on the right.
- **Sidebar:** mini month calendar, then labeled sections (whisper-label headers), then a pinned bottom row (user avatar circle, keyboard-shortcuts help, settings gear) that stays anchored regardless of list length above it.

### Signature Component: Event Chip
The one component the whole product exists to support. `EventChip` renders one of three ways — a full-width colored **block** with title, a small circular **avatar badge** pinned to a cell corner, or nothing at all when the type is styled as a **day tint** (the parent grid cell paints itself instead) — and which of the three it uses is resolved entirely by the ordered rules engine, never by which calendar the event came from. Documenting its color as a fixed token would misrepresent the product; its defining trait is that the color is never fixed.

## Do's and Don'ts

### Do:
- **Do** resolve every color, font, and radius through the theme CSS variables (`resolveThemeCssVars`) — never hardcode a hex, a font-family string, or a `rounded-*` pixel value in a new component.
- **Do** default new interface text to `text-xs` (12px); reserve `text-sm`/`headline` for page and dialog titles only.
- **Do** use the `color + 20%`-alpha tint pattern for small inline icon badges, and reserve solid color fills for the primary event chip.
- **Do** keep settings/customization panels (theme editor, rules, display types) feeling like the product's main instrument, not a generic buried settings page — this is the actual differentiator, treat it with the same craft as the calendar grid.

### Don't:
- **Don't** add a drop shadow to anything sitting flat on the calendar canvas (rows, buttons, the grid itself) — shadows are reserved for content floating above it (dialogs, popovers, toasts).
- **Don't** introduce a second accent hue or a fixed "brand color" anywhere — the accent is a per-user variable, and a hardcoded second hue would fight it.
- **Don't** let the customization UI drift toward generic-SaaS visual sameness (heavy card grids of toggles, gradient headers) — keep it warm, compact, and specific to this app's density-first character.
