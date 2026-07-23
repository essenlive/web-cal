---
target: global UI rework (whole app)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-07-23T13-19-15Z
slug: global-ui-rework
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The "styled by the default rule, no rule matched" message is buried one click deep per-event; the grid itself never signals when a configured color isn't actually applied. |
| 2 | Match Between System and Real World | 2 | Consistently French, except raw English mid-flow at two core moments: adding a source and building a rule. |
| 3 | User Control and Freedom | 3 | Explicit Cancel/X everywhere, arm-then-confirm delete, digit-`0` clears presets, Esc-friendly dialogs. |
| 4 | Consistency and Standards | 1 | Language switches mid-app (`AddConnectionModal`, `RuleModal`, `RulesPage`, built-in theme names), plus a scattered set of off-scale font-size literals the detector caught (see below). |
| 5 | Error Prevention | 3 | Arm→confirm on every delete, regex validation on rule patterns, default-type deletion blocked with an inline reason, "Test" before committing a new source. |
| 6 | Recognition Rather Than Recall | 2 | Header hamburger has no `aria-label` (inconsistent with every other icon button in the sidebar); type→color mapping requires investigation rather than being shown. |
| 7 | Flexibility and Efficiency of Use | 3 | Real keyboard shortcuts (view switch, date nav, preset toggle), URL state sync. No bulk actions on rules/types/connections. |
| 8 | Aesthetic and Minimalist Design | 3 | DESIGN.md's whisper-label/flat-canvas system is faithfully executed, but the product's signature "color = meaning" move is currently invisible on screen. |
| 9 | Error Recovery | 2 | Inline invalid-regex and duplicate-rule messages exist and are clear, but themselves in English; not exercised end-to-end for connection sync errors. |
| 10 | Help and Documentation | 3 | The shortcuts panel and inline "Where do I find this?" disclosure are contextual and task-focused. |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** Mixed, and the split is diagnostic. The structural design is genuinely authored for this product — the sidebar's Presets → Sources → Types stack, the Sheet-based drawer that keeps the calendar live behind it, and `EventDetail`'s "styled by the default rule" transparency with an inline "create a rule from this event" shortcut are bespoke to the rules-engine premise. But the populated experience contradicts that differentiator: both the zero-config demo data and the `/dev` "Débordement" scenario resolve every event to the same blue "Meeting" block, because the shipped rule set is just the catch-all rule. A first-time user — exactly the audience `PRODUCT.md` says must be sold with zero setup — sees a monochrome calendar next to six colorful, entirely unused Type entries in the sidebar. That reads as "generic dashboard with an idle color picker," not "the rules-driven calendar." Compounding this, four surfaces (`AddConnectionModal`, `RuleModal`, `RulesPage`, built-in theme names) are hardcoded in English while the rest of the app is French — several features shipped independently without a final consistency pass.

**Deterministic scan:** `detect.mjs --json src` (55 files, single pass) returned exit code 2, 43 findings: 33 `design-system-font-size`, 8 `design-system-color`, 1 `design-system-font`, 1 `side-tab`. Cross-checking against the code: all 8 color findings and the 1 font finding are false positives — the flagged colors are exactly the per-event-type user data DESIGN.md's "Event Color Is Data Rule" deliberately excludes from the system palette (`store/index.ts` default type swatches), and the flagged "font" is a dynamic Google Fonts URL builder that's supposed to accept arbitrary user-picked families. The `side-tab` finding is a color-legend swatch in the `/dev`-only developer harness, not production chrome — also likely a false positive. That leaves **33 genuine `design-system-font-size` findings** — literal `text-[9px]`/`text-[11px]`/`text-[8px]` values across `MonthView.tsx`, `TimeGridView.tsx`, `EventTypeModal.tsx`, `PresetSelector.tsx`, `Sidebar.tsx`, `RulesPage.tsx`, and the `/dev` showcase — that don't match DESIGN.md's documented 10px/12px/14px type ramp. This is a real, detector-caught Consistency issue the LLM review didn't quantify at this granularity.

**Visual overlays:** Browser-console overlay injection was attempted but failed: the project's Playwright driver (`run-web-cal/driver.mjs`) has no `evaluate`/script-injection command, so `detect.js` was never injected into a live page and no `impeccable`-prefixed console output exists. No user-visible overlay is available from this run. As a substitute, both assessments captured direct screenshots across 10+ views/states (populated month/week/agenda grids, sidebar, settings drawer, theme editor, event-type modal, rule modal, mobile viewport) with zero JS console errors on any of them.

## Overall Impression

