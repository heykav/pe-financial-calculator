# Contributing to Rivet

Rivet is intentionally dependency-light and strictly web-based: the calculator
is plain HTML, CSS, and JavaScript so the math is inspectable and the app can
be hosted as static browser content. Do not add native wrappers, executables,
browser extensions, or install-first flows.

## Development

1. Fork the repository and create a focused branch.
2. Make changes in `index.html`, `styles.css`, or `app.js`.
3. Run the app with any static server, for example `python3 -m http.server 4173`.
4. Check keyboard focus, browser viewport layouts, calculation edge cases, and browser console errors.
5. Open a pull request with a concise explanation of the model logic or UX change.

## Standards

- Keep all financial calculations deterministic and explainable.
- Prefer accessible labels, semantic HTML, and progressive enhancement.
- Do not add tracking or send deal data to a server.
- Preserve the Content Security Policy and escape any user-controlled content
  before rendering it into HTML.
- Treat `SECURITY.md` as the source of truth for vulnerability reporting and
  OSINT/privacy boundaries.
- Include a before/after screenshot for material visual changes.
