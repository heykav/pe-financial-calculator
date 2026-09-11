# Rivet — Underwriting Workspace

**A browser-native underwriting workspace that turns deal assumptions into an explainable investment view.**

[![Live demo](https://img.shields.io/badge/Live%20demo-Rivet%20Calculator-c9a24a?style=flat-square)](https://heykav.github.io/pe-financial-calculator/)
[![No build step](https://img.shields.io/badge/Build%20step-none-18181b?style=flat-square)](#run-locally)
[![License](https://img.shields.io/badge/License-see%20repository-18181b?style=flat-square)](https://github.com/heykav/pe-financial-calculator)

Rivet is an independent, dependency-free underwriting workspace designed for the first 15 minutes of a deal review. Enter a purchase price, EBITDA, borrowing level, interest rate, ownership period, and operating forecast; Rivet calculates an explainable sponsor-return view and shows what actually drives it.

Every specialist workspace includes a plain-English “start here” explanation, so a first-time user can understand what to look at before touching the technical outputs.

![KA mark used by Rivet](favicon.jpeg)

*Rivet’s KA mark and browser identity.*

> **Important:** Rivet is an educational and illustrative analysis tool, not investment advice, a valuation opinion, a regulated financial product, or a substitute for audited financial statements, quality-of-earnings work, lender diligence, legal review, tax advice, or an investment committee process.

## Table of contents

- [What the calculator does](#what-the-calculator-does)
- [Why Rivet exists](#why-rivet-exists)
- [Who it is for](#who-it-is-for)
- [How to use it](#how-to-use-it)
- [Model outputs](#model-outputs)
- [Workspaces](#workspaces)
- [Model assumptions and limitations](#model-assumptions-and-limitations)
- [Privacy and data handling](#privacy-and-data-handling)
- [Run locally](#run-locally)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [YC application brief](#yc-application-brief)
- [Independent project notice](#independent-project-notice)

## Why Rivet exists

Underwriting is still split between intimidating spreadsheets, expensive
institutional systems, and one-off memo work. Rivet gives a founder, finance
lead, analyst, or independent sponsor a fast first pass that connects:

**assumptions → operating case → capital structure → returns → what to verify**

The product is not pretending to replace diligence or an investment committee.
Its wedge is making the first decision legible, repeatable, and easier to
explain. Read [`YC.md`](YC.md) for the problem, initial user, expansion path,
roadmap, and product principles.

## Web-only product boundary

Rivet is strictly a browser web app. Open it at the hosted URL or serve the
static files locally; no native desktop or mobile wrapper, executable,
browser extension, account, backend, or installation step is part of the
product. The browser tab is the runtime and the source of truth for model
state. Responsive styling supports smaller browser windows, but does not
turn Rivet into a native application.

## What the calculator does

Rivet is a practical **finance calculator** and underwriting workspace for:

- **Leveraged buyout (LBO) analysis:** sources and uses, debt sizing, sponsor equity, debt paydown, exit equity, MOIC, and IRR.
- **Private equity returns analysis:** a clear separation between purchase price, operating performance, leverage, exit multiple, and value creation.
- **Investment banking case work:** a compact deal cockpit for interview preparation, first-pass transaction analysis, and investment-committee discussion.
- **DCF reference analysis:** an illustrative discounted cash flow bridge with present value of forecast cash flows, terminal value, WACC, and terminal growth.
- **Deal comps:** a small illustrative comparable-company table for valuation sense-checking.
- **Sensitivity analysis:** an IRR response surface across exit multiples and EBITDA growth assumptions.
- **Scenario analysis:** a deterministic return envelope that communicates lower, expected, and higher outcomes.
- **Diligence tracking:** an IC-prep checklist that distinguishes model outputs from facts that still need verification.

The app is intentionally browser-only. There is no login, backend, analytics pipeline, native wrapper, or database. Assumptions are held in the page and can be changed without sending deal information to a server.

## Who it is for

Rivet is useful for:

- Private equity associates, analysts, and operating partners learning LBO mechanics.
- Investment bankers preparing a transaction case, pitch, or interview exercise.
- Corporate development and finance teams reviewing acquisition scenarios.
- Hedge fund managers and public-markets investors who want a quick leverage and exit-sensitivity view.
- Finance students learning the relationship between EBITDA growth, debt paydown, exit multiples, MOIC, and IRR.
- Founders and operators who need a plain-English explanation of how capital structure affects equity value.

The interface is also suitable for independent interview and case-study preparation involving investment banks, private equity firms, hedge funds, and financial institutions. It does **not** represent or reproduce the proprietary methods, data, branding, or internal tools of any employer, bank, fund, or data provider.

## How to use it

1. Open the [live Rivet calculator](https://heykav.github.io/pe-financial-calculator/).
2. In **Describe the deal**, enter:
   - Purchase price / enterprise value in USD millions.
   - Current annual EBITDA in USD millions.
   - Debt / EBITDA borrowing level.
   - Annual interest rate.
   - Modeled ownership period from one to five years.
3. Select **Base case**, **Downside**, or **Upside**.
4. Enter the five-year revenue-growth and EBITDA-margin forecast.
5. Review the return output, equity bridge, debt schedule, and sensitivity grid.
6. Mark diligence items as complete only when the underlying fact has actually been verified.
7. Use **Recalculate model** for an explicit checkpoint, **Export memo** for a text summary, or **Download table** for the sensitivity CSV.

### The screen, in plain English

![Rivet workflow](https://raw.githubusercontent.com/heykav/pe-financial-calculator/main/favicon.jpeg)

The application is organized from left to right:

1. **Deal cockpit:** enter the facts you know.
2. **Potential return:** see gross MOIC and IRR.
3. **Return drivers:** understand whether growth, debt paydown, or the exit multiple did the work.
4. **What-if analysis:** test different outcomes.
5. **Diligence checklist:** separate model assumptions from verified facts.
6. **Outcome range:** review the modeled debt path and return envelope.

The sidebar opens the deeper LBO, DCF, returns, comps, sensitivity, and assumption workspaces. Settings, Model status, and Keyboard guide are available at the bottom of the sidebar.

### Keyboard guide

- `⌘ / Ctrl + 1`: Deal cockpit
- `⌘ / Ctrl + 2`: LBO model
- `⌘ / Ctrl + 3`: DCF analysis
- `⌘ / Ctrl + 4`: Returns bridge
- `⌘ K`: Open the keyboard guide
- `Esc`: Close an open utility panel

### A useful first exercise

Try a hypothetical company with a `$600mm` purchase price, `$80mm` of EBITDA, `4.0x` debt / EBITDA, `7.5%` interest, and a five-year hold. Then compare the Base, Downside, and Upside cases. Change only one assumption at a time so the return bridge remains interpretable.

## Model outputs

### Entry valuation

`Entry multiple = Purchase price / EBITDA`

This is a simple entry enterprise-value-to-EBITDA multiple. It is not a substitute for a full capitalization table or normalized EBITDA analysis.

### Debt and sponsor equity

`Entry debt = EBITDA × Debt / EBITDA`

`Sponsor equity = Purchase price − Entry debt`

The calculator applies a sanity check that debt must remain below 90% of purchase price. This is a guardrail for the illustrative model, not a lending commitment or credit decision.

### Operating forecast

The cockpit accepts five annual revenue-growth and EBITDA-margin inputs. Forecast EBITDA is derived from the starting EBITDA and the entered growth and margin assumptions. Inputs are bounded to keep the browser model finite and interpretable:

- Revenue growth: `−100%` to `100%`.
- EBITDA margin: `0%` to `100%`.
- Hold period: one to five years.

### Exit value and returns

The current illustrative model uses a simple exit-multiple convention and a simplified debt-paydown schedule. It reports:

- Exit enterprise value.
- Exit debt and exit equity.
- Gross MOIC before fees, carried interest, taxes, and transaction costs.
- Annualized IRR derived from the modeled MOIC and hold period.
- Value creation split into debt paydown, EBITDA growth, and multiple movement.

### Sensitivity and scenarios

The sensitivity grid shows how illustrative IRR changes across exit multiples and EBITDA growth rates. The scenario panel presents a deterministic lower / expected / higher return envelope; it is a communication aid, not a Monte Carlo engine calibrated to historical market data.

## Workspaces

| Workspace | Purpose |
| --- | --- |
| Deal cockpit | Plain-English starting point for assumptions and headline returns. |
| LBO model | Live-linked sources & uses, sponsor equity, debt paydown, leverage metrics, and CSV export. |
| DCF analysis | Live-linked illustrative EBITDA forecast, editable WACC/terminal growth, formula bridge, and entry-value comparison. |
| Returns bridge | Gross/before-fees MOIC and IRR with EBITDA growth, debt paydown, and multiple-movement contributions. |
| Comps library | Filterable illustrative rows plus a current-entry-multiple versus illustrative-median sanity check (not market data). |
| Sensitivity lab | Dynamically calculated gross-IRR grid across exit multiple and EBITDA growth, with CSV export. |
| Assumption sets | Selectable Base, Downside, and Upside cases linked to cockpit inputs; local copy flow without backend persistence. |

## Model assumptions and limitations

Rivet is deliberately transparent about what it does not do. It currently does **not** provide:

- A complete three-statement financial model.
- A live debt waterfall, mandatory amortization, cash sweep covenant, or financing term sheet.
- A tax model, working-capital schedule, capex schedule, or purchase-accounting model.
- A full three-statement DCF, market-data-backed comps database, or live market feed. The DCF is a simplified illustrative FCF proxy and comps are intentionally illustrative.
- Real-time market data, lender quotes, public filings, or proprietary research.
- Fund-level waterfall economics, management options, fees, carried interest, or preferred equity.
- A statistically calibrated Monte Carlo simulation.

Treat the outputs as a structured first-pass conversation starter. Replace illustrative data with diligence-backed forecasts before relying on any result.

## Privacy and data handling

Rivet runs as static HTML, CSS, and JavaScript. It does not require an account and does not transmit entered assumptions to an application server. Do not enter confidential, material non-public, personally identifiable, or restricted client information into a public browser demo.

Read [`PRIVACY.md`](PRIVACY.md) for the deployment data boundary and GDPR/CCPA-oriented privacy controls. Read [`SECURITY.md`](SECURITY.md) for security reporting and OSINT boundaries.

## Run locally

The project has no package manager, framework, or build step:

```sh
git clone https://github.com/heykav/pe-financial-calculator.git
cd pe-financial-calculator
python3 -m http.server 4173
```

Open <http://localhost:4173>.

For a quick static check:

```sh
git diff --check
```

The browser preview is the source of truth for interaction testing. Keep the console free of errors and verify desktop, tablet, and narrow responsive layouts when changing UI code.

## Project structure

```text
.
├── index.html                 # Application shell, metadata, structured data, and UI
├── app.js                    # Model calculations, state, routing, and interactions
├── styles.css                # Rivet design system and responsive layout
├── DESIGN.md                 # Visual language and component grammar
├── PRIVACY.md                # GDPR/CCPA-oriented privacy notice
├── SECURITY.md               # Privacy, OSINT boundaries, and security controls
├── favicon.jpeg              # Rivet browser icon and KA mark
├── YC.md                     # Product brief and YC-style company narrative
├── robots.txt                # Crawler guidance
├── sitemap.xml               # GitHub Pages sitemap
└── .github/
    ├── CONTRIBUTING.md       # Contribution workflow
    ├── ISSUE_TEMPLATE/       # Bug report template
    └── workflows/pages.yml   # GitHub Pages deployment
```

## Contributing

Bug reports, documentation improvements, accessibility fixes, model-review notes, and focused pull requests are welcome. Before opening a pull request:

1. Explain the user problem and the smallest complete change.
2. Keep financial formulas explicit and document any new assumption.
3. Preserve finite outputs for invalid and boundary inputs.
4. Test case switching, exports, workspace routing, and responsive layout when relevant.
5. Do not add tracking, credentials, confidential deal data, or unsupported claims.
6. Include before/after screenshots for meaningful visual changes.

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for the repository standards.
See [`SECURITY.md`](SECURITY.md) for the privacy boundary, vulnerability
reporting guidance, and ISO/IEC 27001-aligned controls.

## YC application brief

[`YC.md`](YC.md) is the concise company narrative for this repository. It
covers the problem, initial wedge, why Rivet can become a company, what is
already live, what is deliberately not claimed, and the near-term roadmap.
It should be updated whenever the product direction or target user changes.

## Independent project notice

Rivet is an independent open-source-style project maintained by its contributors. References to investment banking, private equity, hedge funds, finance roles, interview preparation, or financial institutions are descriptive search and learning context only. Rivet is not affiliated with, endorsed by, sponsored by, or operated by Verity, Wells Fargo, Blackstone, Standard Chartered, or any other named organization.

## License

See the repository for the applicable license and contribution terms.
