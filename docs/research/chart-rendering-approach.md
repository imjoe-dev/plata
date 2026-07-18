# Research: chart rendering approach for the Plata chat transcript

- **Ticket:** [#40](https://github.com/imjoe-dev/plata/issues/40) (part of map #39)
- **Date:** 2026-07-18
- **Question:** How should Plata render charts (pie, bar, line) in the chat transcript — a charting library or hand-rolled SVG?
- **Status:** Resolved

## Recommendation (summary)

**Hand-rolled SVG chart components in the design system, with `d3-shape` (~8.6 kB min+gzip, zero DOM/React coupling) as the only dependency** — pie arcs from `pie()`/`arc()`, bar/line from trivial linear scales. Confidence: **high** for the v1 single-series scope. Escape hatch if scope grows to multi-series: adopt **visx v4 primitives** incrementally — same d3 substrate, same plain-SVG SSR story, React 19 peer range, ~11–19 kB per package. Full reasoning in [Recommendation](#recommendation) below.

## Local constraints (verified in-repo)

These are the facts of this codebase that any approach must satisfy.

### Stack versions (`package.json`)

- React `^19.2.0`, `babel-plugin-react-compiler` `^1.0.0` — the React Compiler is active project-wide (see `CLAUDE.md` coding conventions), so any library must tolerate compiler-transformed consumers.
- Tailwind CSS `^4.1.18` via `@tailwindcss/vite`.
- TanStack Start (`@tanstack/react-start` latest) with `@cloudflare/vite-plugin` `^1.26.0` configured as the SSR environment (`vite.config.ts`: `cloudflare({ viteEnvironment: { name: "ssr" } })`) — server rendering runs on **workerd**, which has **no DOM, no `ResizeObserver`, no canvas**.
- Chat is `@tanstack/ai` + `@tanstack/ai-react`; messages are persisted and chat session routes (`src/routes/_protected/chat.$sessionId.tsx`) are SSR'd on revisit, so a chart in the transcript **will be server-rendered**, not only streamed client-side.

### Design-system theming (`src/styles.css`)

- All tokens live in a Tailwind v4 `@theme` block: neutral surfaces (`--color-base/raised/sunken/overlay`), hairlines, fg scale, and exactly four chart-usable accent hues — `--color-accent` (chartreuse), `--color-negative` (red), `--color-caution` (amber), `--color-info` (blue) — all in `oklch`.
- Tailwind v4 emits every `@theme` token as a **native CSS custom property on `:root`**, explicitly documented for use in inline styles (`style="background-color: var(--color-mint-500)"`) and in `fill-(--token)` arbitrary utilities ([theme docs](https://github.com/tailwindlabs/tailwindcss.com/blob/main/src/docs/theme.mdx), [v4 announcement](https://github.com/tailwindlabs/tailwindcss.com/blob/main/src/blog/tailwindcss-v4-alpha/index.mdx)). So SVG `fill`/`stroke` can be `var(--color-accent)` or plain `fill-accent` / `stroke-hairline` utility classes — **if** the chart layer lets us put classes/CSS values on its elements.
- The design system is dark-only, zero-radius, hairline-bordered. Library default styles (rounded tooltips, white backgrounds, animation easings) are all wrong for it and would need overriding everywhere.

### Integration point (`src/components/chat-conversation.tsx`)

- The transcript renders `UIMessage.parts` with a `part.type` switch (`"text"` → markdown, `"tool-call"` → `ToolCall`). A chart is a new branch rendering a tool result payload (chart spec: type + labels + values). Whatever renders it should be a normal design-system component under `src/components/ui/`, storybook-able like the rest.
- No `React.lazy`/`Suspense` exists in `src` today; the chat route is part of the main client bundle. Any heavy dependency lands on the critical path of the protected app unless we introduce lazy chunking just for it.

## Candidates

### Recharts 3.x

Latest stable **3.9.2** (2026-07-04); peer range includes React 19 ([npm registry](https://registry.npmjs.org/recharts), React 19 peers added in [PR #5325](https://github.com/recharts/recharts/pull/5325)).

- **SSR: disqualifying.** Recharts 3.x renders **no chart SVG during a server render**, even with explicit `width`/`height` and no `ResponsiveContainer`. [Issue #5997](https://github.com/recharts/recharts/issues/5997) ("Unable to render chart on the server using 3.0.0") is still open at 3.9.2, labeled `server-side-rendering`; root cause is the 3.0 rewrite onto a Redux store whose width/height sync happens in `useEffect`, which never runs in `renderToString`. A repro in that issue shows `renderToStaticMarkup(<BarChart width={600} height={420}>…)` emitting an empty `<div>`. Maintainer position: "server side rendering has never been explicitly supported… no plan at the moment" ([#5997](https://github.com/recharts/recharts/issues/5997), duplicate [#6139](https://github.com/recharts/recharts/issues/6139)). This is a regression vs 2.x. On workerd it should not _crash_ (`Global.isSsr` guards `window` access — [Global.ts](https://github.com/recharts/recharts/blob/main/src/util/Global.ts)) — transcripts would just SSR empty and paint client-side. `ResponsiveContainer` additionally measures via `ResizeObserver` and returns `null` until it has a positive size ([source](https://github.com/recharts/recharts/blob/main/src/component/ResponsiveContainer.tsx)); its `initialDimension` prop does not restore server SVG in 3.x.
- **Bundle: heavy, and the weight is structural.** Runtime deps at 3.9.2 include `@reduxjs/toolkit`, `react-redux`, `immer`, `reselect`, `use-sync-external-store`, `es-toolkit`, `victory-vendor` (d3), `decimal.js-light`, `eventemitter3` ([npm registry](https://registry.npmjs.org/recharts)). Whole library: **554 kB min / 145.1 kB min+gzip** ([bundlephobia, recharts@3.9.2](https://bundlephobia.com/api/size?package=recharts@3.9.2)). ESM with `sideEffects: false`, so unused chart types tree-shake, but the Redux/immer/d3 core is shared by every chart — importing only `PieChart` still pulls most of it. No per-chart `exports` subpaths.
- **React 19:** supported, with open edge-case bugs — [#7463](https://github.com/recharts/recharts/issues/7463) (max update depth on unmount behind Suspense, open June 2026), [#6316](https://github.com/recharts/recharts/issues/6316) (createSlice error under React 19, open since Sep 2025); several other React 19 bugs were hit and fixed along 3.x.
- **React Compiler:** no statements or issue reports either way (GitHub search returns nothing) — UNVERIFIED; Recharts ships precompiled so the consumer's compiler doesn't process it.
- **Theming:** `fill`/`stroke` props pass `var(--token)` strings through to SVG (the official docs site does exactly this). But `DefaultTooltipContent` hardcodes `#fff`/`#ccc`/`#000` inline styles ([source](https://github.com/recharts/recharts/blob/main/src/component/DefaultTooltipContent.tsx)) — dark theming means overriding `contentStyle`/`itemStyle` or writing custom tooltip content. No built-in theming system; the theming RFC is an open not-to-be-merged-as-is PR ([#7369](https://github.com/recharts/recharts/pull/7369)).
- **Maintenance:** active (3.9.2 July 2026, steady cadence, 27.4k stars), volunteer-run; ckifer/PavelVanecek answer issues.

### visx primitives (@visx/shape, @visx/scale, @visx/group)

Airbnb's "reusable low-level visualization components" — unopinionated SVG building blocks over d3, per-package installs ([repo](https://github.com/airbnb/visx)).

- **Version / React 19:** all three at **v4.0.0** (2026-06-11), `peerDependencies: react: "^18.0.0 || ^19.0.0"`; `@visx/scale` has no React peer at all (pure scale math) ([npm](https://registry.npmjs.org/@visx%2Fshape/latest)).
- **SSR:** the primitives render plain SVG via React, so `renderToString` works with no DOM. Known SSR breakage is confined to higher-level packages we would not use: `@visx/xychart` builds its data registry in `useEffect` ([#1478](https://github.com/airbnb/visx/issues/1478)) and `@visx/text` measures text ([#266](https://github.com/airbnb/visx/issues/266)). No doc page states "SSR supported" outright — the positive claim for shape/scale/group is structural inference, flagged as such.
- **Size:** `@visx/shape` **10.7 kB min+gzip** incl. d3-shape/d3-path ([bundlephobia](https://bundlephobia.com/package/@visx/shape@4.0.0)), `@visx/group` 0.6 kB, `@visx/scale` 18.4 kB (mostly d3-scale itself).
- **Theming:** you author the `<path>`/`<rect>` elements and pass `fill`/`className` through — `var(--token)` and Tailwind utilities are ordinary SVG attributes; no color engine to interfere.
- **Maintenance:** v4 released last month; repo pushed 2026-06-22.

### Hand-rolled SVG + d3-shape (standalone)

- **Pure math, zero DOM:** d3-shape generators "compute the `d` attribute of an SVG path element" — string in, string out; no DOM anywhere in the API ([d3-shape docs](https://d3js.org/d3-shape)). `pie()`/`arc()` cover the only nontrivial geometry in the v1 trio.
- **Size:** d3-shape **~8.6 kB min+gzip** (only dep: d3-path) ([bundlejs](https://deno.bundlejs.com/api?q=d3-shape)); d3-scale (16 kB) is optional — single-series bar/line scales are one-line linear/band functions.
- **React / Compiler / SSR:** no React dependency at all (`peerDependencies: null`); the chart is our own JSX, so React 19, the compiler, and workerd SSR are exactly as safe as the rest of `src/components/ui`. ESM (`"type": "module"`).
- **Maintenance:** d3-shape 3.2.0 is from 2022-12 — finished, stable D3 7 module rather than abandonment, but honestly flagged: no release in 3+ years.

### Ruled out quickly

| Candidate                      | Disqualifier (primary source)                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chart.js / react-chartjs-2** | Canvas renderer; "canvas rendering disallows CSS styling" ([docs](https://www.chartjs.org/docs/latest/)). workerd has no canvas — nothing renders server-side, and CSS-variable theming is impossible.                                                                                                                                                                      |
| **Victory**                    | React 19 typing breakage closed as not-planned ([#3076](https://github.com/FormidableLabs/victory/issues/3076)), event regressions on 18→19 ([#3048](https://github.com/FormidableLabs/victory/issues/3048)); no stable release in ~18 months.                                                                                                                              |
| **Observable Plot**            | Not React-idiomatic (imperative, returns a DOM element) and "the `document` option… defaults to `window.document`" — SSR requires a DOM shim on workerd ([docs](https://observablehq.com/plot/features/plots)).                                                                                                                                                             |
| **Tremor**                     | Built on Recharts (inherits its SSR story), peer `react: "^18.0.0"` only, last publish 2025-01-13 ([npm](https://registry.npmjs.org/@tremor%2Freact/latest)).                                                                                                                                                                                                               |
| **nivo**                       | React 19 supported and "isomorphic rendering" advertised ([nivo.rocks](https://nivo.rocks/about/)), but **80–108 kB gzip per chart package** (`@nivo/core` drags react-spring + lodash + seven d3 modules, [bundlejs](https://deno.bundlejs.com/api?q=@nivo%2Fpie)); whether `var(--token)` survives its d3-color-based color pipeline is unverified; last release 2025-05. |

## Evaluation

| Criterion                          | Recharts 3.9.2                                                              | nivo 0.99                            | visx v4 primitives                       | Hand-rolled + d3-shape                                               |
| ---------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------- |
| React 19                           | ✅ peer, ⚠️ open edge bugs (#7463, #6316)                                   | ✅ peer                              | ✅ peer                                  | ✅ N/A (our JSX)                                                     |
| React Compiler                     | Unverified                                                                  | Unverified                           | Fine (our JSX consumes plain components) | ✅ compiler handles our code like any component                      |
| SSR on workerd                     | ❌ empty markup ([#5997](https://github.com/recharts/recharts/issues/5997)) | ✅ fixed-size SVG mode               | ✅ plain SVG output                      | ✅ plain SVG output                                                  |
| Tailwind v4 `var(--token)` theming | ⚠️ marks yes, tooltip defaults hardcode `#fff`                              | ⚠️ unverified through color pipeline | ✅ full control                          | ✅ full control, incl. `className` utilities on every element        |
| Cost at chat renderer (min+gzip)   | ~145 kB (Redux core not shakeable away)                                     | ~80–108 kB per chart type            | ~11–19 kB                                | **~8.6 kB**                                                          |
| Fit for single-series pie/bar/line | Overkill                                                                    | Overkill                             | Good                                     | **Best** — the v1 trio needs one arc generator and two linear scales |
| Zero-radius/dark design fit        | Fight default styles                                                        | Fight theme object                   | Native                                   | Native                                                               |

## Recommendation

**Hand-roll the three chart components as design-system SVG, with `d3-shape` as the only dependency** (for `pie()`/`arc()`; its `line()` generator is optionally useful for the line chart). Confidence: **high** for the v1 scope.

Why this wins on every axis in play:

1. **SSR is the eliminating constraint, and it eliminates the incumbent.** Chat transcripts are SSR'd on workerd; Recharts 3.x demonstrably emits no SVG server-side and its maintainers say SSR is out of scope. Our own `<svg>` JSX SSRs like any other component — no DOM, no ResizeObserver, no measurement.
2. **Theming is exact, not approximated.** Every `<path>`/`<rect>`/`<line>`/`<text>` takes `className` directly: `fill-accent`, `stroke-hairline`, `text-fg-muted font-mono` — the same Tailwind v4 tokens as the rest of `src/components/ui`, with the zero-radius aesthetic free by construction (SVG rects have no radius unless asked). No library default styles to fight, and the existing base-ui `Tooltip` and design-system typography compose in as siblings, not as library plugin overrides.
3. **Bundle cost is a rounding error.** ~8.6 kB gzip vs 145 kB (Recharts) or 80–108 kB per type (nivo). At that size the chart renderer needs no lazy boundary at all; if one is ever wanted, `React.lazy` at the `part.type` switch in `chat-conversation.tsx` is the natural seam.
4. **The v1 scope is genuinely small.** Single-series bar and line need one linear scale (a one-line function) and, for bars, an index-based band layout; pie needs arc path math, which `d3-shape` supplies as pure string-returning functions with no React or DOM coupling. This is squarely "design-system component" work — storybook-able, testable with Testing Library, compiler-memoized automatically.
5. **No third-party React-lifecycle risk.** React 19 + Compiler compatibility questions vanish when the only dependency has `peerDependencies: null` and does math on arrays.

Costs accepted knowingly: we own axes/ticks/labels layout (small for single-series; "nice" tick math can come from `d3-array`'s `ticks()` or d3-scale later if wanted), and we own accessibility (role/`aria-label`/`<title>` on the SVG — which we'd have to audit in a library anyway).

## Escape hatch: multi-series growth

If scope grows to multi-series (grouped/stacked bars, multi-line with legends, time axes), **adopt the visx v4 primitives incrementally** (`@visx/shape` for `Stack`/`BarGroup`/`AreaStack`, `@visx/scale` for time/ordinal scales, `@visx/axis` for tick layout):

- Same substrate — visx wraps the same d3-shape/d3-scale we'd already be using, so data shapes, path-generation mental model, and `var(--token)` theming carry over unchanged.
- Same rendering model — plain SVG output, so the SSR and design-system properties survive the migration.
- Incremental — visx is per-package and per-component; a stacked bar can adopt `@visx/shape` while the pie stays hand-rolled. Cost ceiling is ~11–19 kB gzip per added package, still an order of magnitude under Recharts/nivo.
- Verified current: v4.0.0 (June 2026) with an explicit React 19 peer range.

What we would _not_ do is move to Recharts/nivo later: the SSR and theming constraints that disqualify them for v1 are architectural, not scope-dependent.

## Sources

Primary sources are linked inline throughout: npm registry metadata, recharts/visx/nivo/victory GitHub issues and source files, chartjs.org and observablehq.com/plot docs, d3js.org module docs, tailwindcss.com theme docs, and this repo's `package.json`, `vite.config.ts`, `src/styles.css`, and `src/components/chat-conversation.tsx`. Bundle figures measured via bundlephobia.com and deno.bundlejs.com APIs on 2026-07-18.
