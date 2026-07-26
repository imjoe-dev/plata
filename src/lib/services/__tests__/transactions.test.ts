import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InternalError, NotFoundError } from "@/lib/errors";

vi.mock("@/lib/repositories/transactions", () => ({
  createTransaction: vi.fn(),
  getTransactionById: vi.fn(),
  listTransactions: vi.fn(),
  updateTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
  buildInsertTransaction: vi.fn((input: any) => ({ __insert: input })),
}));
vi.mock("@/lib/repositories/category", () => ({
  getCategoryById: vi.fn(),
  createCategory: vi.fn(),
  listCategories: vi.fn(),
  updateCategory: vi.fn(),
  softDeleteCategory: vi.fn(),
}));
vi.mock("@/lib/repositories/recurring-templates", () => ({
  getRecurringTemplateById: vi.fn(),
}));
vi.mock("@/lib/db/transaction", () => ({
  runBatch: vi.fn(),
}));

import * as txnRepo from "@/lib/repositories/transactions";
import * as catRepo from "@/lib/repositories/category";
import * as recRepo from "@/lib/repositories/recurring-templates";
import { runBatch } from "@/lib/db/transaction";
import {
  createTransaction,
  createTransactions,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
} from "@/lib/services/transactions";

const validInput = {
  amount: 1234,
  currency: "USD",
  type: "expense" as const,
  description: "Lunch",
  date: new Date("2026-07-01"),
  source: "manual" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transactions service", () => {
  it("creates a transaction with no FK refs", async () => {
    vi.mocked(txnRepo.createTransaction).mockResolvedValueOnce({ id: "t1" } as any);
    await createTransaction("user_1", validInput);
    const [payload] = vi.mocked(txnRepo.createTransaction).mock.calls[0];
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.user_id).toBe("user_1");
    expect(payload.amount).toBe(1234);
  });

  it("throws NotFoundError when categoryId does not belong to the user", async () => {
    vi.mocked(catRepo.getCategoryById).mockResolvedValueOnce(null);
    await expect(
      createTransaction("user_1", { ...validInput, categoryId: "cat_x" }),
    ).rejects.toMatchObject({ status: 404, resource: "category" });
  });

  it("throws NotFoundError when recurringTemplateId does not belong to the user", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce(null);
    await expect(
      createTransaction("user_1", { ...validInput, recurringTemplateId: "rec_x" }),
    ).rejects.toMatchObject({ status: 404, resource: "recurring_template" });
  });

  it("throws InternalError when repo returns null", async () => {
    vi.mocked(txnRepo.createTransaction).mockResolvedValueOnce(null as any);
    await expect(createTransaction("user_1", validInput)).rejects.toBeInstanceOf(InternalError);
  });

  it("getTransaction throws NotFound when repo returns null", async () => {
    vi.mocked(txnRepo.getTransactionById).mockResolvedValueOnce(null);
    await expect(getTransaction("user_1", "t1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("listTransactions delegates and passes filters and pagination", async () => {
    vi.mocked(txnRepo.listTransactions).mockResolvedValueOnce({ rows: [], total: 0 });
    await listTransactions("user_1", { type: "income" }, { page: 1, limit: 20 });
    expect(txnRepo.listTransactions).toHaveBeenCalledWith(
      "user_1",
      { type: "income" },
      {
        page: 1,
        limit: 20,
      },
    );
  });

  it("updateTransaction and deleteTransaction throw NotFound on null", async () => {
    vi.mocked(txnRepo.updateTransaction).mockResolvedValueOnce(null);
    vi.mocked(txnRepo.softDeleteTransaction).mockResolvedValueOnce(null);
    await expect(updateTransaction("user_1", "t1", { description: "Y" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(deleteTransaction("user_1", "t1")).rejects.toBeInstanceOf(NotFoundError);
  });

  describe("createTransactions (batch)", () => {
    it("behaves the same as the singular create path for a 1-item batch", async () => {
      const row = { id: "t1", description: "Coffee" };
      vi.mocked(runBatch).mockResolvedValueOnce([[row]]);

      const result = await createTransactions("user_1", [{ ...validInput, description: "Coffee" }]);

      expect(result).toEqual([row]);
      const [payload] = vi.mocked(txnRepo.buildInsertTransaction).mock.calls[0];
      expect(payload).toMatchObject({ user_id: "user_1", description: "Coffee", amount: 1234 });
    });

    it("creates every row in one atomic batch and returns them in order", async () => {
      const rowA = { id: "t1", description: "Coffee" };
      const rowB = { id: "t2", description: "Groceries" };
      vi.mocked(runBatch).mockResolvedValueOnce([[rowA], [rowB]]);

      const result = await createTransactions("user_1", [
        { ...validInput, description: "Coffee" },
        { ...validInput, description: "Groceries" },
      ]);

      expect(result).toEqual([rowA, rowB]);
      expect(runBatch).toHaveBeenCalledTimes(1);
      const [statements] = vi.mocked(runBatch).mock.calls[0];
      expect(statements).toHaveLength(2);
      expect(vi.mocked(txnRepo.buildInsertTransaction).mock.calls[0][0]).toMatchObject({
        user_id: "user_1",
        description: "Coffee",
      });
      expect(vi.mocked(txnRepo.buildInsertTransaction).mock.calls[1][0]).toMatchObject({
        user_id: "user_1",
        description: "Groceries",
      });
    });

    it("rejects with an item-indexed NotFoundError when a category doesn't belong to the user, and never inserts anything", async () => {
      vi.mocked(catRepo.getCategoryById).mockResolvedValueOnce({ id: "cat_ok" } as any);
      vi.mocked(catRepo.getCategoryById).mockResolvedValueOnce(null);

      await expect(
        createTransactions("user_1", [
          { ...validInput, categoryId: "cat_ok" },
          { ...validInput, categoryId: "cat_bad" },
        ]),
      ).rejects.toMatchObject({
        status: 404,
        resource: "category",
        message: expect.stringContaining("item 1"),
      });
      expect(runBatch).not.toHaveBeenCalled();
    });

    it("rejects with an item-indexed NotFoundError when a recurringTemplateId doesn't belong to the user, and stops checking further items", async () => {
      vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce(null);

      await expect(
        createTransactions("user_1", [
          { ...validInput, recurringTemplateId: "rec_bad" },
          { ...validInput },
        ]),
      ).rejects.toMatchObject({
        status: 404,
        resource: "recurring_template",
        message: expect.stringContaining("item 0"),
      });
      expect(recRepo.getRecurringTemplateById).toHaveBeenCalledTimes(1);
      expect(runBatch).not.toHaveBeenCalled();
    });
  });
});
