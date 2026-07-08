import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("cloudflare:workers", () => ({ env: { OPENAI_API_KEY: "test-key" } }));
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

import { chat } from "@tanstack/ai";
import * as RouteMod from "@/routes/api/chat";

const Route = RouteMod.Route as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/chat", () => {
  it("passes tools and the system prompt to chat()", async () => {
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
});
