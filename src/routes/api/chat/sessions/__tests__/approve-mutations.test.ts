import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/chat", () => ({
  approveSessionMutations: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/chat";
import * as RouteMod from "@/routes/api/chat/sessions/$sessionId/approve-mutations";

type MockRoute = {
  server: {
    handlers: {
      POST: (ctx: { request: Request; params: { sessionId: string } }) => Promise<Response>;
    };
  };
};
const Route = RouteMod.Route as unknown as MockRoute;
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

type MockAuth = {
  api: {
    getSession: (args: {
      headers: Headers;
    }) => Promise<{ user: { id: string }; session: { id: string } } | null>;
  };
};

function authedUser(id = "u1") {
  vi.mocked(auth).mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue({ user: { id }, session: { id: "s1" } }) },
  } as unknown as MockAuth as ReturnType<typeof auth>);
}
function noSession() {
  vi.mocked(auth).mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue(null) },
  } as unknown as MockAuth as ReturnType<typeof auth>);
}

function makeRequest() {
  return new Request(`http://localhost/api/chat/sessions/${SESSION_ID}/approve-mutations`, {
    method: "POST",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/chat/sessions/$sessionId/approve-mutations", () => {
  it("returns 200 with the enveloped, now-approved session on success", async () => {
    authedUser();
    const approved = {
      id: SESSION_ID,
      title: "Hello",
      user_id: "u1",
      mutating_tools_approved: true,
    };
    vi.mocked(svc.approveSessionMutations).mockResolvedValueOnce(approved as any);

    const res = await Route.server.handlers.POST({
      request: makeRequest(),
      params: { sessionId: SESSION_ID },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: approved });
    expect(svc.approveSessionMutations).toHaveBeenCalledWith("u1", SESSION_ID);
  });

  it("returns 404 for a session that doesn't belong to the caller", async () => {
    authedUser();
    vi.mocked(svc.approveSessionMutations).mockRejectedValueOnce(
      new NotFoundError("chat_session", SESSION_ID),
    );

    const res = await Route.server.handlers.POST({
      request: makeRequest(),
      params: { sessionId: SESSION_ID },
    });

    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated, and never calls the service", async () => {
    noSession();

    const res = await Route.server.handlers.POST({
      request: makeRequest(),
      params: { sessionId: SESSION_ID },
    });

    expect(res.status).toBe(401);
    expect(svc.approveSessionMutations).not.toHaveBeenCalled();
  });
});
