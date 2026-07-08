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
  it("GETs /api/transactions with query and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: "t1", amount: 999 }], meta: { count: 1 } }));
    const result = await listTransactionsHandler({ type: "expense" });
    expect(result).toEqual([{ id: "t1", amount: 9.99 }]);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions?type=expense");
  });
});

describe("createTransactionHandler", () => {
  it("POSTs dollars to /api/transactions and converts the response cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 1234 } }, 201));
    const result = await createTransactionHandler({
      amount: 12.34,
      type: "expense",
      description: "Lunch",
      date: new Date("2026-07-01T00:00:00.000Z"),
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
