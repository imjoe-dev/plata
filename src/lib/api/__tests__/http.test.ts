import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";

import {
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import { apiHandler, parseBody, parseQuery, requireUser, toErrorResponse } from "@/lib/api/http";

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
