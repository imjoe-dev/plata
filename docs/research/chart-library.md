# Research: chart library for the Plata design system

Resolves #34 (part of #32). Researched 2026-07-18.

## Question

Which charting approach should the chart factory build on? The factory renders **pie, line, and
bar** charts inside a chat transcript from an LLM tool result. Constraints:

- **React 19 + React Compiler** — `babel-plugin-react-compiler` is active project-wide.
- **Client-only rendering** — no SSR requirement.
- **Deep style control** — dark, zero-radius design system on Tailwind v4 tokens
  (`src/styles.css`: oklch neutral scale, `--radius-*: 0`, Instrument Sans / JetBrains Mono,
  hairline borders) + cva compound components.
- **Small bundle impact** — #27 just fought the chat chunk down below the 500 kB warning
  (~190 kB gzip) and set up a `codeSplitting` vendor group; the main entry floor is ~110 kB gzip.
- **Composable API** — the design system composes compound components over context
  (see `src/components/ui/tool-call.tsx`).

## Comparison

Sizes from the bundlephobia API, 2026-07. "Full" = whole-package import, minified / min+gzip.

| Candidate                        | Version        | Full (min / gz)                                                                    | Realistic pie+line+bar cost (gz)                                                                                                | Rendering                                                            | React 19                                                        | React Compiler                                                                                                                                  | Zero-radius / token theming                                                                                                                                                                           | Composition                                                                                          | Maintenance                                                                                                                              |
| -------------------------------- | -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Hand-rolled SVG (+ d3-shape)** | d3-shape 3.2.0 | 33 kB / 5.7 kB                                                                     | **~6 kB vendor + ~3–5 kB own code**                                                                                             | React SVG                                                            | N/A (our code)                                                  | Perfect — idiomatic React, compiler memoizes it                                                                                                 | Native — Tailwind classes on SVG elements                                                                                                                                                             | Compound components, our idiom                                                                       | Ours; d3-shape is the most stable dep in the ecosystem (framework-agnostic, zero peer deps)                                              |
| visx                             | 4.0.0          | shape 10.7 kB gz, scale 17.5 kB gz, axis 15.2 kB gz (per-pkg, overlapping d3 deps) | ~30–40 kB combined                                                                                                              | React SVG                                                            | Yes — v4.0.0 stable (June 2026), React 18/19 peers              | No known issues (plain SVG components)                                                                                                          | Excellent — unstyled primitives, `className` everywhere                                                                                                                                               | Low-level components; you build the chart                                                            | **At risk** — discussion airbnb/visx#1908: release cadence dropped Apr 2025, "radio silence" complaints, production users migrating away |
| Recharts                         | 3.9.2          | 554 kB / **145 kB**                                                                | Tree-shaking exists (v3), but the shared core (internal Redux store, context machinery, d3) dominates; realistically ~60–100 kB | React SVG                                                            | Yes (since 2.15/3.x; `react-is` override needed in some setups) | **Documented production-only breakage**: recharts#5173 — compiler changed `displayName`, broke the internal `isChart` check in prod builds only | Good-ish — props take hex/`var()`, radius configurable to 0; default look needs full overriding                                                                                                       | Declarative compound-ish (`<BarChart><Bar/></BarChart>`) but heavy internal magic (child inspection) | Active                                                                                                                                   |
| Chart.js (+ react-chartjs-2)     | 4.5.1          | 201 kB / 68 kB                                                                     | ~35–45 kB with registered subset (3 controllers + scales + tooltip + legend)                                                    | **Canvas**                                                           | Wrapper fix merged Oct 2025                                     | Wrapper is thin; low risk                                                                                                                       | Weak fit — canvas can't take Tailwind classes; tokens must be resolved via `getComputedStyle` at render time; fonts re-declared in config; DOM tooltip must be custom-built to escape the canvas look | Config object, not components                                                                        | Active (4M weekly downloads)                                                                                                             |
| Observable Plot                  | 0.6.17         | 385 kB / 128 kB                                                                    | ~128 kB — bundles d3, not meaningfully tree-shakeable                                                                           | SVG, **imperative** (returns a DOM node; needs ref + effect wrapper) | Framework-agnostic, but no React component model                | Wrapper effect is fine; no component integration                                                                                                | Moderate — generates its own inline styles; fighting its defaults is the workflow                                                                                                                     | None — grammar-of-graphics options object                                                            | Active (Observable)                                                                                                                      |
| ECharts (+ echarts-for-react)    | 6.1.0          | 1,115 kB / **368 kB**                                                              | ~90–110 kB via `echarts/core` + 3 chart modules                                                                                 | **Canvas**, imperative                                               | Core is framework-agnostic; wrapper (3.0.6) has peer-dep lag    | Wrapper-level risk, core unaffected                                                                                                             | Weak fit — JS theme object, same canvas token problem as Chart.js                                                                                                                                     | Options object                                                                                       | Core very active; wrapper "sustainable"                                                                                                  |

Bundlephobia note: recharts' own docs show a tree-shaken app entry at ~3 kB gz, but that measures
the app file, not the library chunks it pulls — do not read it as the real cost.

## Recommendation: hand-rolled SVG chart factory, with `d3-shape` for path generation

**Confidence: high.** For exactly three chart forms rendered from LLM tool results in a
personal, desktop-only app, a library's value proposition (dozens of chart types, responsive
containers, animation, brush/zoom) is almost entirely unused surface — while every constraint
Plata actually has punishes libraries:

1. **Bundle.** #27's whole point was structural discipline on the chat chunk. Recharts alone
   (145 kB gz) would roughly re-add the entire chat chunk's gzip weight; even Chart.js' subset
   (~40 kB) is ~7× the hand-rolled cost. Hand-rolled is ~6 kB gz of vendor (`d3-shape` only)
   plus a few kB of our own components.
