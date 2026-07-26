import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("cloudflare:workers", () => ({
  env: { OPENAI_API_KEY: "test-key", CHAT_RATE_LIMITER: { limit: vi.fn() } },
}));
vi.mock("@tanstack/ai", () => ({
  chat: vi.fn().mockReturnValue({ async *[Symbol.asyncIterator]() {} }),
  chatParamsFromRequestBody: vi.fn(async (body: any) => ({
    messages: body.messages ?? [],
    forwardedProps: body.forwardedProps ?? {},
  })),
  toServerSentEventsResponse: vi.fn(
    () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  ),
  toolDefinition: vi.fn((def: any) => ({
    ...def,
    server: (execute: any) => ({ ...def, execute }),
    client: (execute?: any) => ({ ...def, execute }),
  })),
  convertMessagesToModelMessages: vi.fn((messages: any) => messages),
  modelMessageToUIMessage: vi.fn((message: any) => ({
    id: "um_1",
    role: "user",
    parts: [{ type: "text", content: message?.content ?? "" }],
  })),
  modelMessagesToUIMessages: vi.fn(() => [
    { id: "am_1", role: "assistant", parts: [{ type: "text", content: "reply" }] },
  ]),
}));
vi.mock("@tanstack/ai-openai", () => ({
  createOpenaiChat: vi.fn(() => ({})),
  openaiText: vi.fn(() => ({})),
}));
vi.mock("@/lib/api/http", async () => {
  const actual = await vi.importActual("@/lib/api/http");
  return {
    ...actual,
    requireUser: vi.fn(),
    toErrorResponse: vi.fn(),
    checkRateLimit: vi.fn(),
  };
});
vi.mock("@/lib/services/chat", () => ({
  getOrCreateSession: vi.fn(),
  appendMessage: vi.fn(),
}));

import { chat, modelMessagesToUIMessages, type ChatMiddleware } from "@tanstack/ai";
import { env } from "cloudflare:workers";
import { checkRateLimit, requireUser, toErrorResponse } from "@/lib/api/http";
import { getOrCreateSession, appendMessage } from "@/lib/services/chat";
import { NotFoundError, RateLimitedError, UnauthorizedError } from "@/lib/errors";
import { allToolDefinitions, approvedToolDefinitions } from "@/lib/ai/tools/index";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import * as RouteMod from "@/routes/api/chat";

type MockRoute = {
  server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } };
};
const Route = RouteMod.Route as unknown as MockRoute;
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
      forwardedProps: { model_id: "gpt-5.4-mini", session_id: SESSION_ID },
      ...body,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrCreateSession).mockResolvedValue({
    id: SESSION_ID,
    mutating_tools_approved: false,
  } as any);
  vi.mocked(appendMessage).mockResolvedValue({} as any);
});

