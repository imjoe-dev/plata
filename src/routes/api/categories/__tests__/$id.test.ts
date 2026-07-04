import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/categories", () => ({
  createCategory: vi.fn(),
  listCategories: vi.fn(),
  getCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/categories";
import * as RouteMod from "@/routes/api/categories/$id";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/categories/$id", () => {
  it("returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.getCategory).mockResolvedValueOnce({ id: "c1", name: "A" } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories/c1"),
      params: { id: "c1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "c1", name: "A" } });
    expect(svc.getCategory).toHaveBeenCalledWith("u1", "c1");
  });

  it("returns 404 when not found", async () => {
    authedUser();
    vi.mocked(svc.getCategory).mockRejectedValueOnce(new NotFoundError("category", "c1"));
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories/c1"),
      params: { id: "c1" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories/c1"),
      params: { id: "c1" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/categories/$id", () => {
  it("updates and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.updateCategory).mockResolvedValueOnce({ id: "c1", name: "B" } as any);
    const req = new Request("http://localhost/api/categories/c1", {
      method: "PATCH",
      body: JSON.stringify({ name: "B" }),
    });
    const res = await Route.server!.handlers.PATCH({ request: req, params: { id: "c1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "c1", name: "B" } });
    expect(svc.updateCategory).toHaveBeenCalledWith("u1", "c1", { name: "B" });
  });
});

describe("DELETE /api/categories/$id", () => {
  it("deletes and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.deleteCategory).mockResolvedValueOnce({
      id: "c1",
      deleted_at: new Date(0),
    } as any);
    const res = await Route.server!.handlers.DELETE({
      request: new Request("http://localhost/api/categories/c1", { method: "DELETE" }),
      params: { id: "c1" },
    });
    expect(res.status).toBe(200);
    expect(svc.deleteCategory).toHaveBeenCalledWith("u1", "c1");
  });
});
