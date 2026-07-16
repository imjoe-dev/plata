import { describe, expect, it, vi } from "vite-plus/test";

// categories.ts imports the category service, which reaches the D1 client
// (src/db/index.ts) — a static top-level `import { env } from "cloudflare:workers"`
// that only resolves inside the Workers runtime. Every test that transitively
// touches it mocks it, per this repo's convention (see src/lib/api/__tests__/http.test.ts).
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import {
  CategoryRow,
  createCategoryDef,
  deleteCategoryDef,
  getCategoryDef,
  listCategoriesDef,
  updateCategoryDef,
} from "@/lib/ai/tools/categories";

describe("categories tool definitions", () => {
  it("exposes five tools with stable names", () => {
    expect(listCategoriesDef.name).toBe("list_categories");
    expect(createCategoryDef.name).toBe("create_category");
    expect(getCategoryDef.name).toBe("get_category");
    expect(updateCategoryDef.name).toBe("update_category");
    expect(deleteCategoryDef.name).toBe("delete_category");
  });

  it("create_category accepts a valid category and rejects a bad type", () => {
    const parsed = createCategoryDef.inputSchema!.safeParse({
      name: "Food",
      type: "expense",
    });
    expect(parsed.success).toBe(true);
    const bad = createCategoryDef.inputSchema!.safeParse({ name: "Food", type: "nope" });
    expect(bad.success).toBe(false);
  });

  it("update_category requires an id and makes other fields optional", () => {
    const parsed = updateCategoryDef.inputSchema!.safeParse({ id: "c1" });
    expect(parsed.success).toBe(true);
    const noId = updateCategoryDef.inputSchema!.safeParse({ name: "X" });
    expect(noId.success).toBe(false);
  });

  it("get_category and delete_category require only an id", () => {
    expect(getCategoryDef.inputSchema!.safeParse({ id: "c1" }).success).toBe(true);
    expect(getCategoryDef.inputSchema!.safeParse({}).success).toBe(false);
    expect(deleteCategoryDef.inputSchema!.safeParse({ id: "c1" }).success).toBe(true);
  });

  it("CategoryRow validates a snake_case row with ISO timestamps", () => {
    const row = {
      id: "c1",
      name: "Food",
      type: "expense",
      color: null,
      icon: null,
      user_id: "u1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    };
    expect(CategoryRow.safeParse(row).success).toBe(true);
  });

  it("mutating tools (create, update, delete) have needsApproval set to true", () => {
    expect(createCategoryDef.needsApproval).toBe(true);
    expect(updateCategoryDef.needsApproval).toBe(true);
    expect(deleteCategoryDef.needsApproval).toBe(true);
  });

  it("read-only tools (list, get) have no needsApproval field", () => {
    expect(listCategoriesDef.needsApproval).toBeUndefined();
    expect(getCategoryDef.needsApproval).toBeUndefined();
  });
});
