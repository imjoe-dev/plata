import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createCategoryHandler,
  deleteCategoryHandler,
  getCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
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

describe("listCategoriesHandler", () => {
  it("GETs /api/categories and returns the data array", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: "c1" }], meta: { count: 1 } }));
    const result = await listCategoriesHandler();
    expect(result).toEqual([{ id: "c1" }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories");
    expect(init.method).toBe("GET");
  });
});

describe("createCategoryHandler", () => {
  it("POSTs the body to /api/categories", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "c1" } }, 201));
    const result = await createCategoryHandler({ name: "Food", type: "expense" });
    expect(result).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Food", type: "expense" });
  });
});

describe("getCategoryHandler", () => {
  it("GETs /api/categories/$id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "c1" } }));
    await getCategoryHandler({ id: "c1" });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
  });
});

describe("updateCategoryHandler", () => {
  it("PATCHes the patch (without id) to /api/categories/$id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "c1", name: "X" } }));
    await updateCategoryHandler({ id: "c1", name: "X" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ name: "X" });
  });
});

describe("deleteCategoryHandler", () => {
  it("DELETEs /api/categories/$id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "c1" } }));
    await deleteCategoryHandler({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
    expect(init.method).toBe("DELETE");
  });
});
