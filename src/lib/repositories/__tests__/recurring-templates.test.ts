import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import {
  createRecurringTemplate,
  getRecurringTemplateById,
  listDueTemplates,
  listRecurringTemplates,
  softDeleteRecurringTemplate,
  updateRecurringTemplate,
} from "@/lib/repositories/recurring-templates";

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
  seedUser("user_2");
});

async function seedTpl(userId: string, id: string, over: Record<string, unknown> = {}) {
  return createRecurringTemplate(userId, {
    id,
    amount: 1000,
    currency: "USD",
    type: "expense",
    description: "Rent",
    cadence: "monthly",
    status: "active",
    next_due_date: new Date("2026-07-01"),
    user_id: userId,
    ...over,
  });
}

describe("recurring-templates repository", () => {
  it("creates and retrieves scoped by user", async () => {
    await seedTpl("user_1", "rec_1");
    expect((await getRecurringTemplateById("user_1", "rec_1"))?.description).toBe("Rent");
    expect(await getRecurringTemplateById("user_2", "rec_1")).toBeNull();
  });

  it("lists by status", async () => {
    await seedTpl("user_1", "r1", { status: "active" });
    await seedTpl("user_1", "r2", { status: "paused" });
    expect((await listRecurringTemplates("user_1", { status: "active" })).map((t) => t.id)).toEqual(
      ["r1"],
    );
  });

  it("listDueTemplates returns active templates whose next_due_date <= now", async () => {
    await seedTpl("user_1", "due", { next_due_date: new Date("2026-07-01") });
    await seedTpl("user_1", "future", { next_due_date: new Date("2026-12-01") });
    await seedTpl("user_1", "paused", { status: "paused", next_due_date: new Date("2026-07-01") });
    const due = await listDueTemplates("user_1", new Date("2026-07-02"));
    expect(due.map((t) => t.id)).toEqual(["due"]);
  });

  it("soft-deletes and excludes from reads", async () => {
    await seedTpl("user_1", "r1");
    await softDeleteRecurringTemplate("user_1", "r1");
    expect(await getRecurringTemplateById("user_1", "r1")).toBeNull();
    expect(await listRecurringTemplates("user_1")).toEqual([]);
  });

  it("updateRecurringTemplate returns null for another user's row", async () => {
    await seedTpl("user_1", "r1");
    expect(await updateRecurringTemplate("user_2", "r1", { status: "paused" })).toBeNull();
  });
});
