import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import {
  setupTestDB,
  resetTestDB,
  seedUser,
  closeTestDB,
} from "@/lib/repositories/__tests__/db-helper";
import {
  createRecurringTemplate,
  getRecurringTemplateById,
} from "@/lib/repositories/recurring-templates";
import { createTransaction, listTransactions } from "@/lib/repositories/transactions";
import { runScheduledMaterialization } from "@/lib/services/recurring-templates";

// Unlike recurring-templates.test.ts (fully mocked), this runs against a real in-memory DB
// so it can verify a genuine unique-constraint violation is shaped how isDuplicateOccurrenceError expects.
beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
});

describe("runScheduledMaterialization (real DB, unique-index enforcement)", () => {
  it("treats a real duplicate (recurring_template_id, date) row as already-handled: no second transaction, template not failed, next_due_date still advances", async () => {
    const dueDate = new Date("2026-07-01T00:00:00Z");
    const tpl = await createRecurringTemplate({
      id: "tpl_1",
      amount: 1000,
      currency: "USD",
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
      next_due_date: dueDate,
      user_id: "user_1",
    });

    // Simulates the exact race isDuplicateOccurrenceError exists to handle: a row already
    // occupies the (recurring_template_id, date) the unique index guards.
    await createTransaction({
      id: "txn_prior",
      amount: 1000,
      currency: "USD",
      type: "expense",
      description: "Rent",
      date: dueDate,
      recurring_template_id: tpl!.id,
      user_id: "user_1",
      source: "manual",
    });

    const res = await runScheduledMaterialization(new Date("2026-07-02T00:00:00Z"));

    expect(res).toEqual({ processedTemplates: 1, occurrencesCreated: 0, failedTemplates: 0 });

    const txns = await listTransactions("user_1", {}, { page: 1, limit: 50 });
    expect(txns.rows.map((t) => t.id)).toEqual(["txn_prior"]);

    const updated = await getRecurringTemplateById("user_1", "tpl_1");
    expect(updated?.status).toBe("active");
    expect(updated?.next_due_date).toEqual(new Date("2026-08-01T00:00:00Z"));
  });
});
