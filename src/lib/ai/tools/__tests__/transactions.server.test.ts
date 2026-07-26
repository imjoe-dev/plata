import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/lib/services/transactions", () => ({
  createTransaction: vi.fn(),
  createTransactions: vi.fn(),
  getTransaction: vi.fn(),
  listTransactions: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import { env } from "cloudflare:workers";
import { NotFoundError } from "@/lib/errors";
import * as svc from "@/lib/services/transactions";
import { transactionServerTools } from "@/lib/ai/tools/transactions";

const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);

const NOW = new Date("2026-07-01T00:00:00.000Z");

function dbRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "t1",
    amount: 999,
    currency: "USD",
    type: "expense",
    description: "Lunch",
    date: NOW,
    category_id: null,
    user_id: "u1",
    recurring_template_id: null,
    source: "chat",
    notes: null,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    ...overrides,
  };
}

function ctx() {
  return { context: { userId: "u1" }, emitCustomEvent: vi.fn() };
}

function findTool(name: string): any {
  const tool = transactionServerTools.find((t) => t.name === name);
  if (!tool?.execute) throw new Error(`tool ${name} not found or has no execute fn`);
  return tool;
}

beforeEach(() => {
  vi.clearAllMocks();
  limitSpy.mockResolvedValue({ success: true });
});

describe("list_transactions server tool", () => {
  it("defaults page=1/limit=20, converts amounts to major units, and reports hasMore=false when exhausted", async () => {
    vi.mocked(svc.listTransactions).mockResolvedValueOnce({
      rows: [dbRow({ id: "t1", amount: 999 }) as any],
      total: 1,
    });
    const tool = findTool("list_transactions");
    const result = await tool.execute!({} as any, ctx() as any);
    expect(result).toEqual({
      transactions: [dbRow({ id: "t1", amount: 9.99, date: NOW.toISOString() })].map((r) => ({
        ...r,
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
      })),
      page: 1,
      limit: 20,
      total: 1,
      hasMore: false,
    });
    expect(svc.listTransactions).toHaveBeenCalledWith("u1", expect.objectContaining({}), {
      page: 1,
      limit: 20,
    });
  });

  it("reports hasMore=true for a partial window and passes explicit page/limit through", async () => {
    vi.mocked(svc.listTransactions).mockResolvedValueOnce({
      rows: Array.from({ length: 10 }, (_, i) => dbRow({ id: `t${i}`, amount: 100 }) as any),
      total: 25,
    });
    const tool = findTool("list_transactions");
    const result = await tool.execute!({ page: 2, limit: 10 } as any, ctx() as any);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.hasMore).toBe(true);
    expect(svc.listTransactions).toHaveBeenCalledWith("u1", expect.anything(), {
      page: 2,
      limit: 10,
    });
  });

  it("reports hasMore=false exactly at the boundary (page * limit === total)", async () => {
    vi.mocked(svc.listTransactions).mockResolvedValueOnce({
      rows: Array.from({ length: 5 }, (_, i) => dbRow({ id: `t${i}`, amount: 100 }) as any),
      total: 10,
    });
    const tool = findTool("list_transactions");
    const result = await tool.execute!({ page: 2, limit: 5 } as any, ctx() as any);
    expect(result.hasMore).toBe(false);
  });

  it("passes date range, type, and category filters through to the service", async () => {
    vi.mocked(svc.listTransactions).mockResolvedValueOnce({ rows: [], total: 0 });
    const tool = findTool("list_transactions");
    await tool.execute!(
      {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-12-31T00:00:00.000Z",
        type: "income",
        categoryId: "cat-1",
      } as any,
      ctx() as any,
    );
    const [userId, filters, pagination] = vi.mocked(svc.listTransactions).mock.calls[0];
    expect(userId).toBe("u1");
    expect(filters).toMatchObject({ type: "income", categoryId: "cat-1" });
    expect((filters as any).from).toBeInstanceOf(Date);
    expect((filters as any).to).toBeInstanceOf(Date);
    expect(pagination).toEqual({ page: 1, limit: 20 });
  });
});

