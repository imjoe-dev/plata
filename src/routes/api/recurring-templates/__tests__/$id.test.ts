import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/recurring-templates", () => ({
  createRecurringTemplate: vi.fn(),
  listRecurringTemplates: vi.fn(),
  getRecurringTemplate: vi.fn(),
  updateRecurringTemplate: vi.fn(),
  deleteRecurringTemplate: vi.fn(),
  pauseTemplate: vi.fn(),
  activateTemplate: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/recurring-templates";
import * as RouteMod from "@/routes/api/recurring-templates/$id/index";

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

describe("GET /api/recurring-templates/$id", () => {
  it("returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.getRecurringTemplate).mockResolvedValueOnce({ id: "r1" } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates/r1"),
      params: { id: "r1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "r1" } });
    expect(svc.getRecurringTemplate).toHaveBeenCalledWith("u1", "r1");
  });

  it("returns 404 when not found", async () => {
    authedUser();
    vi.mocked(svc.getRecurringTemplate).mockRejectedValueOnce(
      new NotFoundError("recurring_template", "r1"),
    );
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates/r1"),
      params: { id: "r1" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates/r1"),
      params: { id: "r1" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/recurring-templates/$id", () => {
  it("updates and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.updateRecurringTemplate).mockResolvedValueOnce({
      id: "r1",
      status: "paused",
    } as any);
    const req = new Request("http://localhost/api/recurring-templates/r1", {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    });
    const res = await Route.server!.handlers.PATCH({ request: req, params: { id: "r1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "r1", status: "paused" } });
    expect(svc.updateRecurringTemplate).toHaveBeenCalledWith("u1", "r1", { status: "paused" });
  });
});

describe("DELETE /api/recurring-templates/$id", () => {
  it("deletes and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.deleteRecurringTemplate).mockResolvedValueOnce({
      id: "r1",
      deleted_at: new Date(0),
    } as any);
    const res = await Route.server!.handlers.DELETE({
      request: new Request("http://localhost/api/recurring-templates/r1", { method: "DELETE" }),
      params: { id: "r1" },
    });
    expect(res.status).toBe(200);
    expect(svc.deleteRecurringTemplate).toHaveBeenCalledWith("u1", "r1");
  });
});
