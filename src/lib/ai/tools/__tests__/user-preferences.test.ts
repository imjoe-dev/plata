import { describe, expect, it, vi } from "vite-plus/test";

// user-preferences.ts imports the service, which reaches the D1 client
// (src/db/index.ts) via a static top-level `import { env } from "cloudflare:workers"`
// that only resolves inside the Workers runtime. Mocked per this repo's convention
// (see src/lib/ai/tools/__tests__/categories.test.ts).
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import {
  UserPreferencesRow,
  getUserPreferencesDef,
  updateUserPreferencesDef,
  updateUserPreferencesUngatedDef,
} from "@/lib/ai/tools/user-preferences";

describe("user-preferences tool definitions", () => {
  it("exposes two tools with stable names", () => {
    expect(getUserPreferencesDef.name).toBe("get_user_preferences");
    expect(updateUserPreferencesDef.name).toBe("update_user_preferences");
  });

  it("get_user_preferences takes no input", () => {
    expect(getUserPreferencesDef.inputSchema!.safeParse({}).success).toBe(true);
  });

  it("update_user_preferences requires a valid defaultCurrency", () => {
    const parsed = updateUserPreferencesDef.inputSchema!.safeParse({ defaultCurrency: "COP" });
    expect(parsed.success).toBe(true);
    expect(updateUserPreferencesDef.inputSchema!.safeParse({}).success).toBe(false);
    expect(
      updateUserPreferencesDef.inputSchema!.safeParse({ defaultCurrency: "EUR" }).success,
    ).toBe(false);
  });

  it("UserPreferencesRow validates a snake_case row with ISO timestamps", () => {
    const row = {
      user_id: "u1",
      default_currency: "USD",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    expect(UserPreferencesRow.safeParse(row).success).toBe(true);
  });

  it("update_user_preferences has needsApproval set to true", () => {
    expect(updateUserPreferencesDef.needsApproval).toBe(true);
  });

  it("get_user_preferences has no needsApproval field", () => {
    expect(getUserPreferencesDef.needsApproval).toBeUndefined();
  });

  it("Session Approval variant of update_user_preferences has no needsApproval field, under the same tool name", () => {
    expect(updateUserPreferencesUngatedDef.needsApproval).toBeUndefined();
    expect(updateUserPreferencesUngatedDef.name).toBe(updateUserPreferencesDef.name);
  });
});