describe("get_transaction server tool", () => {
  it("scopes the lookup to the current user and converts the amount to major units", async () => {
    vi.mocked(svc.getTransaction).mockResolvedValueOnce(dbRow({ id: "t1", amount: 500 }) as any);
    const tool = findTool("get_transaction");
    const result = await tool.execute!({ id: "t1" } as any, ctx() as any);
    expect(result).toEqual({
      ...dbRow({ id: "t1", amount: 5 }),
      date: NOW.toISOString(),
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    expect(svc.getTransaction).toHaveBeenCalledWith("u1", "t1");
  });

  it("propagates a NotFoundError thrown by the service unchanged", async () => {
    vi.mocked(svc.getTransaction).mockRejectedValueOnce(
      new NotFoundError("transaction", "missing"),
    );
    const tool = findTool("get_transaction");
    await expect(tool.execute!({ id: "missing" } as any, ctx() as any)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("create_transaction server tool", () => {
  it("checks the mutation rate limit before creating, converts dollars to cents, and returns dollars", async () => {
    vi.mocked(svc.createTransaction).mockResolvedValueOnce(
      dbRow({ id: "t1", amount: 1234 }) as any,
    );
    const tool = findTool("create_transaction");
    const result = await tool.execute!(
      {
        amount: 12.34,
        type: "expense",
        description: "Lunch",
        date: "2026-07-01T00:00:00.000Z",
        source: "chat",
        currency: "USD",
      } as any,
      ctx() as any,
    );
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    expect(result).toEqual({
      ...dbRow({ id: "t1", amount: 12.34 }),
      date: NOW.toISOString(),
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    const [userId, payload] = vi.mocked(svc.createTransaction).mock.calls[0];
    expect(userId).toBe("u1");
    expect((payload as any).amount).toBe(1234);
    expect((payload as any).date).toBeInstanceOf(Date);
  });

  it("throws and never calls the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });
    const tool = findTool("create_transaction");
    await expect(
      tool.execute!(
        {
          amount: 10,
          type: "expense",
          description: "x",
          date: "2026-07-01T00:00:00.000Z",
          source: "manual",
          currency: "USD",
        } as any,
        ctx() as any,
      ),
    ).rejects.toThrow();
    expect(svc.createTransaction).not.toHaveBeenCalled();
  });
});

describe("create_transactions server tool", () => {
  it("checks the mutation rate limit exactly once regardless of item count, and returns every created row in order", async () => {
    vi.mocked(svc.createTransactions).mockResolvedValueOnce([
      dbRow({ id: "t1", amount: 1234 }) as any,
      dbRow({ id: "t2", amount: 4000 }) as any,
    ]);
    const tool = findTool("create_transactions");
    const result = await tool.execute!(
      {
        transactions: [
          {
            amount: 12.34,
            type: "expense",
            description: "Coffee",
            date: "2026-07-01T00:00:00.000Z",
            source: "chat",
            currency: "USD",
          },
          {
            amount: 40,
            type: "expense",
            description: "Groceries",
            date: "2026-07-01T00:00:00.000Z",
            source: "chat",
            currency: "USD",
          },
        ],
      } as any,
      ctx() as any,
    );
    expect(limitSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        ...dbRow({ id: "t1", amount: 12.34 }),
        date: NOW.toISOString(),
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
      },
      {
        ...dbRow({ id: "t2", amount: 40 }),
        date: NOW.toISOString(),
        created_at: NOW.toISOString(),
        updated_at: NOW.toISOString(),
      },
    ]);
    const [userId, payloads] = vi.mocked(svc.createTransactions).mock.calls[0];
    expect(userId).toBe("u1");
    expect(payloads).toHaveLength(2);
  });

  it("throws and never calls the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });
    const tool = findTool("create_transactions");
    await expect(
      tool.execute!(
        {
          transactions: [
            {
              amount: 10,
              type: "expense",
              description: "x",
              date: "2026-07-01T00:00:00.000Z",
              source: "manual",
              currency: "USD",
            },
          ],
        } as any,
        ctx() as any,
      ),
    ).rejects.toThrow();
    expect(svc.createTransactions).not.toHaveBeenCalled();
  });
});

describe("update_transaction server tool", () => {
  it("checks the rate limit, strips id from the patch, converts amount to cents, and returns dollars", async () => {
    vi.mocked(svc.updateTransaction).mockResolvedValueOnce(
      dbRow({ id: "t1", amount: 2500 }) as any,
    );
    const tool = findTool("update_transaction");
    const result = await tool.execute!({ id: "t1", amount: 25 } as any, ctx() as any);
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    expect(result).toEqual({
      ...dbRow({ id: "t1", amount: 25 }),
      date: NOW.toISOString(),
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    const [userId, id, patch] = vi.mocked(svc.updateTransaction).mock.calls[0];
    expect(userId).toBe("u1");
    expect(id).toBe("t1");
    expect((patch as any).amount).toBe(2500);
    expect(patch as any).not.toHaveProperty("id");
  });

  it("throws and never calls the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });
    const tool = findTool("update_transaction");
    await expect(tool.execute!({ id: "t1", amount: 25 } as any, ctx() as any)).rejects.toThrow();
    expect(svc.updateTransaction).not.toHaveBeenCalled();
  });

  it("propagates a NotFoundError thrown by the service unchanged", async () => {
    vi.mocked(svc.updateTransaction).mockRejectedValueOnce(
      new NotFoundError("transaction", "missing"),
    );
    const tool = findTool("update_transaction");
    await expect(
      tool.execute!({ id: "missing", amount: 5 } as any, ctx() as any),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("delete_transaction server tool", () => {
  it("checks the rate limit before deleting and returns the deleted row in dollars", async () => {
    vi.mocked(svc.deleteTransaction).mockResolvedValueOnce(
      dbRow({ id: "t1", amount: 1000 }) as any,
    );
    const tool = findTool("delete_transaction");
    const result = await tool.execute!({ id: "t1" } as any, ctx() as any);
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    expect(result).toEqual({
      ...dbRow({ id: "t1", amount: 10 }),
      date: NOW.toISOString(),
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    expect(svc.deleteTransaction).toHaveBeenCalledWith("u1", "t1");
  });

  it("throws and never calls the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });
    const tool = findTool("delete_transaction");
    await expect(tool.execute!({ id: "t1" } as any, ctx() as any)).rejects.toThrow();
    expect(svc.deleteTransaction).not.toHaveBeenCalled();
  });

  it("propagates a NotFoundError thrown by the service unchanged", async () => {
    vi.mocked(svc.deleteTransaction).mockRejectedValueOnce(
      new NotFoundError("transaction", "missing"),
    );
    const tool = findTool("delete_transaction");
    await expect(tool.execute!({ id: "missing" } as any, ctx() as any)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
