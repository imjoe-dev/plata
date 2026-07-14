import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/transactions", () => ({
  createTransaction: vi.fn(),
  listTransactions: vi.fn(),
  getTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import { env } from "cloudflare:workers";
import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/transactions";
import * as RouteMod from "@/routes/api/transactions/index";

const Route = RouteMod.Route as any;

function authedUser(id = "u1") {
  vi.mocked(auth).mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue({ user: { id }, session: { id: "s1" } }) },
  } as any);
}
function noSession() {
  vi.mocked(auth).mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue(null) },
  } as any);
}

const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);

beforeEach(() => {
  vi.clearAllMocks();
  limitSpy.mockResolvedValue({ success: true });
});

describe("GET /api/transactions", () => {
  it("defaults page=1/limit=20, passes filters and pagination to the service, and envelopes the list", async () => {
    authedUser();
    vi.mocked(svc.listTransactions).mockResolvedValueOnce({
      rows: [{ id: "t1" }],
      total: 1,
    } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions?type=income&categoryId=c1"),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: [{ id: "t1" }],
      meta: { count: 1, page: 1, limit: 20, total: 1, hasMore: false },
    });
    expect(svc.listTransactions).toHaveBeenCalledWith(
      "u1",
      { type: "income", categoryId: "c1" },
      { page: 1, limit: 20 },
    );
  });

  it("resolves explicit page/limit and reports hasMore=true for a partial window", async () => {
    authedUser();
    vi.mocked(svc.listTransactions).mockResolvedValueOnce({
      rows: Array.from({ length: 10 }, (_, i) => ({ id: `t${i + 11}` })),
      total: 25,
    } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions?page=2&limit=10"),
    });
    const body = await res.json();
    expect(body.data).toHaveLength(10);
    expect(body.meta).toEqual({ count: 10, page: 2, limit: 10, total: 25, hasMore: true });
    expect(svc.listTransactions).toHaveBeenCalledWith("u1", {}, { page: 2, limit: 10 });
  });

  it("returns an empty data array with hasMore=false for an out-of-bounds page", async () => {
    authedUser();
    vi.mocked(svc.listTransactions).mockResolvedValueOnce({ rows: [], total: 25 } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions?page=100&limit=10"),
    });
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.meta).toEqual({ count: 0, page: 100, limit: 10, total: 25, hasMore: false });
  });

  it("passes filters combined with pagination through, reflecting the filtered total", async () => {
    authedUser();
    vi.mocked(svc.listTransactions).mockResolvedValueOnce({
      rows: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}` })),
      total: 12,
    } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request(
        "http://localhost/api/transactions?type=expense&categoryId=c1&page=2&limit=5",
      ),
    });
    const body = await res.json();
    expect(body.meta).toEqual({ count: 5, page: 2, limit: 5, total: 12, hasMore: true });
    expect(svc.listTransactions).toHaveBeenCalledWith(
      "u1",
      { type: "expense", categoryId: "c1" },
      { page: 2, limit: 5 },
    );
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions"),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid query filter", async () => {
    authedUser();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions?type=nope"),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when limit is out of the 1-100 range", async () => {
    authedUser();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions?limit=500"),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/transactions", () => {
  it("creates and returns 201 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.createTransaction).mockResolvedValueOnce({ id: "t1" } as any);
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amount: 12.34,
        type: "expense",
        description: "Lunch",
        date: "2026-07-01T00:00:00.000Z",
        source: "manual",
      }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("t1");
    const [, input] = vi.mocked(svc.createTransaction).mock.calls[0];
    expect(input.amount).toBe(1234);
    expect(input.date).toBeInstanceOf(Date);
  });

  it("returns 400 on an invalid body", async () => {
    authedUser();
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ type: "expense" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(400);
  });

  it("returns 404 when a referenced categoryId is missing", async () => {
    authedUser();
    const { NotFoundError } = await import("@/lib/errors");
    vi.mocked(svc.createTransaction).mockRejectedValueOnce(new NotFoundError("category", "c1"));
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amount: 10,
        type: "expense",
        description: "x",
        date: "2026-07-01T00:00:00.000Z",
        source: "manual",
        categoryId: "c1",
      }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(404);
  });

  it("returns 429 when the mutation rate limit is exceeded, without calling the service", async () => {
    authedUser();
    limitSpy.mockResolvedValueOnce({ success: false });
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amount: 12.34,
        type: "expense",
        description: "Lunch",
        date: "2026-07-01T00:00:00.000Z",
        source: "manual",
      }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(429);
    expect(svc.createTransaction).not.toHaveBeenCalled();
  });
});
