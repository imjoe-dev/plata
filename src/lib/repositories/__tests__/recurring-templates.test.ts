import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { sql } from "drizzle-orm";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import { getDB } from "@/db";
import {
  createRecurringTemplate,
  getRecurringTemplateById,
  listDueTemplates,
  listAllDueTemplates,
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

  describe("listAllDueTemplates (cross-user query)", () => {
    it("returns active templates with next_due_date <= now across all users", async () => {
      await seedTpl("user_1", "due_1", { next_due_date: new Date("2026-07-01") });
      await seedTpl("user_1", "future_1", { next_due_date: new Date("2026-12-01") });
      await seedTpl("user_2", "due_2", { next_due_date: new Date("2026-07-01") });
      await seedTpl("user_2", "future_2", { next_due_date: new Date("2026-12-01") });
      const due = await listAllDueTemplates(new Date("2026-07-02"));
      expect(due.map((t) => t.id).sort()).toEqual(["due_1", "due_2"]);
    });

    it("returns empty array when no templates match", async () => {
      await seedTpl("user_1", "future_1", { next_due_date: new Date("2026-12-01") });
      await seedTpl("user_2", "future_2", { next_due_date: new Date("2026-12-01") });
      const due = await listAllDueTemplates(new Date("2026-07-02"));
      expect(due).toEqual([]);
    });

    it("excludes paused templates", async () => {
      await seedTpl("user_1", "active", {
        status: "active",
        next_due_date: new Date("2026-07-01"),
      });
      await seedTpl("user_1", "paused", {
        status: "paused",
        next_due_date: new Date("2026-07-01"),
      });
      const due = await listAllDueTemplates(new Date("2026-07-02"));
      expect(due.map((t) => t.id)).toEqual(["active"]);
    });

    it("excludes completed templates", async () => {
      await seedTpl("user_1", "active", {
        status: "active",
        next_due_date: new Date("2026-07-01"),
      });
      await seedTpl("user_1", "completed", {
        status: "completed",
        next_due_date: new Date("2026-07-01"),
      });
      const due = await listAllDueTemplates(new Date("2026-07-02"));
      expect(due.map((t) => t.id)).toEqual(["active"]);
    });

    it("excludes failed templates", async () => {
      await seedTpl("user_1", "active", {
        status: "active",
        next_due_date: new Date("2026-07-01"),
      });
      await seedTpl("user_1", "failed", {
        status: "failed",
        next_due_date: new Date("2026-07-01"),
      });
      const due = await listAllDueTemplates(new Date("2026-07-02"));
      expect(due.map((t) => t.id)).toEqual(["active"]);
    });

    it("includes all necessary fields for service layer", async () => {
      await seedTpl("user_1", "rec_1", {
        amount: 5000,
        cadence: "monthly",
        next_due_date: new Date("2026-07-01"),
        last_insertion_date: null,
        end_date: new Date("2026-12-31"),
      });
      const [template] = await listAllDueTemplates(new Date("2026-07-02"));
      expect(template).toHaveProperty("id");
      expect(template).toHaveProperty("user_id");
      expect(template).toHaveProperty("status");
      expect(template).toHaveProperty("next_due_date");
      expect(template).toHaveProperty("last_insertion_date");
      expect(template).toHaveProperty("end_date");
      expect(template).toHaveProperty("cadence");
      expect(template).toHaveProperty("amount");
      expect(template).toHaveProperty("category_id");
      expect(template).toHaveProperty("description");
    });

    it("respects the exact due date boundary", async () => {
      const now = new Date("2026-07-13T12:00:00Z");
      await seedTpl("user_1", "exact", { next_due_date: new Date("2026-07-13T12:00:00Z") });
      await seedTpl("user_1", "after", { next_due_date: new Date("2026-07-13T12:00:01Z") });
      const due = await listAllDueTemplates(now);
      expect(due.map((t) => t.id)).toEqual(["exact"]);
    });

    it("uses the recurring_templates_status_next_due_date_idx composite index", () => {
      const plan = getDB().all(
        sql`EXPLAIN QUERY PLAN SELECT * FROM recurring_templates WHERE status = 'active' AND next_due_date <= 0`,
      );
      const planText = JSON.stringify(plan);
      expect(planText).toContain("recurring_templates_status_next_due_date_idx");
    });
  });
});
