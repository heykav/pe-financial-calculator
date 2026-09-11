# Northstar — Private Markets Calculator

Northstar is a fast, dependency-free underwriting cockpit for investment bankers,
private equity professionals, operators, and finance students. It turns entry
assumptions, operating cases, leverage, exit assumptions, and sensitivities into
an explainable sponsor returns view in the browser.

## Included

- Dynamic entry valuation, leverage, equity check, exit value, MOIC, and IRR.
- Operating-case forecast inputs with live recalculation.
- Value creation bridge and exit multiple readout.
- IRR sensitivity grid for exit multiple × EBITDA CAGR.
- IC readiness checklist, memo export, CSV sensitivity download, and VCD-style
  dense information design adapted for deal work.
- No backend, no tracking, and no deal data leaving the browser.

## Run locally

```sh
python3 -m http.server 4173
# open http://localhost:4173
```

The app is plain HTML, CSS, and JavaScript so contributors can audit and extend
the model without a build system. See `.github/CONTRIBUTING.md` for standards.

## Contributing

Issues and pull requests are welcome. Keep financial logic deterministic,
document assumptions, and include a screenshot for meaningful UI changes.