describe("POST /api/chat", () => {
  it("returns 401 without a valid session and never calls chat()", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new UnauthorizedError());
    vi.mocked(toErrorResponse).mockReturnValueOnce(
      new Response(
        JSON.stringify({
          error: { name: "UnauthorizedError", status: 401 },
          message: "Unauthorized",
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const res = await Route.server.handlers.POST({ request: makeRequest() });

    expect(res.status).toBe(401);
    expect(chat).not.toHaveBeenCalled();
    expect(requireUser).toHaveBeenCalledTimes(1);
  });

  it("passes tools and the system prompt to chat() when authenticated", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce("user-123");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(undefined);

    const res = await Route.server.handlers.POST({ request: makeRequest() });

    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalledTimes(1);
    const call = vi.mocked(chat).mock.calls[0][0] as any;
    expect(call.tools).toEqual(allToolDefinitions);
    expect(call.systemPrompts).toEqual([SYSTEM_PROMPT]);
  });

  it("passes the Session Approval tool array when the Chat Session has granted it", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce("user-123");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(undefined);
    vi.mocked(getOrCreateSession).mockResolvedValueOnce({
      id: SESSION_ID,
      mutating_tools_approved: true,
    } as any);

    await Route.server.handlers.POST({ request: makeRequest() });

    const lastCall = vi.mocked(chat).mock.lastCall;
    expect(lastCall).toBeDefined();
    const call = lastCall![0] as any;
    expect(call.tools).toEqual(approvedToolDefinitions);
    expect(call.tools).not.toEqual(allToolDefinitions);
  });

  it("passes the authenticated user's id as per-request tool context", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce("user-123");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(undefined);

    await Route.server.handlers.POST({ request: makeRequest() });

    const call = vi.mocked(chat).mock.calls[0][0] as any;
    expect(call.context).toEqual({ userId: "user-123" });
  });

  it("returns 429 and never calls chat() when the user's rate limit is exceeded", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce("user-123");
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new RateLimitedError());
    vi.mocked(toErrorResponse).mockReturnValueOnce(
      new Response(
        JSON.stringify({
          error: { name: "RateLimitedError", status: 429 },
          message: "Rate limit exceeded",
        }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const res = await Route.server.handlers.POST({ request: makeRequest() });

    expect(res.status).toBe(429);
    expect(chat).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith(env.CHAT_RATE_LIMITER, "user-123");
  });

  it("keys the rate limit check per authenticated user, so one user's usage doesn't affect another's", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce("user-a").mockResolvedValueOnce("user-b");
    vi.mocked(checkRateLimit).mockResolvedValue(undefined);

    const resA = await Route.server.handlers.POST({ request: makeRequest() });
    const resB = await Route.server.handlers.POST({ request: makeRequest() });

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(checkRateLimit).toHaveBeenNthCalledWith(1, env.CHAT_RATE_LIMITER, "user-a");
    expect(checkRateLimit).toHaveBeenNthCalledWith(2, env.CHAT_RATE_LIMITER, "user-b");
    expect(chat).toHaveBeenCalledTimes(2);
  });

  describe("persistence", () => {
    beforeEach(() => {
      vi.mocked(requireUser).mockResolvedValue("user-123");
      vi.mocked(checkRateLimit).mockResolvedValue(undefined);
    });

    it("creates or reuses the session for the given session_id, scoped to the caller", async () => {
      await Route.server.handlers.POST({ request: makeRequest() });

      expect(getOrCreateSession).toHaveBeenCalledWith(
        "user-123",
        SESSION_ID,
        expect.arrayContaining([expect.objectContaining({ type: "text", content: "hi" })]),
      );
    });

    it("persists the user's message before streaming the reply", async () => {
      await Route.server.handlers.POST({ request: makeRequest() });

      expect(appendMessage).toHaveBeenCalledWith(
        "user-123",
        SESSION_ID,
        "user",
        expect.arrayContaining([expect.objectContaining({ type: "text", content: "hi" })]),
      );
      const userCallOrder = vi.mocked(appendMessage).mock.invocationCallOrder[0];
      const chatCallOrder = vi.mocked(chat).mock.invocationCallOrder[0];
      expect(userCallOrder).toBeLessThan(chatCallOrder);
    });

    it("returns 404 (not a distinct 403) when the session_id belongs to a different user", async () => {
      const notFound = new NotFoundError("chat_session", SESSION_ID);
      vi.mocked(getOrCreateSession).mockRejectedValueOnce(notFound);
      vi.mocked(toErrorResponse).mockReturnValueOnce(
        new Response(JSON.stringify({ error: { name: "NotFoundError", status: 404 } }), {
          status: 404,
        }),
      );

      const res = await Route.server.handlers.POST({ request: makeRequest() });

      expect(res.status).toBe(404);
      expect(toErrorResponse).toHaveBeenCalledWith(notFound);
      expect(chat).not.toHaveBeenCalled();
      expect(appendMessage).not.toHaveBeenCalled();
    });

    it("persists the assistant's message only once the stream fully completes (onFinish)", async () => {
      await Route.server.handlers.POST({ request: makeRequest() });

      const call = vi.mocked(chat).mock.calls[0][0] as any;
      const middleware = call.middleware[0] as ChatMiddleware;
      expect(vi.mocked(appendMessage).mock.calls).toHaveLength(1); // user message only, so far

      await middleware.onFinish!(
        { messages: [{ role: "user", content: "hi" }], messageCount: 0 } as any,
        {} as any,
      );

      expect(modelMessagesToUIMessages).toHaveBeenCalled();
      expect(appendMessage).toHaveBeenCalledWith("user-123", SESSION_ID, "assistant", [
        { type: "text", content: "reply" },
      ]);
    });
  });
});
