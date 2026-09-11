# Security, privacy, and information-source boundaries

Rivet is a static browser application for illustrative finance analysis. It is
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

## ISO/IEC 27001-aligned operating controls

These are lightweight controls inspired by ISO/IEC 27001 information-security
practices; they are not a certification or conformity claim.

GDPR/CCPA-oriented privacy details are documented in [`PRIVACY.md`](PRIVACY.md).

| Control area | Rivet practice |
| --- | --- |
| Asset and scope management | Static files, calculation logic, deployment workflow, and public demo are treated as the system boundary. |
| Data classification | The README and UI warn users not to enter confidential, personal, or material non-public information. |
| Access control | GitHub repository permissions and protected deployment settings should be limited to maintainers. |
| Change management | Focused pull requests, deterministic formulas, reviewable diffs, and deployment from `main`. |
| Secure development | Input bounds, output finiteness, escaping of user-controlled labels, browser console checks, and `git diff --check`. |
| Supplier and dependency risk | No runtime package dependencies or third-party runtime presentation dependencies. |
| Incident response | Report suspected vulnerabilities privately to the repository maintainer rather than publishing exploit details in an issue. |
| Continuity and recovery | The project is versioned in Git and can be served as static files from a clean checkout. |
| Evidence and review | Model assumptions, limitations, UI checks, and meaningful changes are documented in the repository. |

## Reporting a vulnerability

Do not include credentials, private deal data, personal information, or a
working exploit in a public issue. Open a private GitHub security advisory if
available for the repository, or contact the maintainer through the repository
owner’s verified GitHub profile. Include the affected file, reproducible
steps, impact, and a minimal safe proof.

Security reports are triaged separately from model-quality suggestions. A
financial formula that is simplified or illustrative is not automatically a
security vulnerability; explainability and model limitations belong in a
normal issue or pull request.
