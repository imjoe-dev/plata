import type { Meta, StoryObj } from "@storybook/react-vite";

import { Chart, type ChartSpec } from "./chart";

function spec(partial: Partial<ChartSpec>): ChartSpec {
  return {
    chartType: "pie",
    title: "Expenses by category",
    metric: "expenses",
    groupBy: "category",
    appliedRange: { from: "2026-07-01", to: "2026-07-18" },
    columns: [
      { key: "label", label: "Category", role: "x" },
      { key: "value", label: "Expenses (USD)", role: "y" },
    ],
    rows: [],
    ...partial,
  };
}

function categoryRows(entries: Array<[string, number]>) {
  return entries.map(([label, value]) => ({ label, value }));
}

const meta = {
  component: Chart.Root,
} satisfies Meta<typeof Chart.Root>;
export default meta;

// The factory path — exactly what the chat tool-result renderer would call.
export const PieByCategory: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        rows: categoryRows([
          ["Rent", 1200],
          ["Groceries", 486.5],
          ["Dining out", 233.4],
          ["Transport", 145],
          ["Subscriptions", 88.97],
          ["Entertainment", 64],
        ]),
      })}
    />
  ),
};

// 13 server rows (top 12 + server "Other") fold to 7 slices + a neutral Other —
// the renderer palette never invents a 9th hue.
export const PieThirteenCategories: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        title: "Expenses by category",
        rows: categoryRows([
          ["Rent", 1200],
          ["Groceries", 486.5],
          ["Dining out", 233.4],
          ["Transport", 145],
          ["Subscriptions", 88.97],
          ["Entertainment", 64],
          ["Utilities", 130],
          ["Health", 52],
          ["Clothing", 47.2],
          ["Gifts", 30],
          ["Pets", 28.5],
          ["Coffee", 26.75],
          ["Other", 45.1],
        ]),
      })}
    />
  ),
};

export const BarsByCategory: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        chartType: "bar",
        rows: categoryRows([
          ["Rent", 1200],
          ["Groceries", 486.5],
          ["Dining out", 233.4],
          ["Transport", 145],
          ["Subscriptions", 88.97],
          ["Entertainment", 64],
        ]),
      })}
    />
  ),
};

// The known pain: long category names under vertical columns.
export const BarsLongCategoryNames: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        chartType: "bar",
        rows: categoryRows([
          ["Household maintenance & repairs", 320],
          ["Streaming subscriptions (shared)", 88.97],
          ["Public transport & rideshares", 145],
          ["Groceries & household staples", 486.5],
          ["Eating out with friends", 233.4],
        ]),
      })}
    />
  ),
};

// Net by month: negative bars drop below the zero baseline in the negative token.
export const BarsNetByMonth: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        chartType: "bar",
        title: "Net by month",
        metric: "net",
        groupBy: "month",
        appliedRange: { from: "2025-08-01", to: "2026-07-18" },
        rows: categoryRows([
          ["2025-08", 420],
          ["2025-09", -180.55],
          ["2025-10", 260],
          ["2025-11", 90],
          ["2025-12", -640.2],
          ["2026-01", 310],
          ["2026-02", 512],
          ["2026-03", -75],
          ["2026-04", 189.9],
          ["2026-05", 402],
          ["2026-06", 350],
          ["2026-07", 128.4],
        ]),
      })}
    />
  ),
};

export const LineExpensesByMonth: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        chartType: "line",
        title: "Expenses by month",
        groupBy: "month",
        appliedRange: { from: "2025-08-01", to: "2026-07-18" },
        rows: categoryRows([
          ["2025-08", 1890],
          ["2025-09", 2240.3],
          ["2025-10", 1975],
          ["2025-11", 2410],
          ["2025-12", 3120.8],
          ["2026-01", 2050],
          ["2026-02", 1820],
          ["2026-03", 2205],
          ["2026-04", 1990.45],
          ["2026-05", 2130],
          ["2026-06", 2320],
          ["2026-07", 1140.6],
        ]),
      })}
    />
  ),
};

export const LineExpensesByDay: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        chartType: "line",
        title: "Expenses by day",
        groupBy: "day",
        appliedRange: { from: "2026-06-19", to: "2026-07-18" },
        rows: categoryRows(
          Array.from({ length: 30 }, (_, i) => {
            const d = new Date(Date.UTC(2026, 5, 19 + i));
            const label = d.toISOString().slice(0, 10);
            const value =
              Math.round((40 + 60 * Math.sin(i / 3) ** 2 + (i % 7 === 5 ? 180 : 0)) * 100) / 100;
            return [label, value] as [string, number];
          }),
        ),
      })}
    />
  ),
};

// A single bucket: no line to draw — one marker, centered.
export const LineSinglePoint: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        chartType: "line",
        title: "Income by year",
        metric: "income",
        groupBy: "year",
        appliedRange: { from: "2026-01-01", to: "2026-07-18" },
        rows: categoryRows([["2026", 41200]]),
      })}
    />
  ),
};

// Empty rows are a SUCCESS per the tool contract — the part still renders.
export const EmptyRange: StoryObj = {
  render: () => (
    <Chart.FromSpec
      spec={spec({
        chartType: "bar",
        title: "Expenses by category",
        appliedRange: { from: "2019-01-01", to: "2019-12-31" },
        rows: [],
      })}
    />
  ),
};

// The compound path — future surfaces (reports page) compose the parts directly.
export const ComposedCompound: StoryObj = {
  render: () => (
    <Chart.Root
      spec={spec({
        rows: categoryRows([
          ["Rent", 1200],
          ["Groceries", 486.5],
          ["Transport", 145],
        ]),
      })}
    >
      <Chart.Title />
      <Chart.Range />
      <Chart.Pie />
    </Chart.Root>
  ),
};
