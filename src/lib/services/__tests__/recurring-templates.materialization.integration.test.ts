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

// Unlike recurring-templates.test.ts (which mocks every repository), this
// suite runs `runScheduledMaterialization` against a real in-memory
// better-sqlite3 DB migrated from `drizzle/`, so it actually exercises the
// `transactions_recurring_template_due_unique` partial index created by
// infra-01. That's the one behavior a fully-mocked `runBatch` can't verify:
// that a genuine DB unique-constraint violation is shaped the way
// `isDuplicateOccurrenceError` expects (a `SQLITE_CONSTRAINT_UNIQUE` code
// surfacing through `runBatch`'s `InternalError` cause chain).
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
    const tpl = await createRecurringTemplate("user_1", {
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

    // Simulate an occurrence already materialized by a prior/overlapping run
    // that never got to advance the template's next_due_date (the exact race
    // `isDuplicateOccurrenceError` exists to handle) — a real transaction row
    // already occupies the (recurring_template_id, date) the unique index guards.
    await createTransaction("user_1", {
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
