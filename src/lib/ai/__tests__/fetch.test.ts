import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { apiDelete, apiGet, apiGetWithMeta, apiPatch, apiPost } from "@/lib/ai/fetch";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiGet", () => {
  it("builds a query string and unwraps { data }", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "c1" } }));
    const result = await apiGet("/api/categories", { type: "expense" });
    expect(result).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories?type=expense");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("serializes Date query params as ISO strings and skips null/undefined", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [], meta: { count: 0 } }));
    await apiGet("/api/transactions", {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: undefined,
      categoryId: null,
    });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions?from=2026-01-01T00%3A00%3A00.000Z");
  });

  it("omits the query string when no query is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    await apiGet("/api/categories");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories");
  });
});

describe("apiGetWithMeta", () => {
  it("returns both data and meta from the response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { id: "c1" },
        meta: { count: 1, page: 1, limit: 20, total: 1, hasMore: false },
      }),
    );
    const result = await apiGetWithMeta("/api/categories", { type: "expense" });
    expect(result).toEqual({
      data: { id: "c1" },
      meta: { count: 1, page: 1, limit: 20, total: 1, hasMore: false },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories?type=expense");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("builds a query string and returns paginated envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [{ id: "t1" }, { id: "t2" }],
        meta: { count: 2, page: 2, limit: 20, total: 50, hasMore: true },
      }),
    );
    const result = await apiGetWithMeta("/api/transactions", { page: 2, limit: 20 });
    expect(result.data).toEqual([{ id: "t1" }, { id: "t2" }]);
    expect(result.meta).toEqual({ count: 2, page: 2, limit: 20, total: 50, hasMore: true });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions?page=2&limit=20");
  });

  it("serializes Date query params as ISO strings and skips null/undefined", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [],
        meta: { count: 0, total: 0, page: 1, limit: 20, hasMore: false },
      }),
    );
    await apiGetWithMeta("/api/transactions", {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: undefined,
      categoryId: null,
    });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions?from=2026-01-01T00%3A00%3A00.000Z");
  });

  it("omits the query string when no query is given", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: [],
        meta: { count: 0, total: 0, page: 1, limit: 20, hasMore: false },
      }),
    );
    await apiGetWithMeta("/api/transactions");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions");
  });
});

describe("apiPost", () => {
  it("sends a JSON body and unwraps data", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: { id: "c1" } }));
    const result = await apiPost("/api/categories", { name: "Food" });
    expect(result).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ name: "Food" });
  });
});

describe("apiPatch", () => {
  it("sends PATCH with a body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "c1", name: "X" } }));
    await apiPatch("/api/categories/c1", { name: "X" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ name: "X" });
  });
});

describe("apiDelete", () => {
  it("sends DELETE with no body and unwraps data", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "c1" } }));
    const result = await apiDelete("/api/categories/c1");
    expect(result).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});

describe("error handling", () => {
  it("throws the API message on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: {}, message: "Validation failed" }));
    await expect(apiGet("/api/categories")).rejects.toThrow("Validation failed");
  });

  it("falls back to a status message when no message is present", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    await expect(apiGet("/api/categories")).rejects.toThrow("Request failed with status 500");
  });

  it("apiGetWithMeta throws the API message on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: {}, message: "Validation failed" }));
    await expect(apiGetWithMeta("/api/transactions")).rejects.toThrow("Validation failed");
  });

  it("apiGetWithMeta falls back to a status message when no message is present", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    await expect(apiGetWithMeta("/api/transactions")).rejects.toThrow(
      "Request failed with status 500",
    );
  });
});
