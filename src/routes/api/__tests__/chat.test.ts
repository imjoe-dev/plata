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
  toolDefinition: vi.fn((def: any) => def),
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

import { chat } from "@tanstack/ai";
import { env } from "cloudflare:workers";
import { checkRateLimit, requireUser, toErrorResponse } from "@/lib/api/http";
import { RateLimitedError, UnauthorizedError } from "@/lib/errors";
import * as RouteMod from "@/routes/api/chat";

const Route = RouteMod.Route as any;

beforeEach(() => {
  vi.clearAllMocks();
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

    const res = await Route.server.handlers.POST({
      request: new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [], forwardedProps: { model_id: "gpt-5.4-mini" } }),
      }),
    });

    expect(res.status).toBe(401);
    expect(chat).not.toHaveBeenCalled();
    expect(requireUser).toHaveBeenCalledTimes(1);
  });

  it("passes tools and the system prompt to chat() when authenticated", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce("user-123");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(undefined);

    const res = await Route.server.handlers.POST({
      request: new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [], forwardedProps: { model_id: "gpt-5.4-mini" } }),
      }),
    });

    expect(res.status).toBe(200);
    expect(chat).toHaveBeenCalledTimes(1);
    const call = vi.mocked(chat).mock.calls[0][0] as any;
    expect(Array.isArray(call.tools)).toBe(true);
    expect(call.tools).toHaveLength(17);
    expect(call.systemPrompts).toEqual([expect.any(String)]);
    expect((call.systemPrompts as string[])[0]).toContain("Identity & Mandate");
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

    const res = await Route.server.handlers.POST({
      request: new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [], forwardedProps: { model_id: "gpt-5.4-mini" } }),
      }),
    });

    expect(res.status).toBe(429);
    expect(chat).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith(env.CHAT_RATE_LIMITER, "user-123");
  });

  it("keys the rate limit check per authenticated user, so one user's usage doesn't affect another's", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce("user-a").mockResolvedValueOnce("user-b");
    vi.mocked(checkRateLimit).mockResolvedValue(undefined);

    const makeRequest = () =>
      Route.server.handlers.POST({
        request: new Request("http://localhost/api/chat", {
          method: "POST",
          body: JSON.stringify({ messages: [], forwardedProps: { model_id: "gpt-5.4-mini" } }),
        }),
      });

    const resA = await makeRequest();
    const resB = await makeRequest();

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(checkRateLimit).toHaveBeenNthCalledWith(1, env.CHAT_RATE_LIMITER, "user-a");
    expect(checkRateLimit).toHaveBeenNthCalledWith(2, env.CHAT_RATE_LIMITER, "user-b");
    expect(chat).toHaveBeenCalledTimes(2);
  });
});
