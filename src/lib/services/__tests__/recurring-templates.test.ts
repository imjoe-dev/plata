import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InternalError, NotFoundError } from "@/lib/errors";
import { runBatch } from "@/lib/db/transaction";

vi.mock("@/lib/repositories/recurring-templates", () => ({
  createRecurringTemplate: vi.fn(),
  getRecurringTemplateById: vi.fn(),
  listRecurringTemplates: vi.fn(),
  updateRecurringTemplate: vi.fn(),
  softDeleteRecurringTemplate: vi.fn(),
  listDueTemplates: vi.fn(),
  buildUpdateTemplate: vi.fn(() => ({ __update: true })),
}));
vi.mock("@/lib/repositories/transactions", () => ({
  buildInsertTransaction: vi.fn(() => ({ __insert: true })),
}));
vi.mock("@/lib/db/transaction", () => ({
  runBatch: vi.fn(async () => ({ success: true as const })),
}));
vi.mock("@/lib/repositories/category", () => ({
  getCategoryById: vi.fn(),
}));

import * as recRepo from "@/lib/repositories/recurring-templates";
import * as catRepo from "@/lib/repositories/category";
import * as txnRepo from "@/lib/repositories/transactions";
import {
  activateTemplate,
  computeNextDue,
  createRecurringTemplate,
  deleteRecurringTemplate,
  getRecurringTemplate,
  pauseTemplate,
  processDueRecurring,
  updateRecurringTemplate,
} from "@/lib/services/recurring-templates";

const validInput = {
  amount: 1500,
  currency: "USD",
  type: "expense" as const,
  description: "Rent",
  cadence: "monthly" as const,
  status: "active" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recurring-templates service", () => {
  it("creates a template with no FK refs", async () => {
    vi.mocked(recRepo.createRecurringTemplate).mockResolvedValueOnce({ id: "r1" } as any);
    await createRecurringTemplate("user_1", validInput);
    const [, payload] = vi.mocked(recRepo.createRecurringTemplate).mock.calls[0];
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.user_id).toBe("user_1");
    expect(payload.amount).toBe(1500);
  });

  it("throws NotFound when categoryId is not owned by the user", async () => {
    vi.mocked(catRepo.getCategoryById).mockResolvedValueOnce(null);
    await expect(
      createRecurringTemplate("user_1", { ...validInput, categoryId: "c1" }),
    ).rejects.toMatchObject({
      status: 404,
      resource: "category",
    });
  });

  it("throws InternalError when repo returns null on create", async () => {
    vi.mocked(recRepo.createRecurringTemplate).mockResolvedValueOnce(null as any);
    await expect(createRecurringTemplate("user_1", validInput)).rejects.toBeInstanceOf(
      InternalError,
    );
  });

  it("get/list/update/delete throw NotFound on null", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce(null);
    vi.mocked(recRepo.updateRecurringTemplate).mockResolvedValueOnce(null);
    vi.mocked(recRepo.softDeleteRecurringTemplate).mockResolvedValueOnce(null);
    await expect(getRecurringTemplate("user_1", "r1")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateRecurringTemplate("user_1", "r1", { description: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteRecurringTemplate("user_1", "r1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pauseTemplate is legal from active", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce({
      id: "r1",
      status: "active",
    } as any);
    vi.mocked(recRepo.updateRecurringTemplate).mockResolvedValueOnce({
      id: "r1",
      status: "paused",
    } as any);
    const out = await pauseTemplate("user_1", "r1");
    expect(out.status).toBe("paused");
  });

  it("pauseTemplate throws InternalError from completed", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce({
      id: "r1",
      status: "completed",
    } as any);
    await expect(pauseTemplate("user_1", "r1")).rejects.toBeInstanceOf(InternalError);
  });

  it("activateTemplate is legal from paused", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce({
      id: "r1",
      status: "paused",
    } as any);
    vi.mocked(recRepo.updateRecurringTemplate).mockResolvedValueOnce({
      id: "r1",
      status: "active",
    } as any);
    expect((await activateTemplate("user_1", "r1")).status).toBe("active");
  });

  it("activateTemplate throws InternalError from completed", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce({
      id: "r1",
      status: "completed",
    } as any);
    await expect(activateTemplate("user_1", "r1")).rejects.toBeInstanceOf(InternalError);
  });
});