2. **React Compiler.** Recharts is the one candidate with a documented compiler-induced,
   production-only breakage (#5173) — the worst failure mode for this repo. Our own idiomatic
   React components are the only option with _zero_ compiler risk, and they get automatic
   memoization instead of fighting it.
3. **Theme fidelity.** SVG elements accept Tailwind classes directly: `fill-accent`,
   `stroke-hairline`, `text-fg-muted`, inherited Instrument Sans / `font-mono tabular-nums`
   for values. Zero-radius is SVG's default (`<rect>` has no rounding unless asked;
   `stroke-linecap="butt"` for lines). Canvas libraries invert this: every token must be
   resolved to a string at runtime and re-fed through a config object, and the default
   tooltip/legend look leaks through unless rebuilt anyway.
4. **Composition.** A `Chart.Root` (context provider: data, scales, dimensions) with
   `Chart.Bars` / `Chart.Line` / `Chart.Pie` / `Chart.Axis` / `Chart.Legend` children is
   exactly the `tool-call.tsx` idiom. No library maps onto compound components this cleanly —
   recharts _looks_ compound but works via child inspection (the source of its compiler bug).
5. **The design cost of hand-rolling is already paid.** The usual hidden cost of DIY charts is
   design decisions, not code. The local dataviz skill supplies the full spec: form choice,
   mark specs (2 px lines, thin bars, 2 px surface gaps between pie segments / adjacent bars,
   ≥8 px markers), selective direct labels, legend rules (always for ≥2 series, never for 1),
   crosshair + tooltip behavior, and a runnable palette validator
   (`scripts/validate_palette.js`) to check the categorical ramp against `--color-base`.
   One deliberate deviation: the skill's "4 px rounded data-ends" default is overridden by the
   system's zero-radius rule — square ends everywhere.
6. **A11y is better DIY here.** SVG marks can carry roles/labels, tooltips reuse the existing
   base-ui `tooltip.tsx`, and the skill's table-view fallback maps onto the existing
   `table.tsx`. Canvas charts are an opaque single element by default.

**What hand-rolling honestly costs:** linear scale + nice-ticks math (~30 lines, well-known
algorithm), degenerate-data handling (empty series, single point, long category labels),
and owning the test burden. `d3-shape` removes the only genuinely fiddly geometry (pie arcs
with pad angles for the 2 px spacers; line/area path strings). **Not** recommended to hand-roll
past this scope: if requirements grow to time-scale axes, stacking, brushing, or animation,
add `d3-scale` (16 kB gz) first, and treat **visx as the escape hatch** — it shares this exact
architecture (unstyled React SVG primitives), so `Chart.*` internals would migrate onto
`@visx/shape`/`@visx/scale` without changing the public API. visx is the runner-up rather than
the pick because of its maintenance trajectory (airbnb/visx#1908) and ~5–6× the bundle cost
for math we barely need yet.

## Theming approach for the pick

- **Tokens via classes, not props.** Marks take `className` like every other DS component:
  grid/axes in `stroke-hairline`, labels in `fill-fg-muted` (per the skill: text wears text
  tokens, never series color), values in `font-mono tabular-nums`.
- **Series palette as first-class tokens.** Add `--color-chart-1..n` to `@theme` in
  `src/styles.css` (fixed assignment order, never cycled; fold overflow into "Other").
  Validate the ramp with the dataviz skill's `validate_palette.js` against the dark surface
  (`--color-base`, oklch 0.14) before committing values; `--color-accent` (hue 118) anchors
  series 1.
- **Spacers from surface color.** 2 px gaps between pie segments and stacked/adjacent bars are
  strokes/pads in the chart's surface color (`--color-raised` inside a raised card), not white.
- **Zero-radius everywhere**: plain `<rect>`s, `cornerRadius(0)` on arcs, `stroke-linecap="butt"`.
- **cva where variants exist** (e.g. chart size or density variants), matching `button.tsx`.

## Code-splitting plan

- The factory renders only inside chat transcripts when an LLM tool result asks for a chart —
  the textbook lazy boundary. Export the factory from one module and load it with
  `React.lazy(() => import("@/components/ui/chart"))` at the tool-result renderer, behind the
  existing `skeleton.tsx` as fallback. Non-chart chats never download it.
- At ~6 kB gz vendor, no dedicated Rolldown `codeSplitting` group is needed initially — the
  lazy boundary alone produces its own chunk. If chart vendor code grows (d3-scale, etc.),
  add a group beside the existing `tiptap` group in `vite.config.ts`
  (`test: /node_modules[\\/]d3-/`, name `charts`) so chart vendor bytes cache independently
  of app deploys, same rationale as #27.
- Client-only rendering falls out for free: the lazy import happens after hydration in the
  chat UI; no SSR of SVG needed.

## Sources

- Bundlephobia API (sizes above): recharts 3.9.2, @observablehq/plot 0.6.17, chart.js 4.5.1,
  echarts 6.1.0, @visx/{shape,axis,scale} 4.0.0, d3-shape 3.2.0
- React Compiler prod breakage: <https://github.com/recharts/recharts/issues/5173>
- Recharts React 19: <https://github.com/recharts/recharts/issues/4558>, #5461 (react-is override)
- visx React 19 (v4): <https://github.com/airbnb/visx/issues/1883>
- visx maintenance risk: <https://github.com/airbnb/visx/discussions/1908>
- react-chartjs-2 React 19 fix: <https://github.com/reactchartjs/react-chartjs-2/pull/1309>
- echarts-for-react status: <https://www.npmjs.com/package/echarts-for-react> (3.0.6)
- Local dataviz skill (form/color/mark specs + palette validator) — makes hand-rolling viable
