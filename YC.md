# Rivet — YC application brief

This document is the repository’s product brief for a YC-style company
conversation. It is intentionally honest about the current product stage:
Rivet is a working browser prototype with a strong wedge, not yet a
production system of record for investment committees.

## One-liner

**Rivet is the fastest way for a founder, finance team, or investor to turn
deal assumptions into an explainable underwriting decision.**

## The problem

Underwriting is still split between intimidating spreadsheets, expensive
institutional platforms, and ad-hoc memo work. A first-pass deal review often
requires:

- Rebuilding the same LBO, DCF, returns, and sensitivity logic repeatedly.
- Explaining finance concepts to operators who do not live in Excel.
- Switching between assumptions, outputs, diligence notes, and scenario cases.
- Sharing sensitive deal data with tools that were not designed for privacy.

The result is slow iteration, inconsistent assumptions, and false confidence in
headline returns.

## The product

Rivet is a strictly web-based underwriting workspace. A user opens the app in
an ordinary browser and enters a small set of
deal facts and receives:

1. A transparent LBO-style return model.
2. A bridge showing what created the return.
3. DCF, comps, sensitivity, debt-paydown, and scenario views.
4. Base, downside, and upside cases that stay linked to the same deal.
5. Plain-English explanations for non-specialist users.
6. A local-first data boundary for early-stage, fictional, or authorized work.

The product is deliberately inspectable: the current version is plain HTML,
CSS, and JavaScript with no runtime dependency, native wrapper, install flow,
or hidden API. The browser tab is the product runtime.

## Initial wedge

The first user is the person who needs a credible answer in the next 15
minutes, not a full ERP or portfolio-management deployment:

- A founder evaluating an acquisition or financing proposal.
- A finance lead preparing an internal investment memo.
- An analyst learning LBO mechanics or preparing for a case interview.
- An independent sponsor or small fund that needs a repeatable first pass.

Rivet starts with the first-pass decision and earns the right to expand into
collaboration, source-linked diligence, and production-grade modeling later.

## Why this can become a company

- **High-frequency workflow:** Deal screening, scenario review, and IC
  preparation repeat across every transaction.
- **Clear expansion path:** Start with underwriting; add shared workspaces,
  audit trails, source citations, model templates, and team permissions.
- **Trust as a product advantage:** Explainability and local-first behavior are
  more useful than another black-box score.
- **Bottom-up distribution:** A free browser tool can spread through finance
  classes, interview prep, founder communities, independent sponsors, and
  small advisory teams.

## What is live today

- Seven linked workspaces: cockpit, LBO, DCF, returns, comps, sensitivity, and
  assumption sets.
- Base, downside, and upside case switching.
- Local exports for memo text and sensitivity CSV.
- Beginner guidance, model-status diagnostics, settings, keyboard guide, and
  responsive browser-viewport behavior.
- Privacy, security, and model-limitation documentation.

## What is intentionally not claimed

Rivet does not currently provide live market data, a complete three-statement
model, lender-grade debt terms, audited diligence, a production data room,
team collaboration, or investment advice. The current model is illustrative.
Those limits are part of the product’s trust contract, not footnotes to hide.

## Near-term roadmap

### 0–3 months: prove repeated use

- Capture anonymized, opt-in product feedback without collecting deal inputs.
- Add shareable assumption snapshots with explicit fictional/demo labeling.
- Improve economic validation and explain every return-driver calculation.
- Test the workflow with founders, independent sponsors, and finance analysts.

### 3–6 months: make it team-ready

- Add versioned model snapshots and an audit trail.
- Add source notes and diligence evidence beside assumptions.
- Add import/export formats that preserve formulas and explanations.
- Introduce a small paid team workspace only after repeated usage is proven.

### 6–12 months: expand the system of record

- Collaborative underwriting rooms with permissions.
- Reusable vertical templates and lender/IC-ready memo outputs.
- Optional connectors for authorized source data with clear provenance.
- Production-grade model review, approvals, and change history.

## Product principles

1. **Explain the why, not only the number.**
2. **Keep assumptions next to the output they change.**
3. **Make uncertainty visible.**
4. **Protect sensitive work by default.**
5. **Do not pretend an illustrative model is diligence.**

## YC conversation prompts

The repository is prepared for feedback on three questions:

1. Which user returns to this workflow often enough to pay first?
2. Which missing trust feature blocks a real deal team from using Rivet?
3. Should the wedge remain broad first-pass underwriting, or focus on one
   segment such as founder-led acquisitions or independent sponsors?
