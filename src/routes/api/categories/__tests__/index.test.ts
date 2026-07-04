import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/categories", () => ({
  createCategory: vi.fn(),
  listCategories: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/categories";
import * as RouteMod from "@/routes/api/categories/index";

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

describe("GET /api/categories", () => {
  it("returns an enveloped list", async () => {
    authedUser();
    vi.mocked(svc.listCategories).mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }] as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories"),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "c1" }, { id: "c2" }], meta: { count: 2 } });
    expect(svc.listCategories).toHaveBeenCalledWith("u1");
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories"),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/categories", () => {
  it("creates and returns 201 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.createCategory).mockResolvedValueOnce({
      id: "c1",
      name: "A",
      type: "expense",
    } as any);
    const req = new Request("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "A", type: "expense" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: "c1", name: "A", type: "expense" } });
    expect(svc.createCategory).toHaveBeenCalledWith("u1", { name: "A", type: "expense" });
  });

  it("returns 400 on an invalid body", async () => {
    authedUser();
    const req = new Request("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "", type: "nope" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(400);
  });

  it("returns 409 when the service throws ConflictError", async () => {
    authedUser();
    const { ConflictError } = await import("@/lib/errors");
    vi.mocked(svc.createCategory).mockRejectedValueOnce(new ConflictError("uq", "name"));
    const req = new Request("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "A", type: "expense" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(409);
  });
});
