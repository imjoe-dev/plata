import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

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
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import { env } from "cloudflare:workers";
import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/recurring-templates";
import * as RouteMod from "@/routes/api/recurring-templates/index";

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

describe("GET /api/recurring-templates", () => {
  it("passes the status filter and envelopes the list", async () => {
    authedUser();
    vi.mocked(svc.listRecurringTemplates).mockResolvedValueOnce([{ id: "r1" }] as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates?status=active"),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "r1" }], meta: { count: 1 } });
    expect(svc.listRecurringTemplates).toHaveBeenCalledWith("u1", { status: "active" });
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates"),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid status", async () => {
    authedUser();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates?status=nope"),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/recurring-templates", () => {
  it("creates and returns 201 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.createRecurringTemplate).mockResolvedValueOnce({ id: "r1" } as any);
    const req = new Request("http://localhost/api/recurring-templates", {
      method: "POST",
      body: JSON.stringify({
        amount: 1500,
        type: "expense",
        description: "Rent",
        cadence: "monthly",
        status: "active",
        nextDueDate: "2026-08-01T00:00:00.000Z",
      }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("r1");
    const [, input] = vi.mocked(svc.createRecurringTemplate).mock.calls[0];
    expect(input.nextDueDate).toBeInstanceOf(Date);
  });

  it("returns 400 on an invalid body", async () => {
    authedUser();
    const req = new Request("http://localhost/api/recurring-templates", {
      method: "POST",
      body: JSON.stringify({ cadence: "fortnightly" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(400);
  });

  it("returns 429 when the mutation rate limit is exceeded, without calling the service", async () => {
    authedUser();
    limitSpy.mockResolvedValueOnce({ success: false });
    const req = new Request("http://localhost/api/recurring-templates", {
      method: "POST",
      body: JSON.stringify({
        amount: 1500,
        type: "expense",
        description: "Rent",
        cadence: "monthly",
        status: "active",
        nextDueDate: "2026-08-01T00:00:00.000Z",
      }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(429);
    expect(svc.createRecurringTemplate).not.toHaveBeenCalled();
  });
});
