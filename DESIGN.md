# KAVY interface direction

KAVY is an operate-mode underwriting workspace. The interface should make the model legible at a glance, keep every assumption close to its output, and let an analyst move between specialist workspaces without losing context.

## Visual language

- **Foundation:** shadcn-inspired dark zinc surfaces (`#09090b`, `#101012`, `#18181b`) with 1px neutral borders and restrained 6–8px radii.
- **Accent:** KAVY gold is reserved for primary actions, selected states, calculated outputs, and brand identity. Green communicates analytical health only.
- **Typography:** IBM Plex Sans for interface copy; DM Mono for measurements, percentages, multiples, and model telemetry.
- **Composition:** persistent compact navigation, compact header, clear action row, and data-dense panels with generous separation. Avoid decorative terminal framing and gratuitous labels.
- **States:** visible focus rings, quiet hover surfaces, clear selected controls, and explicit loading/complete feedback for scenario runs.

## Component grammar

Panels use a dark zinc surface, a neutral border, a small radius, and a subtle depth shadow. Inputs share the same height and focus treatment. Primary buttons use gold with dark text; secondary buttons remain transparent with a neutral border. Tables and charts use hairline dividers rather than ornamental containers.

## Responsive behavior

The sidebar collapses to an icon rail below 720px. Content becomes one column, chart callouts hide when they cannot fit, and wide data surfaces scroll within their own region rather than expanding the page.
