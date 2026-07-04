import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import {
  createTransaction,
  getTransactionById,
  listTransactions,
  softDeleteTransaction,
  updateTransaction,
} from "@/lib/repositories/transactions";

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
  return createTransaction(userId, {
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
    const list = await listTransactions("user_1", {
      from: new Date("2026-07-01"),
      to: new Date("2026-07-31"),
      type: "expense",
    });
    expect(list.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
  });

  it("soft-deletes and excludes from reads", async () => {
    await seedTxn("user_1", "t1");
    await softDeleteTransaction("user_1", "t1");
    expect(await getTransactionById("user_1", "t1")).toBeNull();
    expect(await listTransactions("user_1")).toEqual([]);
  });

  it("updateTransaction returns null for another user's row", async () => {
    await seedTxn("user_1", "t1");
    expect(await updateTransaction("user_2", "t1", { description: "Y" })).toBeNull();
  });
});
