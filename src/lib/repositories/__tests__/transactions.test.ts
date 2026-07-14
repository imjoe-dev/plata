import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import {
  createTransaction,
  getTransactionById,
  listTransactions,
  softDeleteTransaction,
  updateTransaction,
} from "@/lib/repositories/transactions";
import { createCategory } from "@/lib/repositories/category";

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
  seedUser("user_2");
});

async function seedTxn(userId: string, id: string, date = new Date("2026-07-01")) {
  return createTransaction({
    id,
    amount: 1000,
    currency: "USD",
    type: "expense",
    description: "X",
    date,
    user_id: userId,
    source: "manual",
  });
}

describe("transactions repository", () => {
  it("creates and retrieves a transaction scoped by user", async () => {
    await seedTxn("user_1", "txn_1");
    const got = await getTransactionById("user_1", "txn_1");
    expect(got?.description).toBe("X");
  });

  it("does not leak across users", async () => {
    await seedTxn("user_1", "txn_1");
    expect(await getTransactionById("user_2", "txn_1")).toBeNull();
  });

  it("filters by date range and type", async () => {
    await seedTxn("user_1", "t1", new Date("2026-07-01"));
    await seedTxn("user_1", "t2", new Date("2026-07-15"));
    await seedTxn("user_1", "t3", new Date("2026-08-01"));
    const { rows, total } = await listTransactions(
      "user_1",
      {
        from: new Date("2026-07-01"),
        to: new Date("2026-07-31"),
        type: "expense",
      },
      { page: 1, limit: 20 },
    );
    expect(rows.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
    expect(total).toBe(2);
  });

  it("soft-deletes and excludes from reads", async () => {
    await seedTxn("user_1", "t1");
    await softDeleteTransaction("user_1", "t1");
    expect(await getTransactionById("user_1", "t1")).toBeNull();
    expect(await listTransactions("user_1", {}, { page: 1, limit: 20 })).toEqual({
      rows: [],
      total: 0,
    });
  });

  it("updateTransaction returns null for another user's row", async () => {
    await seedTxn("user_1", "t1");
    expect(await updateTransaction("user_2", "t1", { description: "Y" })).toBeNull();
  });

  describe("pagination", () => {
    const BASE = new Date("2026-01-01T00:00:00.000Z").getTime();

    async function seedMany(userId: string, count: number) {
      // Explicit, strictly increasing created_at timestamps so ordering/pagination
      // assertions are deterministic (the DB default uses subsecond precision, which
      // can tie when inserts happen in the same millisecond during a fast test loop).
      for (let i = 0; i < count; i++) {
        await createTransaction({
          id: `t${i}`,
          amount: 1000,
          currency: "USD",
          type: "expense",
          description: "X",
          date: new Date("2026-07-01"),
          user_id: userId,
          source: "manual",
          created_at: new Date(BASE + i * 1000),
        });
      }
    }

    it("returns the first page with the correct total", async () => {
      await seedMany("user_1", 50);
      const { rows, total } = await listTransactions("user_1", {}, { page: 1, limit: 20 });
      expect(rows).toHaveLength(20);
      expect(total).toBe(50);
    });

    it("returns the partial last page with the correct total", async () => {
      await seedMany("user_1", 50);
      const { rows, total } = await listTransactions("user_1", {}, { page: 3, limit: 20 });
      expect(rows).toHaveLength(10);
      expect(total).toBe(50);
    });

    it("returns an empty page and unchanged total when the page is out of bounds", async () => {
      await seedMany("user_1", 50);
      const { rows, total } = await listTransactions("user_1", {}, { page: 4, limit: 20 });
      expect(rows).toEqual([]);
      expect(total).toBe(50);
    });

    it("reflects only the filtered rows in total when combined with a category filter", async () => {
      await seedMany("user_1", 50);
      await createCategory({
        id: "cat_1",
        name: "Groceries",
        type: "expense",
        user_id: "user_1",
      });
      await createTransaction({
        id: "matched",
        amount: 1000,
        currency: "USD",
        type: "expense",
        description: "X",
        date: new Date("2026-07-01"),
        user_id: "user_1",
        source: "manual",
        category_id: "cat_1",
      });
      const { rows, total } = await listTransactions(
        "user_1",
        { categoryId: "cat_1" },
        { page: 1, limit: 20 },
      );
      expect(rows.map((t) => t.id)).toEqual(["matched"]);
      expect(total).toBe(1);
    });

    it("returns distinct, correctly ordered slices for successive pages", async () => {
      await seedMany("user_1", 50);
      const p1 = await listTransactions("user_1", {}, { page: 1, limit: 20 });
      const p2 = await listTransactions("user_1", {}, { page: 2, limit: 20 });
      // Seeded t0..t49 with increasing created_at; desc order puts t49 first.
      expect(p1.rows.map((t) => t.id)).toEqual(Array.from({ length: 20 }, (_, i) => `t${49 - i}`));
      expect(p2.rows.map((t) => t.id)).toEqual(Array.from({ length: 20 }, (_, i) => `t${29 - i}`));
    });

    it("orders rows by created_at desc, stably across repeated requests", async () => {
      await seedMany("user_1", 25);
      const first = await listTransactions("user_1", {}, { page: 1, limit: 25 });
      const second = await listTransactions("user_1", {}, { page: 1, limit: 25 });
      expect(first.rows.map((t) => t.id)).toEqual(second.rows.map((t) => t.id));
      // Newest created (highest offset in seedMany) comes first.
      expect(first.rows[0]?.id).toBe("t24");
      expect(first.rows.at(-1)?.id).toBe("t0");
    });
  });
});
