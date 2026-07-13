import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createTransactionHandler,
  deleteTransactionHandler,
  getTransactionHandler,
  listTransactionsHandler,
  updateTransactionHandler,
} from "@/lib/ai/tools/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("listTransactionsHandler", () => {
  it("returns paginated result with transactions converted to dollars", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        data: [{ id: "t1", amount: 999 }],
        meta: { count: 1, page: 1, limit: 20, total: 50, hasMore: true },
      }),
    );
    const result = await listTransactionsHandler({ type: "expense" });
    expect(result).toEqual({
      transactions: [{ id: "t1", amount: 9.99 }],
      page: 1,
      limit: 20,
      total: 50,
      hasMore: true,
    });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions?type=expense");
  });

  it("includes page and limit in query params", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        data: [],
        meta: { count: 0, page: 2, limit: 50, total: 100, hasMore: true },
      }),
    );
    await listTransactionsHandler({ page: 2, limit: 50 });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("page=2");
    expect(url).toContain("limit=50");
  });

  it("handles all filter params including pagination", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        data: [{ id: "t1", amount: 500 }],
        meta: { count: 1, page: 1, limit: 20, total: 10, hasMore: false },
      }),
    );
    const result = await listTransactionsHandler({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T00:00:00.000Z",
      type: "income",
      categoryId: "cat-1",
      page: 1,
      limit: 20,
    });
    expect(result.transactions).toEqual([{ id: "t1", amount: 5 }]);
    expect(result.hasMore).toBe(false);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("from=2026-01-01");
    expect(url).toContain("type=income");
    expect(url).toContain("categoryId=cat-1");
  });
});

describe("createTransactionHandler", () => {
  it("POSTs dollars to /api/transactions and converts the response cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 1234 } }, 201));
    const result = await createTransactionHandler({
      amount: 12.34,
      type: "expense",
      description: "Lunch",
      date: "2026-07-01T00:00:00.000Z",
      source: "chat",
      currency: "USD",
    });
    expect(result).toEqual({ id: "t1", amount: 12.34 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.amount).toBe(12.34);
    expect(body.date).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("getTransactionHandler", () => {
  it("GETs /api/transactions/$id and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 500 } }));
    const result = await getTransactionHandler({ id: "t1" });
    expect(result).toEqual({ id: "t1", amount: 5 });
  });
});

describe("updateTransactionHandler", () => {
  it("PATCHes the patch (without id) and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 2500 } }));
    const result = await updateTransactionHandler({ id: "t1", amount: 25 });
    expect(result).toEqual({ id: "t1", amount: 25 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions/t1");
    expect(JSON.parse(init.body as string)).toEqual({ amount: 25 });
  });
});

describe("deleteTransactionHandler", () => {
  it("DELETEs /api/transactions/$id and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 1000 } }));
    const result = await deleteTransactionHandler({ id: "t1" });
    expect(result).toEqual({ id: "t1", amount: 10 });
  });
});
