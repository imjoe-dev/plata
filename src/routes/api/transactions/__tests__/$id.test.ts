import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

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
import * as RouteMod from "@/routes/api/transactions/$id";

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

describe("GET /api/transactions/$id", () => {
  it("returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.getTransaction).mockResolvedValueOnce({ id: "t1" } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions/t1"),
      params: { id: "t1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "t1" } });
    expect(svc.getTransaction).toHaveBeenCalledWith("u1", "t1");
  });

  it("returns 404 when not found", async () => {
    authedUser();
    vi.mocked(svc.getTransaction).mockRejectedValueOnce(new NotFoundError("transaction", "t1"));
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions/t1"),
      params: { id: "t1" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions/t1"),
      params: { id: "t1" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/transactions/$id", () => {
  it("updates and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.updateTransaction).mockResolvedValueOnce({ id: "t1", description: "Y" } as any);
    const req = new Request("http://localhost/api/transactions/t1", {
      method: "PATCH",
      body: JSON.stringify({ description: "Y" }),
    });
    const res = await Route.server!.handlers.PATCH({ request: req, params: { id: "t1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "t1", description: "Y" } });
    expect(svc.updateTransaction).toHaveBeenCalledWith("u1", "t1", { description: "Y" });
  });

  it("returns 429 when the mutation rate limit is exceeded, without calling the service", async () => {
    authedUser();
    limitSpy.mockResolvedValueOnce({ success: false });
    const req = new Request("http://localhost/api/transactions/t1", {
      method: "PATCH",
      body: JSON.stringify({ description: "Y" }),
    });
    const res = await Route.server!.handlers.PATCH({ request: req, params: { id: "t1" } });
    expect(res.status).toBe(429);
    expect(svc.updateTransaction).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/transactions/$id", () => {
  it("deletes and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.deleteTransaction).mockResolvedValueOnce({
      id: "t1",
      deleted_at: new Date(0),
    } as any);
    const res = await Route.server!.handlers.DELETE({
      request: new Request("http://localhost/api/transactions/t1", { method: "DELETE" }),
      params: { id: "t1" },
    });
    expect(res.status).toBe(200);
    expect(svc.deleteTransaction).toHaveBeenCalledWith("u1", "t1");
  });

  it("returns 429 when the mutation rate limit is exceeded, without calling the service", async () => {
    authedUser();
    limitSpy.mockResolvedValueOnce({ success: false });
    const res = await Route.server!.handlers.DELETE({
      request: new Request("http://localhost/api/transactions/t1", { method: "DELETE" }),
      params: { id: "t1" },
    });
    expect(res.status).toBe(429);
    expect(svc.deleteTransaction).not.toHaveBeenCalled();
  });
});
