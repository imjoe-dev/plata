import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  activateRecurringTemplateHandler,
  createRecurringTemplateHandler,
  deleteRecurringTemplateHandler,
  getRecurringTemplateHandler,
  listRecurringTemplatesHandler,
  pauseRecurringTemplateHandler,
  updateRecurringTemplateHandler,
} from "@/lib/ai/tools/client";
import { allClientTools } from "@/lib/ai/tools/client";

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

describe("listRecurringTemplatesHandler", () => {
  it("GETs /api/recurring-templates?status=active and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: "r1", amount: 1500 }], meta: { count: 1 } }));
    const result = await listRecurringTemplatesHandler({ status: "active" });
    expect(result).toEqual([{ id: "r1", amount: 15 }]);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recurring-templates?status=active");
  });
});

describe("createRecurringTemplateHandler", () => {
  it("POSTs dollars and converts the response cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 1250 } }, 201));
    const result = await createRecurringTemplateHandler({
      amount: 12.5,
      currency: "USD",
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
    });
    expect(result).toEqual({ id: "r1", amount: 12.5 });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.amount).toBe(12.5);
  });
});

describe("getRecurringTemplateHandler", () => {
  it("GETs /api/recurring-templates/$id and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 800 } }));
    expect(await getRecurringTemplateHandler({ id: "r1" })).toEqual({ id: "r1", amount: 8 });
  });
});

describe("updateRecurringTemplateHandler", () => {
  it("PATCHes the patch (without id) and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 2000 } }));
    expect(await updateRecurringTemplateHandler({ id: "r1", amount: 20 })).toEqual({
      id: "r1",
      amount: 20,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recurring-templates/r1");
    expect(JSON.parse(init.body as string)).toEqual({ amount: 20 });
  });
});

describe("deleteRecurringTemplateHandler", () => {
  it("DELETEs /api/recurring-templates/$id and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 100 } }));
    expect(await deleteRecurringTemplateHandler({ id: "r1" })).toEqual({ id: "r1", amount: 1 });
  });
});

describe("activateRecurringTemplateHandler", () => {
  it("POSTs to /api/recurring-templates/$id/activate with no body and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 500 } }));
    expect(await activateRecurringTemplateHandler({ id: "r1" })).toEqual({ id: "r1", amount: 5 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recurring-templates/r1/activate");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });
});

describe("pauseRecurringTemplateHandler", () => {
  it("POSTs to /api/recurring-templates/$id/pause with no body and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 500 } }));
    expect(await pauseRecurringTemplateHandler({ id: "r1" })).toEqual({ id: "r1", amount: 5 });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recurring-templates/r1/pause");
  });
});

describe("allClientTools", () => {
  it("contains 12 client tools (transactions execute server-side, no client tools registered)", () => {
    expect(allClientTools).toHaveLength(12);
  });
});
