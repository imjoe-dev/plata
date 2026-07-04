import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InternalError, NotFoundError } from "@/lib/errors";

vi.mock("@/lib/repositories/transactions", () => ({
  createTransaction: vi.fn(),
  getTransactionById: vi.fn(),
  listTransactions: vi.fn(),
  updateTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
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

import * as txnRepo from "@/lib/repositories/transactions";
import * as catRepo from "@/lib/repositories/category";
import * as recRepo from "@/lib/repositories/recurring-templates";
import {
  createTransaction,
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
    const [, payload] = vi.mocked(txnRepo.createTransaction).mock.calls[0];
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

  it("listTransactions delegates and passes filters", async () => {
    vi.mocked(txnRepo.listTransactions).mockResolvedValueOnce([]);
    await listTransactions("user_1", { type: "income" });
    expect(txnRepo.listTransactions).toHaveBeenCalledWith("user_1", { type: "income" });
  });

  it("updateTransaction and deleteTransaction throw NotFound on null", async () => {
    vi.mocked(txnRepo.updateTransaction).mockResolvedValueOnce(null);
    vi.mocked(txnRepo.softDeleteTransaction).mockResolvedValueOnce(null);
    await expect(updateTransaction("user_1", "t1", { description: "Y" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(deleteTransaction("user_1", "t1")).rejects.toBeInstanceOf(NotFoundError);
  });
});
