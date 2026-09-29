# Formulas, assumptions and simplifications

All calculation code lives in [`model.js`](../model.js) (pure functions, no DOM). Every formula below has a
test in [`test/model.test.js`](../test/model.test.js) checked against a value derived by hand. Money is USD millions;
rates are decimals inside the code and percentages in the UI.

## Returns

| Quantity | Formula |
| --- | --- |
| NPV | `Σ CF_t / (1+r)^t`, `CF_0` undiscounted. Example: `-100 + 60/1.1 + 60/1.21 = 4.1322`. |
| IRR | Root of `NPV(r)=0`, `r > -100%` (scan then bisection). Needs at least one outflow and one inflow, otherwise a clear error (no number). With several sign changes the IRR is not unique; the lowest root is returned. Total loss (exit equity 0) is reported as -100%. Lump-sum check: `2.0x over 5 yrs = 2^(1/5) - 1 = 14.87%`. |
| MOIC | `exit equity proceeds / sponsor equity invested` (gross: before fees, carry, taxes). |
| Headline IRR | IRR of `[-equity, 0, ..., 0, exit equity]` (annual periods, exit at end of year `hold`). |

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
`Debt = EBITDA x borrowing multiple` and must stay below 90% of the purchase price. The UI uses fees = 0.

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
  This is solved by fixed-point iteration (tolerance 1e-12; it converges because the loop gain is `rate/2 < 1`).
  Closed-form check for opening 100, rate 10%, cash 30: `C = 75/0.95 = 78.947`.
- **Shortfall:** if cash does not cover interest plus mandatory amortisation, the gap is assumed drawn on the facility (debt rises) and a warning is shown.
- **Surplus cash** (after debt is fully repaid or when sweep < 100%) accumulates as cash and counts against net debt.
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
Base-case margin expansion is therefore not reflected in the grid, so the base case need not sit exactly on a grid point.

## Known simplifications (not modelled)

- No income taxes or interest tax shield (cash conversion is a flat 65% of EBITDA); no separate capex, working capital, D&A, stub periods.
- Single debt tranche, fixed rate, no floating rates, OID, financing fees, revolver mechanics, covenants, PIK, or minimum cash.
- No transaction/exit fees, management options, preferred equity, fund fees or carry; returns are gross.
- Annual periods, exit at year end, no dividends or recaps (IRR is therefore a lump-sum IRR).
- The "return envelope" (lower / expected / higher) is a fixed offset from the point IRR, **not** a statistical distribution.
- Comps are illustrative placeholders, not market data.

This is an educational first-pass model, not investment advice.
