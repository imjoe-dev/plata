import { describe, expect, it, vi } from "vite-plus/test";

// `allToolDefinitions` now includes the recurring-templates `.server()` tools, whose module
// reaches `cloudflare:workers` via the service/repository/db chain. Nothing here reads an env
// property at module load time, so an empty stub is enough — this file only asserts on tool
// metadata (names, count), never invokes a handler.
vi.mock("cloudflare:workers", () => ({ env: {} }));

import { allToolDefinitions } from "@/lib/ai/tools/index";

describe("allToolDefinitions", () => {
  it("contains 17 tools", () => {
    expect(allToolDefinitions).toHaveLength(17);
  });

  it("has unique names", () => {
    const names = allToolDefinitions.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes every expected tool name", () => {
    const names = new Set<string>(allToolDefinitions.map((t) => t.name));
    const expected = [
      "list_categories",
      "create_category",
      "get_category",
      "update_category",
      "delete_category",
      "list_transactions",
      "create_transaction",
      "get_transaction",
      "update_transaction",
      "delete_transaction",
      "list_recurring_templates",
      "create_recurring_template",
      "get_recurring_template",
      "update_recurring_template",
      "delete_recurring_template",
      "activate_recurring_template",
      "pause_recurring_template",
    ];
    for (const name of expected) expect(names.has(name)).toBe(true);
  });
});
