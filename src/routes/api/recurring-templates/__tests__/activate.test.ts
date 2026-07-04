import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InternalError, NotFoundError } from "@/lib/errors";

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
import * as RouteMod from "@/routes/api/recurring-templates/$id/activate";

const Route = RouteMod.Route as any;

function authedUser(id = "u1") {
  vi.mocked(auth).mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue({ user: { id }, session: { id: "s1" } }) },
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/recurring-templates/$id/activate", () => {
  it("activates and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.activateTemplate).mockResolvedValueOnce({ id: "r1", status: "active" } as any);
    const res = await Route.server!.handlers.POST({
      request: new Request("http://localhost/api/recurring-templates/r1/activate", {
        method: "POST",
      }),
      params: { id: "r1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "r1", status: "active" } });
    expect(svc.activateTemplate).toHaveBeenCalledWith("u1", "r1");
  });

  it("returns 404 when the template is missing", async () => {
    authedUser();
    vi.mocked(svc.activateTemplate).mockRejectedValueOnce(
      new NotFoundError("recurring_template", "r1"),
    );
    const res = await Route.server!.handlers.POST({
      request: new Request("http://localhost/api/recurring-templates/r1/activate", {
        method: "POST",
      }),
      params: { id: "r1" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 500 when the template cannot be activated (wrong status)", async () => {
    authedUser();
    vi.mocked(svc.activateTemplate).mockRejectedValueOnce(new InternalError("cannot activate"));
    const res = await Route.server!.handlers.POST({
      request: new Request("http://localhost/api/recurring-templates/r1/activate", {
        method: "POST",
      }),
      params: { id: "r1" },
    });
    expect(res.status).toBe(500);
  });
});
