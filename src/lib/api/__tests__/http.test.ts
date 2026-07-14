import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";

import {
  ConflictError,
  InternalError,
  NotFoundError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn() } },
}));

import { auth } from "@/lib/auth/server";
import { env } from "cloudflare:workers";
import {
  apiHandler,
  checkRateLimit,
  parseBody,
  parseQuery,
  requireUser,
  toErrorResponse,
} from "@/lib/api/http";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toErrorResponse", () => {
  it("maps ValidationError to 400 with fieldErrors", async () => {
    const res = toErrorResponse(new ValidationError({ name: ["required"] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { name: "ValidationError", status: 400, fieldErrors: { name: ["required"] } },
      message: "Validation failed",
    });
  });

  it("maps UnauthorizedError to 401", async () => {
    const res = toErrorResponse(new UnauthorizedError());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { name: "UnauthorizedError", status: 401 },
      message: "Unauthorized",
    });
  });

  it("maps NotFoundError to 404 with resource/id", async () => {
    const res = toErrorResponse(new NotFoundError("category", "c1"));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: { name: "NotFoundError", status: 404, resource: "category", id: "c1" },
    });
  });

  it("maps ConflictError to 409 with constraint/field", async () => {
    const res = toErrorResponse(new ConflictError("uq", "name"));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: { name: "ConflictError", status: 409, constraint: "uq", field: "name" },
    });
  });

  it("maps InternalError to 500", async () => {
    const res = toErrorResponse(new InternalError("boom"));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { name: "InternalError", status: 500 } });
  });

  it("maps RateLimitedError to 429", async () => {
    const res = toErrorResponse(new RateLimitedError());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: { name: "RateLimitedError", status: 429 },
      message: "Rate limit exceeded",
    });
  });

  it("maps a ZodError to 400 with fieldErrors", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const result = schema.safeParse({ name: "" });
    if (!result.success) {
      const res = toErrorResponse(result.error);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error.name).toBe("ValidationError");
      expect(body.error.fieldErrors).toBeDefined();
    }
  });

  it("maps an unknown error to 500 without leaking internals", async () => {
    const res = toErrorResponse(new Error("DB password is hunter2"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Internal server error");
    expect(body.error).toEqual({ name: "InternalError", status: 500 });
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });
});

describe("apiHandler", () => {
  it("envelopes a single row with the given status", async () => {
    const handler = apiHandler(async () => ({ id: "c1", name: "A" }), { status: 201 });
    const res = await handler({ request: new Request("http://localhost/") });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: "c1", name: "A" } });
  });

  it("envelopes an array with data and meta.count", async () => {
    const handler = apiHandler(async () => [{ id: "c1" }, { id: "c2" }]);
    const res = await handler({ request: new Request("http://localhost/") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "c1" }, { id: "c2" }], meta: { count: 2 } });
  });

  it("routes a thrown AppError through toErrorResponse", async () => {
    const handler = apiHandler(async () => {
      throw new NotFoundError("category", "c1");
    });
    const res = await handler({ request: new Request("http://localhost/") });
    expect(res.status).toBe(404);
  });

  it("passes through a paginated envelope with data and meta fields unchanged", async () => {
    const handler = apiHandler(async () => ({
      data: [{ id: "t1" }, { id: "t2" }],
      meta: { count: 2, page: 1, limit: 20, total: 50, hasMore: true },
    }));
    const res = await handler({ request: new Request("http://localhost/") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: [{ id: "t1" }, { id: "t2" }],
      meta: { count: 2, page: 1, limit: 20, total: 50, hasMore: true },
    });
  });

  it("does not match a plain object that happens to have a data key but no meta", async () => {
    const handler = apiHandler(async () => ({ data: "some_value", name: "test" }));
    const res = await handler({ request: new Request("http://localhost/") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { data: "some_value", name: "test" },
    });
  });

  it("does not match a plain object that happens to have a meta key but no data", async () => {
    const handler = apiHandler(async () => ({ meta: { count: 1 }, name: "test" }));
    const res = await handler({ request: new Request("http://localhost/") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { meta: { count: 1 }, name: "test" },
    });
  });

  it("preserves error handling within paginated envelope case", async () => {
    const handler = apiHandler(async () => {
      throw new ValidationError({ field: ["error"] });
    });
    const res = await handler({ request: new Request("http://localhost/") });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.name).toBe("ValidationError");
  });

  describe("rateLimit option", () => {
    it("never applies a rate limit when opts is omitted, even past what would be the mutation limit", async () => {
      const handler = apiHandler(async () => ({ id: "c1" }));
      const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);
      limitSpy.mockResolvedValue({ success: false });

      for (let i = 0; i < 40; i++) {
        const res = await handler({ request: new Request("http://localhost/") });
        expect(res.status).toBe(200);
      }
      expect(limitSpy).not.toHaveBeenCalled();
    });

    it("never applies a rate limit when opts.rateLimit is false", async () => {
      const handler = apiHandler(async () => ({ id: "c1" }), { rateLimit: false });
      const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);
      limitSpy.mockResolvedValue({ success: false });

      const res = await handler({ request: new Request("http://localhost/") });
      expect(res.status).toBe(200);
      expect(limitSpy).not.toHaveBeenCalled();
    });

    it("returns 429 and never invokes the wrapped handler when the mutation limiter reports exceeded", async () => {
      vi.mocked(auth).mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } }),
        },
      } as any);
      const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);
      limitSpy.mockResolvedValue({ success: false });

      const fn = vi.fn(async () => ({ id: "c1" }));
      const handler = apiHandler(fn, { rateLimit: true });
      const res = await handler({ request: new Request("http://localhost/") });

      expect(res.status).toBe(429);
      const body = (await res.json()) as any;
      expect(body.error.name).toBe("RateLimitedError");
      expect(fn).not.toHaveBeenCalled();
      expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    });

    it("invokes the wrapped handler as normal when under the mutation limit", async () => {
      vi.mocked(auth).mockReturnValue({
        api: {
          getSession: vi.fn().mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } }),
        },
      } as any);
      const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);
      limitSpy.mockResolvedValue({ success: true });

      const fn = vi.fn(async () => ({ id: "c1" }));
      const handler = apiHandler(fn, { rateLimit: true });
      const res = await handler({ request: new Request("http://localhost/") });

      expect(res.status).toBe(200);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    });

    it("returns 401 and never checks the rate limit when no session exists", async () => {
      vi.mocked(auth).mockReturnValue({
        api: { getSession: vi.fn().mockResolvedValue(null) },
      } as any);
      const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);

      const fn = vi.fn(async () => ({ id: "c1" }));
      const handler = apiHandler(fn, { rateLimit: true });
      const res = await handler({ request: new Request("http://localhost/") });

      expect(res.status).toBe(401);
      expect(fn).not.toHaveBeenCalled();
      expect(limitSpy).not.toHaveBeenCalled();
    });
  });
});

