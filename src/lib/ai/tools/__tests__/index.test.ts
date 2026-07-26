import { describe, expect, it, vi } from "vite-plus/test";

// index.ts pulls in the category/transaction/recurring-template services (and, transitively,
// the D1 client at src/db/index.ts), which statically imports `cloudflare:workers` — only
// resolvable inside the Workers runtime. Mock it per this repo's convention.
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import { allToolDefinitions } from "@/lib/ai/tools/index";

describe("allToolDefinitions", () => {
  it("contains 21 tools", () => {
    expect(allToolDefinitions).toHaveLength(21);
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
      "create_transactions",
      "get_transaction",
      "update_transaction",
      "delete_transaction",
      "list_recurring_templates",
      "create_recurring_template",
      "create_recurring_templates",
      "get_recurring_template",
      "update_recurring_template",
      "delete_recurring_template",
      "activate_recurring_template",
      "pause_recurring_template",
      "get_user_preferences",
      "update_user_preferences",
    ];
    for (const name of expected) expect(names.has(name)).toBe(true);
  });
});
