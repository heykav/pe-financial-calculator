---
target: index.html
follows_up_on: 2026-09-11T21-55-52Z__index-html.md
method: manual verification (headless Chrome screenshots at desktop width and
  the ~500px real-device floor, computed WCAG contrast ratios, and simulated
  DOM interaction tests) - not a re-run of the original dual-agent design and
  technical audit, so the Design/Technical Health Score tables in the prior
  report are not re-scored here. Treat this file as a targeted status update
  on that report's "Priority issues" list, not a replacement critique.
timestamp: 2026-09-13T10-47-20Z
slug: index-html-followup
---

# Follow-up: status of the 2026-09-11 critique's priority issues

Re-checked every item in the prior report's "Priority issues" section
against the current code (commit history since 2026-09-11 shows real
fixes landed for several of these; this file records what's still
accurate today so the original report stops being read as current
state).

## Resolved since the original report

### [P1] 320px responsive overflow — resolved
`styles.css` now carries explicit `min-width:0` resets on
`.dashboard-grid>*`, `.bottom-grid>*`, `.bridge-bars`, `.returns-panel,
.returns-panel *`, plus a dedicated `@media(max-width:340px)` block.
Measured `document.documentElement.scrollWidth` against
`window.innerWidth` at 500/600/720/900px: no overflow at any of them
(this machine's headless Chrome floors real viewport width at ~500px,
so narrower widths weren't independently screenshotted — see the
project's own design-review conventions on that limitation).

### [P1] Muted/chart contrast below AA — resolved
Current tokens: `--muted:#b7b7c0` on `--bg:#09090b` computes to
**9.99:1**; `--faint:#9696a0` on `--bg` computes to **6.79:1** (WCAG
relative-luminance formula, computed directly, not estimated). Both
clear the 4.5:1 AA threshold for normal text with real margin. The
2026-09-11 report's ~3.9:1/~3.5:1 measurements no longer match the
current token values.

### [P2] Touch targets are too small — resolved
`.nav-item,.workspace-switcher,.data-health,.command-trigger,.button,
.chart-filter,.more-button,.full-link{min-height:44px}` and
`.icon-button,.more-button{min-width:44px;min-height:44px}` are both
present, plus `.input-wrap,.calculated{min-height:42px}`.

### [P2] Utility modal focus is incomplete — mostly resolved, one real gap fixed today
- Focus trap: already implemented (a real `Tab`/`Shift+Tab` cycle
  confined to the modal's focusable elements, in `app.js`'s global
  `keydown` handler) - confirmed by reading the code, not assumed.
- Focus restored to the trigger on close: already implemented
  (`utilityTrigger?.focus()` in `closeUtility`).
- Background inert while open: **was missing**, fixed in this repo's
  PR #1 (merged 2026-09-13) - `.app-shell` now gets `inert` set on open
  and removed on close. Verified end-to-end by loading the page,
  simulating a click on the keyboard-shortcuts trigger, and confirming
  `document.querySelector('.app-shell').hasAttribute('inert')` and
  `document.activeElement` sat inside the modal; then simulating the
  close and confirming both reversed.

## Still accurate (not addressed)

### [P2] Duplicate CSS token systems
Still present: `styles.css` has two separate `:root{}` blocks (the
original `--kavy-*` family and a later `--bg`/`--surface`/`--muted`/
etc. family), bridged via aliases like `--kavy-muted:var(--muted)` in
the second block. This means the two systems aren't drifting in most
places, but the file still carries two full token vocabularies rather
than one - a real cleanup opportunity, deliberately not touched here
since consolidating two `:root` blocks in a single pass is a real
visual-regression risk without a proper before/after screenshot diff
across every affected component, which wasn't done in this pass.

### [P2] First viewport is over-chromed / [P2] Calculation freshness is ambiguous
Both still visually true as of this check (screenshotted at desktop
width 2026-09-13): the topbar's "Saved just now", the model-status row's
"INPUT CHECKS PASS" / "Last run" / "Model type" / "Active case", the
"LIVE MODEL" chip, and the onboarding banner's "Results update as you
type; use Run underwriting when you want a clean checkpoint" all coexist
above the first assumption input. Not touched in this pass - this reads
as a deliberate, already-iterated-on information-architecture choice
(each status line does carry genuinely distinct information) rather than
an oversight, so it wasn't rewritten without a product decision on which
single freshness/status story to tell.

### [P2] Output explanations need stronger traceability, [P2] Finance-specific error recovery, [P3] Placeholder controls
Not independently re-verified in this pass. On placeholder controls
specifically: Search, Notifications, More, and "Open IC prep" all
currently produce an honest, specific toast ("Search is not connected
yet — use the workspace navigation", "No new notifications", "No
additional actions for this section yet", "IC prep is a checklist
prompt — complete the open items above") rather than a silent no-op,
which already satisfies the original suggestion's "at minimum, label
them unavailable" bar, even though the controls themselves aren't
implemented.

## Not re-scored

The original report's Design Health Score (27/40) and Technical Audit
Health Score (12/20) tables reflect a dual-agent methodology this
follow-up didn't repeat. Given the resolved items above, both totals
are very likely stale (probably understating current state on
Aesthetic/Error-prevention/Accessibility/Responsive rows specifically),
but a fresh number wasn't fabricated here - a real re-run of the
original audit method would be needed to respect those scores as
meaningful.
