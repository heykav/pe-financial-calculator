# Security, privacy, and information-source boundaries

Rivet is a strictly web-only static browser application for illustrative
finance analysis. The browser tab is the complete runtime; there is no native
desktop/mobile wrapper, extension, executable, or install service. It is
not a security product, an OSINT platform, or an ISO-certified information
system. This document describes the protections that are appropriate for the
current architecture and the boundaries contributors must preserve.

## OSINT boundary

Rivet does **not** scrape websites, collect public-record data, enrich people or
companies, call data brokers, fingerprint visitors, or transmit entered deal
assumptions to an OSINT service. The “comps” and DCF views contain illustrative
reference values, not live intelligence.

If a user adds public information to a local model, they remain responsible for:

- Checking the source, publication date, jurisdiction, and chain of custody.
- Separating sourced facts from management estimates and analyst assumptions.
- Respecting terms of service, robots rules, copyright, privacy, and applicable
  market-abuse or material-non-public-information requirements.
- Never entering confidential, personal, restricted, or material non-public
  information into the public demo.

## Current application protections

- **Content Security Policy:** the page restricts scripts, objects, frames,
  network connections, fonts, and image sources to the minimum required surface.
- **Third-party minimization:** web fonts and external runtime dependencies are
  not loaded by the app, reducing incidental disclosure to third parties.
- **No tracking or collection:** there is no analytics SDK, backend API, login,
  cookie, local storage, or telemetry pipeline.
- **Input validation:** numeric assumptions have explicit bounds, finite-number
  checks, and a debt-to-purchase-price sanity guardrail.
- **Output safety:** user-created workspace names are HTML-escaped before being
  inserted into the workspace menu.
- **Safe external navigation:** external GitHub links use `rel="noreferrer"`.
- **Deterministic exports:** memo and CSV downloads are generated locally from
  current model state.

## Operating practices

This is a small static site maintained by one person. The list below describes
what is actually done; it is not a certification or a conformity claim against
any standard.

GDPR/CCPA-oriented privacy details are documented in [`PRIVACY.md`](PRIVACY.md).

- **Scope:** static files, the calculation code, the CI and deployment workflows, and the public demo.
- **Data:** the README and UI tell users not to enter confidential, personal, or material non-public information.
- **Changes:** pull requests against `main`; CI runs a syntax check and the unit tests in `test/`; the site is deployed from `main` by GitHub Pages.
- **Workflow permissions:** workflows default to read-only `contents`; only the deploy job has `pages` and `id-token` write access. Checkouts do not persist credentials.
- **Dependencies:** no runtime package dependencies. Dependabot proposes weekly updates for GitHub Actions and npm.
- **Recovery:** the project is versioned in Git and can be served as static files from a clean checkout.

## Reporting a vulnerability

Do not include credentials, private deal data, personal information, or a
working exploit in a public issue.

Report privately using either:

1. GitHub private vulnerability reporting: the "Report a vulnerability" button
   on the repository's Security tab (where it is enabled), or
2. Email: heykavofficial@gmail.com.

Include the affected file, reproducible steps, impact, and a minimal safe
proof. This is a personal project: reports are handled on a best-effort basis,
with no guaranteed response time or fix schedule.

Security reports are triaged separately from model-quality suggestions. A
financial formula that is simplified or illustrative is not automatically a
security vulnerability; explainability and model limitations belong in a
normal issue or pull request.
