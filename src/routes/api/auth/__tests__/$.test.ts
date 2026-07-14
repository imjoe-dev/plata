import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, ...opts }),
}));
vi.mock("cloudflare:workers", () => ({
  env: { AUTH_RATE_LIMITER: { limit: vi.fn() } },
}));
const mockHandler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(() => ({ handler: mockHandler })),
}));
vi.mock("@/lib/api/http", async () => {
  const actual = await vi.importActual("@/lib/api/http");
  return {
    ...actual,
    checkRateLimit: vi.fn(),
    toErrorResponse: vi.fn(),
  };
});

import { checkRateLimit, toErrorResponse } from "@/lib/api/http";
import { RateLimitedError } from "@/lib/errors";
import * as RouteMod from "@/routes/api/auth/$";

const Route = RouteMod.Route as any;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(method: string, ip: string | null) {
  const headers: Record<string, string> = {};
  if (ip !== null) {
    headers["CF-Connecting-IP"] = ip;
  }
  return new Request("http://localhost/api/auth/sign-in", { method, headers });
}

describe("/api/auth/$ rate limiting", () => {
  it("returns 429 and never calls mockHandler when the IP's rate limit is exceeded (GET)", async () => {
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new RateLimitedError());
    vi.mocked(toErrorResponse).mockReturnValueOnce(
      new Response(
        JSON.stringify({
          error: { name: "RateLimitedError", status: 429 },
          message: "Rate limit exceeded",
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
    );

    const request = makeRequest("GET", "1.2.3.4");
    const res = await Route.server.handlers.GET({ request });

    expect(res.status).toBe(429);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), "1.2.3.4");
  });

  it("returns 429 and never calls mockHandler when the IP's rate limit is exceeded (POST)", async () => {
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new RateLimitedError());
    vi.mocked(toErrorResponse).mockReturnValueOnce(
      new Response(
        JSON.stringify({
          error: { name: "RateLimitedError", status: 429 },
          message: "Rate limit exceeded",
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
    );

    const request = makeRequest("POST", "1.2.3.4");
    const res = await Route.server.handlers.POST({ request });

    expect(res.status).toBe(429);
    expect(mockHandler).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), "1.2.3.4");
  });

  it("delegates to mockHandler when the IP is under its limit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(undefined);

    const request = makeRequest("GET", "1.2.3.4");
    const res = await Route.server.handlers.GET({ request });

    expect(res.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(request);
    expect(toErrorResponse).not.toHaveBeenCalled();
  });

  it("keys the rate limit check per source IP", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(undefined);

    const resA = await Route.server.handlers.GET({ request: makeRequest("GET", "1.1.1.1") });
    const resB = await Route.server.handlers.GET({ request: makeRequest("GET", "2.2.2.2") });

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(checkRateLimit).toHaveBeenNthCalledWith(1, expect.anything(), "1.1.1.1");
    expect(checkRateLimit).toHaveBeenNthCalledWith(2, expect.anything(), "2.2.2.2");
    expect(mockHandler).toHaveBeenCalledTimes(2);
  });

  it("when one IP exceeds its limit, a different IP's requests are unaffected", async () => {
    vi.mocked(checkRateLimit)
      .mockRejectedValueOnce(new RateLimitedError())
      .mockResolvedValueOnce(undefined);
    vi.mocked(toErrorResponse).mockReturnValueOnce(
      new Response(
        JSON.stringify({
          error: { name: "RateLimitedError", status: 429 },
          message: "Rate limit exceeded",
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
    );

    const requestA = makeRequest("GET", "1.1.1.1");
    const requestB = makeRequest("GET", "2.2.2.2");
    const resA = await Route.server.handlers.GET({ request: requestA });
    const resB = await Route.server.handlers.GET({ request: requestB });

    expect(resA.status).toBe(429);
    expect(resB.status).toBe(200);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(requestB);
  });

  it("falls back to a shared key when CF-Connecting-IP is missing (local/test environments)", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(undefined);

    const request = makeRequest("GET", null);
    const res = await Route.server.handlers.GET({ request });

    expect(res.status).toBe(200);
    expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), "unknown");
  });
});