describe("computeNextDue", () => {
  it("advances monthly and is not completed without end_date", () => {
    const { nextDue, completed } = computeNextDue(new Date("2026-07-01"), "monthly", null);
    expect(nextDue).toEqual(new Date("2026-08-01"));
    expect(completed).toBe(false);
  });

  it("is completed when nextDue passes end_date", () => {
    const { nextDue, completed } = computeNextDue(
      new Date("2026-11-01"),
      "monthly",
      new Date("2026-11-15"),
    );
    expect(nextDue).toEqual(new Date("2026-12-01"));
    expect(completed).toBe(true);
  });

  it("advances quarterly by 3 months", () => {
    expect(computeNextDue(new Date("2026-01-01"), "quarterly", null).nextDue).toEqual(
      new Date("2026-04-01"),
    );
  });
});

describe("processDueRecurring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runBatch).mockResolvedValue({ success: true });
  });

  it("inserts a transaction and updates the template atomically per due template", async () => {
    vi.mocked(recRepo.listDueTemplates).mockResolvedValueOnce([
      {
        id: "r1",
        user_id: "user_1",
        amount: 1000,
        currency: "USD",
        type: "expense",
        description: "Rent",
        cadence: "monthly",
        next_due_date: new Date("2026-07-01"),
        last_insertion_date: null,
        status: "active",
        end_date: null,
        category_id: null,
      } as any,
    ]);

    const res = await processDueRecurring("user_1", new Date("2026-07-02"));

    expect(res.processed).toBe(1);
    expect(runBatch).toHaveBeenCalledTimes(1);
    expect(txnRepo.buildInsertTransaction).toHaveBeenCalledTimes(1);
    expect(recRepo.buildUpdateTemplate).toHaveBeenCalledTimes(1);
    const [batchArgs] = vi.mocked(runBatch).mock.calls[0];
    expect(batchArgs).toEqual([{ __insert: true }, { __update: true }]);

    // buildUpdateTemplate is called as (userId, id, patch) — patch is 3rd arg.
    const [, , patch] = vi.mocked(recRepo.buildUpdateTemplate).mock.calls[0];
    expect((patch.next_due_date as Date).getUTCMonth()).toBe(7); // August (0-indexed: Jan=0, Aug=7)
    expect(patch.last_insertion_date).toEqual(new Date("2026-07-02"));
    expect(patch.status).toBeUndefined(); // not completed (no end_date)
  });

  it("marks the template completed when the new next_due_date passes end_date", async () => {
    vi.mocked(recRepo.listDueTemplates).mockResolvedValueOnce([
      {
        id: "r1",
        user_id: "user_1",
        amount: 1000,
        currency: "USD",
        type: "expense",
        description: "Rent",
        cadence: "monthly",
        next_due_date: new Date("2026-11-01"),
        last_insertion_date: null,
        status: "active",
        end_date: new Date("2026-11-15"),
        category_id: null,
      } as any,
    ]);

    const res = await processDueRecurring("user_1", new Date("2026-11-02"));
    expect(res.processed).toBe(1);
    const [, , patch] = vi.mocked(recRepo.buildUpdateTemplate).mock.calls[0];
    expect(patch.status).toBe("completed");
  });

  it("skips a template already inserted this period (idempotency)", async () => {
    vi.mocked(recRepo.listDueTemplates).mockResolvedValueOnce([
      {
        id: "r1",
        user_id: "user_1",
        amount: 1000,
        currency: "USD",
        type: "expense",
        description: "Rent",
        cadence: "monthly",
        next_due_date: new Date("2026-07-01"),
        last_insertion_date: new Date("2026-07-01T12:00:00Z"),
        status: "active",
        end_date: null,
        category_id: null,
      } as any,
    ]);

    const res = await processDueRecurring("user_1", new Date("2026-07-02"));
    expect(res.processed).toBe(0);
    expect(runBatch).not.toHaveBeenCalled();
    expect(txnRepo.buildInsertTransaction).not.toHaveBeenCalled();
  });
});