describe("parseBody", () => {
  const schema = z.object({ name: z.string().min(1) });

  it("returns parsed body on valid input", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "A" }),
    });
    await expect(parseBody(schema, req)).resolves.toEqual({ name: "A" });
  });

  it("throws ValidationError on invalid input", async () => {
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    await expect(parseBody(schema, req)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("parseQuery", () => {
  const schema = z.object({ type: z.enum(["expense", "income"]).optional() });

  it("returns parsed query on valid input", () => {
    const req = new Request("http://localhost/?type=expense");
    expect(parseQuery(schema, req)).toEqual({ type: "expense" });
  });

  it("throws ValidationError on invalid input", () => {
    const req = new Request("http://localhost/?type=nope");
    expect(() => parseQuery(schema, req)).toThrow(ValidationError);
  });
});

describe("requireUser", () => {
  it("returns userId when a session exists", async () => {
    vi.mocked(auth).mockReturnValue({
      api: { getSession: vi.fn().mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } }) },
    } as any);
    const req = new Request("http://localhost/");
    await expect(requireUser(req)).resolves.toBe("u1");
  });

  it("throws UnauthorizedError when no session", async () => {
    vi.mocked(auth).mockReturnValue({
      api: { getSession: vi.fn().mockResolvedValue(null) },
    } as any);
    const req = new Request("http://localhost/");
    await expect(requireUser(req)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("checkRateLimit", () => {
  it("throws RateLimitedError when binding reports limit exceeded", async () => {
    const mockBinding = {
      limit: vi.fn().mockResolvedValue({ success: false }),
    };
    await expect(checkRateLimit(mockBinding as any, "test-key")).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });

  it("throws RateLimitedError when binding call itself throws (fail closed)", async () => {
    const mockBinding = {
      limit: vi.fn().mockRejectedValue(new Error("Binding error")),
    };
    await expect(checkRateLimit(mockBinding as any, "test-key")).rejects.toBeInstanceOf(
      RateLimitedError,
    );
  });

  it("resolves without throwing when under the limit", async () => {
    const mockBinding = {
      limit: vi.fn().mockResolvedValue({ success: true }),
    };
    await expect(checkRateLimit(mockBinding as any, "test-key")).resolves.toBeUndefined();
  });

  it("calls binding.limit with the provided key", async () => {
    const mockBinding = {
      limit: vi.fn().mockResolvedValue({ success: true }),
    };
    await checkRateLimit(mockBinding as any, "user-123");
    expect(mockBinding.limit).toHaveBeenCalledWith({ key: "user-123" });
  });
});
