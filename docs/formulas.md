# Formulas, assumptions and simplifications

All calculation code lives in [`model.js`](../model.js) (pure functions, no DOM). The calculation functions are covered by
the tests in [`test/model.test.js`](../test/model.test.js), which mostly compare against values derived by hand, plus
input-validation and fuzz tests (any input either throws a `ModelError` or returns only finite numbers). Display formatting,
CSV, chart-series and export-summary helpers live in [`ui-helpers.js`](../ui-helpers.js) (also pure) and are tested in
[`test/ui-helpers.test.js`](../test/ui-helpers.test.js). The DOM wiring in `app.js` has no automated tests.
Money is USD millions; rates are decimals inside the code and percentages in the UI.

This is an educational model. It is not a deal-grade underwriting model; see [Known simplifications](#known-simplifications-not-modelled).

## Returns

| Quantity | Formula |
| --- | --- |
| NPV | `Σ CF_t / (1+r)^t`, `CF_0` undiscounted. Example: `-100 + 60/1.1 + 60/1.21 = 4.1322`. |
| IRR | Root of `NPV(r)=0`, searched between -99.9% and +99,900% (log-spaced scan for the first sign change, then bisection); an error is raised if none is found. Needs at least one outflow and one inflow, otherwise a clear error (no number). With several sign changes the IRR is not unique; the lowest root is returned. Total loss (exit equity 0) is reported as -100%. Lump-sum check: `2.0x over 5 yrs = 2^(1/5) - 1 = 14.87%`. |
| MOIC | `exit equity proceeds / sponsor equity invested`. Gross: no fund fees, carry or taxes. Entry transaction fees, if any, would sit in the equity invested; the app sets them to zero. |
| Headline IRR | IRR of `[-equity, 0, ..., 0, exit equity]` (annual periods, exit at end of year `hold`). For these lump-sum flows the root is unique and is computed in closed form, `IRR = MOIC^(1/hold) - 1`, rather than by the root search above; this also covers IRRs below the search floor (e.g. a 1-year hold recovering 0.05% of equity gives -99.95%). |

## Cost of capital and DCF

- CAPM: `Ke = rf + beta * ERP`
- WACC: `E/(D+E) * Ke + D/(D+E) * Kd * (1 - t)`. Example: `60%*10% + 40%*5%*(1-20%) = 7.6%`.
- Gordon growth terminal value (end of year n): `TV = FCF_n * (1+g) / (r - g)`. **If `g >= r` the app raises an error** and shows no value.
- Exit-multiple terminal value: `TV = metric_n * multiple`.
- Enterprise value: `Σ FCF_t/(1+r)^t + TV/(1+r)^n`, end-of-year discounting (no mid-year convention).
  Check: a flat 100 perpetuity at 10% is worth exactly 1000.
- In the app the DCF uses the full five-year forecast (independent of the hold period) with `FCF = 65% x EBITDA`
  as a single proxy that stands in for taxes, capex and working capital. WACC and terminal growth are user inputs.

## Sources and uses

`Uses = purchase EV + refinanced debt + fees + cash to balance sheet`;
`Sources = debt + rollover equity + sponsor equity`, where sponsor equity is the plug, so they always balance.
`Debt = EBITDA x borrowing multiple` and must stay below 90% of the purchase price. The UI uses fees = 0, no refinanced
debt and no cash to the balance sheet, so `sponsor equity = purchase price - new debt`. The purchase price is treated as the
enterprise value on a cash-free, debt-free basis: the target has no existing net debt to bridge to an equity price.

## Operating forecast

`Rev_t = Rev_{t-1} (1+g_t)`, `EBITDA_t = Rev_t * margin_t`. LTM revenue is not an input, so LTM margin is assumed equal
to the year-1 margin, giving `EBITDA_t = EBITDA_0 * Π(1+g_i) * m_t / m_1`.

## Debt schedule (one tranche, annual)

```
interest_t   = rate * B_t          B_t = opening balance ("beginning") or (opening+closing)/2 ("average", default)
cashAvail_t  = 65% * EBITDA_t - interest_t
mandatory_t  = min(opening, 1% * original principal)
sweep_t      = min(opening - mandatory_t, 100% * max(0, cashAvail_t - mandatory_t))
closing_t    = opening - mandatory_t - sweep_t
```

- **Circularity:** with average-balance interest, closing debt depends on interest which depends on closing debt.
  This is solved by fixed-point iteration (tolerance 1e-12; it converges because the loop gain is `rate*sweep/2` in a sweep year
  and `rate/2` in a shortfall year, so at most `rate/2`, and the rate is capped at 100%).
  Closed-form check for opening 100, rate 10%, pre-interest cash 30, no mandatory amortisation, 100% sweep:
  `C = 100 - (30 - 0.10 * (100 + C)/2)`, so `C = 75/0.95 = 78.947`.
- **Shortfall:** if `cashAvail_t` is below the mandatory amortisation, the mandatory payment is still treated as made and the gap
  is assumed drawn on the same facility, so `closing_t = opening_t - cashAvail_t`. Debt therefore falls by less than the
  mandatory amount when `0 < cashAvail_t < mandatory_t`, and rises only when `cashAvail_t < 0` (interest exceeds cash flow).
  Any year in the hold period with a draw triggers a warning in the app. There is no separate revolver, limit or pricing.
  Cash accumulated in earlier years is not used to cover a shortfall (in the app, with a 100% sweep, cash only builds once the
  debt is fully repaid, and a shortfall is then impossible because interest is zero and cash flow is non-negative).
- **Surplus cash** (after debt is fully repaid or when sweep < 100%) accumulates as cash and counts against net debt.
  The cash earns no interest. The app fixes the sweep at 100%, so surplus arises only once the debt is repaid.
- **Exit before maturity:** the schedule always runs five years; at exit in year `h` the outstanding balance (net of cash) is repaid at par out of sale proceeds. Later years never affect the result.

## Exit and attribution

`Exit EV = EBITDA_h * exit multiple`; `Exit equity = max(0, Exit EV - (debt - cash))` (limited liability).
Exact identity used for the bridge (no clamping, so negatives are shown):

```
ΔEquity = (E1 - E0)*M0        EBITDA growth at the entry multiple
        + (M1 - M0)*E1        multiple change on exit EBITDA (cross term sits here)
        + (ND0 - ND1)         net-debt reduction
        - fees
```

Percent shares are shown only when total value creation is positive (otherwise "n/a").

## Sensitivity grid

Each cell re-runs the full debt schedule with EBITDA growing at a constant rate `g` per year (flat margin) and the given exit multiple.
Base-case margin expansion is therefore not reflected in the grid (the margin is fixed at 20% inside the function, which
only matters through the ratio of margins, so EBITDA simply compounds at `g`), and the base case need not sit exactly on a
grid point. The grid keeps the current purchase price, leverage, interest rate and hold period.
Orientation: rows are exit EV / EBITDA (7.0x to 11.0x), columns are annual EBITDA growth (-5% to 25%); `sensitivity(input, multiples, growths)[i][j]`
is the IRR for `multiples[i]` and `growths[j]`. Cells show one decimal; the colour bucket is `round(IRR% / 5)` clamped to 1..7.

## Display and rounding

Money, multiples and percentages are shown to one decimal (`toFixed(1)`), MOIC in the exported summary to two; a value that rounds
to zero is shown without a sign (`$0.0`, not `-$0.0`). Non-finite values are shown as `—`. CSV exports use the same rounding.

## Known simplifications (not modelled)

- No income taxes or interest tax shield (cash available for debt service is a flat 65% of EBITDA, before interest); no separate capex, working capital, D&A, stub periods.
- Purchase price is an enterprise value with no existing debt or cash to bridge; no refinancing, minimum cash or cash interest income.
- Single debt tranche, fixed rate, no floating rates, OID, financing fees, revolver mechanics, covenants or PIK. Fixed 1% amortisation and 100% sweep in the app.
- The model function accepts an entry-fee input, but the app sets it to zero. There are no exit fees, management options, preferred equity, fund fees or carry; returns are gross.
- The exit multiple is a single user input. Exit proceeds repay net debt at par, with no prepayment cost.
- Annual periods, exit at year end, no dividends or recaps (IRR is therefore a lump-sum IRR).
- The DCF discounts the same 65%-of-EBITDA proxy over five years with a Gordon terminal value; it has no tax, capex or working-capital build, and WACC is an input, not derived.
- The "return envelope" (lower / base / higher) is the point IRR minus 6.6 and plus 9.3 percentage points (floored at -100%), **not** a statistical distribution. The app draws the three points on a plain line.
- Comps are illustrative placeholders, not market data; the 11.8x median in the comps check is a hard-coded example.
- The Base, Downside and Upside cases are hand-picked input sets, not forecasts.

This is an educational first-pass model, not investment advice.
