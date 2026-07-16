import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/chat", () => ({
  listMessages: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/chat";
import * as RouteMod from "@/routes/api/chat/sessions/$sessionId/messages";

type MockRoute = {
  server: {
    handlers: {
      GET: (ctx: { request: Request; params: { sessionId: string } }) => Promise<Response>;
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/chat/sessions/$sessionId/messages", () => {
  it("returns 200 with the enveloped result of listMessages", async () => {
    authedUser();
    const messages = [
      { id: "msg_1", role: "user", parts: [{ type: "text", content: "Hi" }] },
      { id: "msg_2", role: "assistant", parts: [{ type: "text", content: "Hello!" }] },
    ];
    vi.mocked(svc.listMessages).mockResolvedValueOnce(messages as any);

    const res = await Route.server.handlers.GET({
      request: new Request(`http://localhost/api/chat/sessions/${SESSION_ID}/messages`),
      params: { sessionId: SESSION_ID },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: messages, meta: { count: 2 } });
    expect(svc.listMessages).toHaveBeenCalledWith("u1", SESSION_ID);
  });

  it("returns 404 for a nonexistent session", async () => {
    authedUser();
    vi.mocked(svc.listMessages).mockRejectedValueOnce(
      new NotFoundError("chat_session", SESSION_ID),
    );

    const res = await Route.server.handlers.GET({
      request: new Request(`http://localhost/api/chat/sessions/${SESSION_ID}/messages`),
      params: { sessionId: SESSION_ID },
    });

    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();

    const res = await Route.server.handlers.GET({
      request: new Request(`http://localhost/api/chat/sessions/${SESSION_ID}/messages`),
      params: { sessionId: SESSION_ID },
    });

    expect(res.status).toBe(401);
    expect(svc.listMessages).not.toHaveBeenCalled();
  });
});
