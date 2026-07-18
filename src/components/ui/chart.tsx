import { arc as d3arc, area as d3area, line as d3line, pie as d3pie } from "d3-shape";
import { createContext, use, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * PROTOTYPE (wayfinder #43) — the chart-spec part shape as the render_chart tool
 * would return it. `columns` declares roles so the renderer never guesses which
 * row field is the axis and which is the value; a future multi-series chart adds
 * more `y` columns without changing `rows`.
 */
export type ChartType = "pie" | "bar" | "line";

export interface ChartColumn {
  key: string;
  label: string;
  role: "x" | "y";
}

export interface ChartSpec {
  chartType: ChartType;
  title: string;
  metric: "income" | "expenses" | "net";
  groupBy: "category" | "day" | "month" | "year";
  appliedRange: { from: string; to: string };
  columns: ChartColumn[];
  rows: Array<Record<string, string | number>>;
}

interface ChartPoint {
  label: string;
  value: number;
}

interface ChartContextValue {
  spec: ChartSpec;
  points: ChartPoint[];
}

const ChartContext = createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
  const ctx = use(ChartContext);
  if (!ctx) throw new Error("Chart.* components must be rendered inside Chart.Root");
  return ctx;
}

/** Fixed-order categorical fills — literal class names so Tailwind's scanner sees them. */
const SERIES_FILLS = [
  "fill-series-1",
  "fill-series-2",
  "fill-series-3",
  "fill-series-4",
  "fill-series-5",
  "fill-series-6",
  "fill-series-7",
  "fill-series-8",
] as const;
const SERIES_SWATCHES = [
  "bg-series-1",
  "bg-series-2",
  "bg-series-3",
  "bg-series-4",
  "bg-series-5",
  "bg-series-6",
  "bg-series-7",
  "bg-series-8",
] as const;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const moneyExact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatXLabel(groupBy: ChartSpec["groupBy"], label: string): string {
  if (groupBy === "month") {
    const [y, m] = label.split("-").map(Number);
    if (y && m)
      return new Date(Date.UTC(y, m - 1)).toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
  }
  if (groupBy === "day") {
    const d = new Date(`${label}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  return label;
}

function formatRange(range: ChartSpec["appliedRange"]): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

/** Clean tick values (1/2/5 steps) spanning [min(0, data-min), data-max]. */
function niceTicks(values: number[]): number[] {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo || 1;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const ticks: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }
  return ticks;
}

function toPoints(spec: ChartSpec): ChartPoint[] {
  const x = spec.columns.find((c) => c.role === "x");
  const y = spec.columns.find((c) => c.role === "y");
  if (!x || !y) return [];
  return spec.rows.map((row) => ({ label: String(row[x.key]), value: Number(row[y.key]) }));
}

/**
 * The renderer palette holds 8 fixed slots; anything past 7 slices folds into a
 * neutral "Other" (merging a server-sent Other row) so a hue is never invented.
 */
function foldSlices(points: ChartPoint[]): ChartPoint[] {
  const sorted = [...points].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  if (sorted.length <= 8) return sorted;
  const head = sorted.slice(0, 7).filter((p) => p.label !== "Other");
  const rest = sorted.slice(7).concat(sorted.slice(0, 7).filter((p) => p.label === "Other"));
  const other = rest.reduce((sum, p) => sum + p.value, 0);
  return [...head, { label: "Other", value: other }];
}

/* ── Tooltip (shared, positioned in SVG pixel space) ─────────────────────── */

interface TooltipState {
  x: number;
  y: number;
  label: string;
  value: number;
}

function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      className="bg-overlay border-hairline-strong text-fg pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full border px-2 py-1 text-xs whitespace-nowrap"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <span className="text-fg-muted">{tip.label}</span>{" "}
      <span className="tabular-nums">{moneyExact.format(tip.value)}</span>
    </div>
  );
}

/* ── Root & chrome ───────────────────────────────────────────────────────── */

type RootProps = React.ComponentProps<"figure"> & { spec: ChartSpec };

function Root({ spec, className, children, ...props }: RootProps) {
  return (
    <ChartContext.Provider value={{ spec, points: toPoints(spec) }}>
      <figure
        className={cn("border-hairline bg-raised m-0 max-w-2xl border p-4", className)}
        {...props}
      >
        {children}
      </figure>
    </ChartContext.Provider>
  );
}

function Title({ className, ...props }: React.ComponentProps<"figcaption">) {
  const { spec } = useChart();
  return (
    <figcaption className={cn("text-fg-strong text-sm font-medium", className)} {...props}>
      {spec.title}
    </figcaption>
  );
}

function Range({ className, ...props }: React.ComponentProps<"p">) {
  const { spec } = useChart();
  return (
    <p className={cn("text-fg-muted mt-0.5 mb-3 text-xs", className)} {...props}>
      {formatRange(spec.appliedRange)}
    </p>
  );
}

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-fg-muted flex h-48 items-center justify-center text-sm", className)}
      {...props}
    >
      No transactions in this range
    </div>
  );
}

/* ── Pie (donut) — categorical identity, legend-carried ──────────────────── */

const PIE_SIZE = 220;
const PIE_R = PIE_SIZE / 2;

function Pie({ className, ...props }: React.ComponentProps<"div">) {
  const { points } = useChart();
  const [tip, setTip] = useState<TooltipState | null>(null);
  if (points.length === 0) return <Empty />;

  const slices = foldSlices(points);
  const total = slices.reduce((sum, p) => sum + p.value, 0);
  const arcs = d3pie<ChartPoint>()
    .value((p) => p.value)
    .sort(null)
    .padAngle(2 / PIE_R)(slices);
  const arcGen = d3arc<(typeof arcs)[number]>()
    .innerRadius(PIE_R * 0.62)
    .outerRadius(PIE_R);

  return (
    <div className={cn("flex items-center gap-6", className)} {...props}>
      <div className="relative shrink-0">
        <svg width={PIE_SIZE} height={PIE_SIZE} role="img">
          <g transform={`translate(${PIE_R},${PIE_R})`}>
            {arcs.map((a, i) => {
              const isOther = a.data.label === "Other";
              const [cx, cy] = arcGen.centroid(a);
              return (
                <path
                  key={a.data.label}
                  d={arcGen(a) ?? undefined}
                  className={cn(
                    isOther ? "fill-series-other" : SERIES_FILLS[i],
                    "transition-opacity",
                    tip && tip.label !== a.data.label && "opacity-50",
                  )}
                  onMouseEnter={() =>
                    setTip({
                      x: cx + PIE_R,
                      y: cy + PIE_R,
                      label: a.data.label,
                      value: a.data.value,
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
              );
            })}
          </g>
          <text
            x={PIE_R}
            y={PIE_R - 4}
            textAnchor="middle"
            className="fill-fg-strong text-lg font-medium"
          >
            {money.format(total)}
          </text>
          <text x={PIE_R} y={PIE_R + 14} textAnchor="middle" className="fill-fg-muted text-[10px]">
            total
          </text>
        </svg>
        <Tooltip tip={tip} />
      </div>
      <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1.5 p-0">
        {slices.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "size-2 shrink-0",
                p.label === "Other" ? "bg-series-other" : SERIES_SWATCHES[i],
              )}
            />
            <span className="text-fg min-w-0 flex-1 truncate">{p.label}</span>
            <span className="text-fg-muted shrink-0 tabular-nums">{money.format(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Shared cartesian frame ──────────────────────────────────────────────── */

const W = 640;
const H = 240;
const MARGIN = { top: 16, right: 16, bottom: 24, left: 56 };
const INNER_W = W - MARGIN.left - MARGIN.right;
const INNER_H = H - MARGIN.top - MARGIN.bottom;

function yScale(ticks: number[]): (v: number) => number {
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  return (v) => MARGIN.top + INNER_H - ((v - lo) / (hi - lo || 1)) * INNER_H;
}

function GridAndAxis({ ticks, y }: { ticks: number[]; y: (v: number) => number }) {
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={MARGIN.left}
            x2={W - MARGIN.right}
            y1={y(t)}
            y2={y(t)}
            className={t === 0 ? "stroke-hairline-strong" : "stroke-hairline"}
            strokeWidth={1}
          />
          <text
            x={MARGIN.left - 8}
            y={y(t) + 3}
            textAnchor="end"
            className="fill-fg-muted text-[10px] tabular-nums"
          >
            {money.format(t)}
          </text>
        </g>
      ))}
    </>
  );
}

/* ── Bars — single-series magnitude; accent, negative flips to the negative token ── */

const MAX_BAR = 24;

function Bars({ className, ...props }: React.ComponentProps<"div">) {
  const { spec, points } = useChart();
  const [tip, setTip] = useState<TooltipState | null>(null);
  if (points.length === 0) return <Empty />;

  const ticks = niceTicks(points.map((p) => p.value));
  const y = yScale(ticks);
  const band = INNER_W / points.length;
  const barW = Math.min(MAX_BAR, band * 0.6);
  const labelEvery = Math.ceil(points.length / 12);

  return (
    <div className={cn("relative", className)} {...props}>
      <svg width={W} height={H} className="h-auto max-w-full" role="img">
        <GridAndAxis ticks={ticks} y={y} />
        {points.map((p, i) => {
          const cx = MARGIN.left + band * i + band / 2;
          const top = Math.min(y(p.value), y(0));
          const height = Math.abs(y(p.value) - y(0));
          return (
            <g key={p.label}>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={Math.max(height, 1)}
                className={cn(
                  p.value < 0 ? "fill-negative" : "fill-accent",
                  "transition-opacity",
                  tip && tip.label !== p.label && "opacity-50",
                )}
                onMouseEnter={() => setTip({ x: cx, y: top, label: p.label, value: p.value })}
                onMouseLeave={() => setTip(null)}
              />
              {points.length <= 8 ? (
                <text
                  x={cx}
                  y={p.value < 0 ? top + height + 12 : top - 5}
                  textAnchor="middle"
                  className="fill-fg text-[10px] tabular-nums"
                >
                  {money.format(p.value)}
                </text>
              ) : null}
              {i % labelEvery === 0 ? (
                <text
                  x={cx}
                  y={H - MARGIN.bottom + 14}
                  textAnchor="middle"
                  className="fill-fg-muted text-[10px]"
                >
                  {truncate(formatXLabel(spec.groupBy, p.label), 12)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/* ── Line — single-series change-over-time; accent with a 8% area wash ───── */

function Line({ className, ...props }: React.ComponentProps<"div">) {
  const { spec, points } = useChart();
  const [tip, setTip] = useState<TooltipState | null>(null);
  if (points.length === 0) return <Empty />;

  const ticks = niceTicks(points.map((p) => p.value));
  const y = yScale(ticks);
  const x = (i: number) =>
    points.length === 1
      ? MARGIN.left + INNER_W / 2
      : MARGIN.left + (INNER_W / (points.length - 1)) * i;

  const linePath = d3line<ChartPoint>()
    .x((_, i) => x(i))
    .y((p) => y(p.value))(points);
  const areaPath = d3area<ChartPoint>()
    .x((_, i) => x(i))
    .y0(y(Math.max(ticks[0], 0)))
    .y1((p) => y(p.value))(points);

  const last = points[points.length - 1];
  const labelEvery = Math.ceil(points.length / 8);

  return (
    <div className={cn("relative", className)} {...props}>
      <svg width={W} height={H} className="h-auto max-w-full" role="img">
        <GridAndAxis ticks={ticks} y={y} />
        {points.length > 1 ? (
          <>
            <path d={areaPath ?? undefined} className="fill-accent" fillOpacity={0.08} />
            <path
              d={linePath ?? undefined}
              className="stroke-accent"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}
        {points.map((p, i) => (
          <g key={p.label}>
            {i % labelEvery === 0 || i === points.length - 1 ? (
              <text
                x={x(i)}
                y={H - MARGIN.bottom + 14}
                textAnchor="middle"
                className="fill-fg-muted text-[10px]"
              >
                {formatXLabel(spec.groupBy, p.label)}
              </text>
            ) : null}
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={12}
              fill="transparent"
              onMouseEnter={() =>
                setTip({
                  x: x(i),
                  y: y(p.value),
                  label: formatXLabel(spec.groupBy, p.label),
                  value: p.value,
                })
              }
              onMouseLeave={() => setTip(null)}
            />
            {tip?.label === formatXLabel(spec.groupBy, p.label) ||
            i === points.length - 1 ||
            points.length === 1 ? (
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r={4.5}
                className="fill-accent stroke-raised"
                strokeWidth={2}
                pointerEvents="none"
              />
            ) : null}
          </g>
        ))}
        <text
          x={Math.min(x(points.length - 1) + 8, W - MARGIN.right + 14)}
          y={y(last.value) + 3}
          textAnchor={points.length === 1 ? "middle" : "start"}
          className="fill-fg text-[10px] tabular-nums"
        >
          {points.length === 1 ? "" : money.format(last.value)}
        </text>
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ── Factory — what the chat tool-result renderer calls ──────────────────── */

const PLOTS: Record<ChartType, (props: React.ComponentProps<"div">) => React.ReactNode> = {
  pie: Pie,
  bar: Bars,
  line: Line,
};

function FromSpec({ spec, ...props }: RootProps) {
  const Plot = PLOTS[spec.chartType];
  return (
    <Root spec={spec} {...props}>
      <Title />
      <Range />
      <Plot />
    </Root>
  );
}

export const Chart = {
  Root,
  Title,
  Range,
  Empty,
  Pie,
  Bars,
  Line,
  FromSpec,
};