The execution of *DESIGN.md as written* is genuinely faithful — density, flat-canvas elevation, whisper labels, and the arm→confirm interaction language are all applied consistently by a team that clearly cares about craft. The problem isn't sloppy execution; it's that the single feature the whole product exists to showcase (rules resolve an event's look, not its source) is invisible in the state every new user actually sees, and a handful of screens were shipped without the localization/consistency pass the rest of the app got. Fix the demo data and the language split, and the heuristic score jumps meaningfully — most of what's dragging it down (heuristics 1, 2, 4, 6) traces back to those two root causes plus token-level contrast issues baked into DESIGN.md itself.

## What's Working

1. **`EventDetail`'s rule-transparency + inline "create a rule from this event" shortcut** — the one place the rules-engine differentiator is actually felt, not just described, and it's tightly coupled to the real mechanic rather than a generic help link.
2. **`ActionButton`'s arm→confirm→pending→success lifecycle**, reused identically for every destructive/async action app-wide (delete connection/type/rule, export/import) — disciplined systems thinking that pays off across multiple heuristics at once.
3. **Zero JS console errors across 10+ captured states** (populated grids, drawers, dialogs, mobile viewport) and a density/elevation/label system that matches DESIGN.md's documented tokens closely and consistently.

## Priority Issues

**[P0] The default configuration never demonstrates the product's core value.**
- **Why it matters:** Zero-config demo data and the `/dev` scenario both resolve every event to the single catch-all rule → one flat blue color everywhere, in every view, while five of six seeded Types (Workshop/Focus time/Admin/Social/Deadline) sit unused in the sidebar ("Aucune règle n'utilise ce type" in each of their edit modals). This is the exact scenario PRODUCT.md says must sell the app with zero setup, and it currently sells the opposite.
- **Fix:** Seed 2–4 illustrative name/source-based rules alongside the demo data so a fresh install visibly differentiates event types on first load.
- **Suggested command:** `/impeccable onboard`

**[P0] Language inconsistency across core flows.**
- **Why it matters:** `AddConnectionModal.tsx`, `RuleModal.tsx`, `RulesPage.tsx`, and the built-in theme names are entirely English against an otherwise-French app (even mixing "Colour," the only British spelling anywhere); the week view's all-day row also reads English. This hits users at exactly the two most important workflows — adding a source, building a rule — and is the single fastest way to make a crafted product feel unfinished.
- **Fix:** Localize the flagged files to French (or, if English is the actual target, revert the rest of the app) and standardize spelling.
- **Suggested command:** `/impeccable harden`

**[P1] Contrast failures baked into the design tokens themselves, plus a missing aria-label.**
- **Why it matters:** DESIGN.md's own "Quiet Gray" (`#7a8190`) measures 3.75–3.91:1 on Paper/Card — below WCAG AA's 4.5:1 — yet is assigned to whisper labels and timestamps everywhere, mostly at 10–12px where the large-text exception doesn't apply. The destructive-button pairing (`#fff` on `#ef4343`) measures 3.78:1, also under AA. Separately, the header's hamburger icon has no `aria-label`, unlike every other icon-only control in the sidebar, breaking the screen-reader tab order right at the sidebar's entry point.
- **Fix:** Darken Quiet Gray and the destructive red until both clear 4.5:1; add the missing `aria-label`.
- **Suggested command:** `/impeccable harden`

**[P1] Mobile sidebar overlay hides its own dismiss control.**
- **Why it matters:** At 390px width the sidebar (`w-56`, `z-40`) opens by default covering ~57% of the viewport, and the header's hamburger toggle sits under the open sidebar's own stacking context — a first-time mobile visitor sees mostly chrome with no obvious way back.
- **Fix:** Default the sidebar closed under the `sm` breakpoint, or keep the toggle reachable above the open sidebar.
- **Suggested command:** `/impeccable adapt`

**[P2] Scattered off-token font-size literals (detector-caught, 33 instances).**
- **Why it matters:** `text-[9px]`/`text-[11px]`/`text-[8px]` literals across `MonthView.tsx`, `TimeGridView.tsx`, `EventTypeModal.tsx`, `PresetSelector.tsx`, `Sidebar.tsx`, and `RulesPage.tsx` don't match DESIGN.md's documented 10/12/14px ramp — a real, systematic Consistency and Standards gap the automated scan caught that the design review didn't quantify.
- **Fix:** Snap each literal to the nearest documented step (10px label / 12px body / 14px headline) or fold genuinely-needed in-between sizes into the type ramp itself.
- **Suggested command:** `/impeccable typeset`

## Persona Red Flags

**Alex (Power User):** Keyboard shortcuts are genuinely good (view-switch, date nav, preset toggle) — a rare win for this persona. But Alex's actual goal — "make my calendar reflect my rules" — is blocked by the same P0s: building a rule means navigating a Sheet with English copy dropped mid-French-flow, which reads as unfinished and erodes trust in the rest of the app's polish. No bulk-edit exists for rules/types/connections.

**Sam (Accessibility-dependent user):** The header hamburger has no `aria-label`, breaking the linear screen-reader flow at the sidebar's entry point. Whisper-label text fails 4.5:1 contrast and is used pervasively (every section header, every timestamp). The destructive delete-confirm button also fails AA contrast. Color is the sole differentiator for the "day" tint and avatar-badge event styles — a colorblind or low-vision user relying on hue alone has no icon or text fallback in those styles.

## Minor Observations

- `EventChip.tsx` and `MonthView.tsx`'s avatar badge both hardcode a `"#6366f1"` fallback color outside the theme system (reachable only when an event's type has been deleted) — a small violation of DESIGN.md's "resolve every color through theme vars" rule.
- The &gt;1 day-style overflow indicator in `MonthView.tsx` (a faint dotted underline + `bg-muted/30` tint) is easy to miss against the near-white canvas, and — per the P0 above — frequently doesn't even fire as intended today.
- The Rules list truncates "Any event (default)" mid-word inside a narrow pill — cosmetic, avoidable with a shorter default-rule label.
- Icon and color-swatch pickers in `EventTypeModal` present 10+ options at once, exceeding the ≤4-visible-options guidance — a conventional picker pattern, low priority.
- Detector false positives worth remembering for future scans: the 8 `design-system-color` findings (per-event-type user colors, correctly out of DESIGN.md's scope) and the `design-system-font` finding (dynamic Google Fonts loader) should be added to `.impeccable/critique/ignore.md` or detector config if they keep resurfacing.

## Questions to Consider

- If a brand-new user's first calendar view is the strongest argument for choosing this over Google/Fantastical, why does the zero-config path currently show the *least* differentiated version of it?
- Is the rules engine's English-only surface a deliberate boundary (power-user features stay in English) or simply unfinished localization — and if deliberate, should that boundary be made explicit and consistent rather than accidental?
- What would it look like if the calendar grid itself — not a buried per-event dialog — told you "5 of your event types aren't used by any rule yet" the first time that's true?
