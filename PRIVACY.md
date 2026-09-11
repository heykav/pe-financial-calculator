# Rivet privacy notice

**Last updated: 2026-09-12**

This notice describes the data boundary of the Rivet browser web app.
It is written for the current static GitHub Pages deployment and is not legal
advice or a representation that every deployment, browser, hosting provider, or
jurisdictional obligation is satisfied.

## Short version

Rivet is strictly a browser web app. It does not ship as a native desktop or
mobile application, browser extension, or installable client. Rivet does not
ask for an account, use advertising cookies, run analytics,
fingerprint visitors, sell personal information, or send the assumptions typed
into the calculator to a Rivet application server. Calculations and exports are
performed in the browser.

The public demo is hosted by GitHub Pages. GitHub may process technical request
data, security logs, or network metadata under its own terms and privacy
documentation. Rivet cannot control or make promises about GitHub’s independent
processing.

## Data processed by the application

The application processes the following locally in the current browser tab,
which is the only product runtime:

- Deal assumptions entered into form controls.
- Base, Downside, and Upside case values held in JavaScript memory.
- Locally generated text and CSV export content.
- Temporary UI state such as the selected workspace and open menu.

The application does not intentionally persist these values in cookies,
`localStorage`, `sessionStorage`, a database, or a remote API.

## Third parties

The current application does not load Google Fonts, analytics scripts, ad
trackers, social widgets, data brokers, OSINT services, or market-data APIs.
External GitHub links are optional navigation chosen by the user.

## GDPR-oriented rights

Where GDPR applies, the app is designed around data minimization and privacy by
default because it intentionally avoids collecting account or model data. A
person may still have rights against the hosting provider or other independent
controllers involved in delivery, including rights of access, correction,
deletion, restriction, objection, portability, and complaint to a supervisory
authority. Those requests may need to be directed to the relevant controller,
such as GitHub for GitHub Pages infrastructure.

## CCPA/CPRA-oriented rights

Rivet does not intentionally sell or share personal information for cross-context
behavioral advertising and does not operate a “do not sell or share” profile.
The app does not intentionally collect categories of personal information from
calculator inputs. California residents may still have rights against the
relevant hosting or infrastructure provider. Requests about GitHub processing
should be sent to GitHub through its published privacy channels.

## Sensitive and confidential information

Do not enter personal data, credentials, confidential client information,
material non-public information, trade secrets, regulated data, or restricted
deal materials into the public demo. Use fictional or properly authorized
inputs. A browser-only calculation is not a secure document-management system.

## Changes and contact

This notice changes when the data boundary changes. For a suspected application
security issue, follow [`SECURITY.md`](SECURITY.md). For a GitHub Pages hosting
or account-data request, use GitHub’s official privacy and support channels.
