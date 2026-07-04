# API Routes for Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the service layer (`src/lib/services/*`) over HTTP with zod input validation and a consistent mapping from `AppError`/`ZodError` to HTTP status codes and error bodies.

**Architecture:** A shared `src/lib/api/http.ts` provides `apiHandler` (envelope + error wrapping), `toErrorResponse` (error → Response), `parseBody`/`parseQuery` (zod validation → `ValidationError`), and `requireUser` (session → userId or `UnauthorizedError`). File-based TanStack Start routes under `src/routes/api/` call these helpers then delegate to the existing services. A new `UnauthorizedError(401)` extends the `AppError` hierarchy.

**Tech Stack:** TanStack Start (file-based routing, `server.handlers`), zod v4, better-auth, Vitest (`vite-plus/test`).

## Global Constraints

- Test runner: `vp test run` (alias from `package.json` `"test": "vp test run"`). Tests import from `"vite-plus/test"`.
- Lint + typecheck + format: `vp check` (run after each task; the pre-commit hook also runs `vp check --fix`).
- Test environment is `node`; test files match `src/**/*.test.ts` (see `vitest.config.ts`).
- Path alias `@` → `src/` (configured in `vitest.config.ts` and `tsconfig.json`).
- Mock style: `vi.mock("@/lib/...", () => ({ fnName: vi.fn() }))` then `vi.mocked(...)` — see `src/lib/services/__tests__/categories.test.ts`.
- Error classes live in `src/lib/errors.ts` and each carries a `status` plus a `toJSON()` method.
- Schemas are zod objects in `src/lib/schemas/*.ts`; services consume the inferred types.
- TanStack route handlers receive `{ request, params }` and may return a `Response` (see `src/routes/api/chat.ts`, `src/routes/api/auth/$.ts`).

---

### Task 1: Add UnauthorizedError and fix ensureSession

**Files:**

- Modify: `src/lib/errors.ts` (append new class after `InternalError`)
- Modify: `src/lib/auth/functions.ts:12-19` (`ensureSession` throws `UnauthorizedError`)
- Test: `src/lib/__tests__/errors.test.ts` (new)

**Interfaces:**

- Consumes: `AppError` base class in `src/lib/errors.ts:3`.
- Produces: `export class UnauthorizedError extends AppError` with `status: 401` and `toJSON()` → `{ name, status }`. Imported by `src/lib/auth/functions.ts` and later by `src/lib/api/http.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/errors.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";

describe("AppError subclasses", () => {
  it("UnauthorizedError has status 401 and a name/status JSON", () => {
    const err = new UnauthorizedError();
    expect(err.status).toBe(401);
    expect(err.name).toBe("UnauthorizedError");
    expect(err.toJSON()).toEqual({ name: "UnauthorizedError", status: 401 });
  });

  it("ValidationError includes fieldErrors", () => {
    const err = new ValidationError({ name: ["required"] });
    expect(err.status).toBe(400);
    expect(err.toJSON()).toMatchObject({ fieldErrors: { name: ["required"] } });
  });

  it("NotFoundError includes resource and id", () => {
    const err = new NotFoundError("category", "c1");
    expect(err.status).toBe(404);
    expect(err.toJSON()).toMatchObject({ resource: "category", id: "c1" });
  });

  it("ConflictError includes constraint and field", () => {
    const err = new ConflictError("categories_name_user_id_unique", "name");
    expect(err.status).toBe(409);
    expect(err.toJSON()).toMatchObject({
      constraint: "categories_name_user_id_unique",
      field: "name",
    });
  });

  it("InternalError has status 500", () => {
    expect(new InternalError("boom").status).toBe(500);
  });

  it("all subclasses extend AppError", () => {
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
    expect(new ValidationError({})).toBeInstanceOf(AppError);
    expect(new NotFoundError("x", "1")).toBeInstanceOf(AppError);
    expect(new ConflictError("c", "f")).toBeInstanceOf(AppError);
    expect(new InternalError("x")).toBeInstanceOf(AppError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/__tests__/errors.test.ts`
Expected: FAIL — `UnauthorizedError` is not exported (`TypeError: UnauthorizedError is not a constructor`).

- [ ] **Step 3: Add UnauthorizedError to errors.ts**

Append to `src/lib/errors.ts` (after the `InternalError` class):

```ts
export class UnauthorizedError extends AppError {
  constructor() {
    super(401, "Unauthorized");
  }

  toJSON(): ErrorJSON {
    return super.toJSON();
  }
}
```

- [ ] **Step 4: Fix ensureSession to throw UnauthorizedError**

In `src/lib/auth/functions.ts`, change the import and the throw. Replace:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth/server";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth().api.getSession({ headers });

  return session;
});

export const ensureSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth().api.getSession({ headers });
  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
});
```

with:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth/server";
import { UnauthorizedError } from "@/lib/errors";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth().api.getSession({ headers });

  return session;
});

export const ensureSession = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth().api.getSession({ headers });
  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `vp test run src/lib/__tests__/errors.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 6: Run full check**

Run: `vp check && vp test run`
Expected: no lint/typecheck errors; all existing tests still pass (ensureSession change is behavior-compatible for callers that only check the throw).

- [ ] **Step 7: Commit**

```bash
git add src/lib/errors.ts src/lib/auth/functions.ts src/lib/__tests__/errors.test.ts
git commit -m "feat(errors): add UnauthorizedError(401) and use it in ensureSession"
```

---

### Task 2: Shared HTTP helpers (src/lib/api/http.ts)

**Files:**

- Create: `src/lib/api/http.ts`
- Test: `src/lib/api/__tests__/http.test.ts`

**Interfaces:**

- Consumes: `AppError` and subclasses from `src/lib/errors.ts` (Task 1); `auth` from `src/lib/auth/server`; zod `ZodError`.
- Produces (all exported from `@/lib/api/http`):
  - `type HandlerCtx = { request: Request; params?: Record<string, string> }`
  - `apiHandler(fn: (ctx: HandlerCtx) => Promise<unknown>, opts?: { status?: number }): (ctx: HandlerCtx) => Promise<Response>` — envelopes result (`{ data }` single, `{ data, meta: { count } }` array), returns JSON `Response` with `opts.status` (default 200); on throw delegates to `toErrorResponse`.
  - `toErrorResponse(error: unknown): Response` — `AppError` → its `status` + `{ error: err.toJSON(), message: err.message }`; `ZodError` → 400 + `{ error: { name: "ValidationError", status: 400, fieldErrors }, message: "Validation failed" }`; else → 500 + `{ error: { name: "InternalError", status: 500 }, message: "Internal server error" }`.
  - `parseBody<T>(schema: ZodType<T>, request: Request): Promise<T>` — `await request.json()` + `safeParse`; throws `ValidationError(fieldErrors)` on failure.
  - `parseQuery<T>(schema: ZodType<T>, request: Request): T` — reads `new URL(request.url).searchParams` into a plain object + `safeParse`; throws `ValidationError` on failure.
  - `requireUser(request: Request): Promise<string>` — `auth().api.getSession({ headers: request.headers })`; throws `UnauthorizedError` if absent; returns `session.user.id`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/__tests__/http.test.ts`:

```ts
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
      const body = await res.json();
      expect(body.error.name).toBe("ValidationError");
      expect(body.error.fieldErrors).toBeDefined();
    }
  });

  it("maps an unknown error to 500 without leaking internals", async () => {
    const res = toErrorResponse(new Error("DB password is hunter2"));
    expect(res.status).toBe(500);
    const body = await res.json();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/api/__tests__/http.test.ts`
Expected: FAIL — module `@/lib/api/http` does not exist.

- [ ] **Step 3: Implement src/lib/api/http.ts**

Create `src/lib/api/http.ts`:

```ts
import type { ZodType } from "zod";
import { ZodError } from "zod";

import { auth } from "@/lib/auth/server";
import { AppError, UnauthorizedError, ValidationError } from "@/lib/errors";

export type HandlerCtx = { request: Request; params?: Record<string, string> };

const JSON_HEADERS = { "content-type": "application/json" } as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json({ error: error.toJSON(), message: error.message }, error.status);
  }
  if (error instanceof ZodError) {
    return json(
      {
        error: { name: "ValidationError", status: 400, fieldErrors: error.flatten().fieldErrors },
        message: "Validation failed",
      },
      400,
    );
  }
  return json(
    { error: { name: "InternalError", status: 500 }, message: "Internal server error" },
    500,
  );
}

export function apiHandler(
  fn: (ctx: HandlerCtx) => Promise<unknown>,
  opts: { status?: number } = {},
) {
  return async (ctx: HandlerCtx): Promise<Response> => {
    try {
      const result = await fn(ctx);
      const body = Array.isArray(result)
        ? { data: result, meta: { count: result.length } }
        : { data: result };
      return json(body, opts.status ?? 200);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function parseBody<T>(schema: ZodType<T>, request: Request): Promise<T> {
  const raw = await request.json();
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(result.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

export function parseQuery<T>(schema: ZodType<T>, request: Request): T {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    raw[key] = value;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(result.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

export async function requireUser(request: Request): Promise<string> {
  const session = await auth().api.getSession({ headers: request.headers });
  if (!session) {
    throw new UnauthorizedError();
  }
  return session.user.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/api/__tests__/http.test.ts`
Expected: PASS (all tests across `toErrorResponse`, `apiHandler`, `parseBody`, `parseQuery`, `requireUser`).

- [ ] **Step 5: Run full check**

Run: `vp check && vp test run`
Expected: no errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/http.ts src/lib/api/__tests__/http.test.ts
git commit -m "feat(api): add shared http helpers (apiHandler, toErrorResponse, parseBody, parseQuery, requireUser)"
```

---

### Task 3: Wire-ready schemas (coerce dates, partials, query schemas)

**Files:**

- Modify: `src/lib/schemas/transactions.ts` (change `z.date()` → `z.coerce.date()`; add `TransactionPatch`, `TransactionListQuery`)
- Modify: `src/lib/schemas/recurring-templates.ts` (change `z.date()` → `z.coerce.date()`; add `RecurringTemplatePatch`, `RecurringTemplateListQuery`)
- Modify: `src/lib/schemas/categories.ts` (add `CategoryPatch`)
- Test: `src/lib/__tests__/schemas.test.ts` (add cases; existing cases must still pass)

**Interfaces:**

- Consumes: existing zod schemas.
- Produces:
  - `TransactionPatch` = `Transaction.partial()` (type + schema), exported from `@/lib/schemas/transactions`.
  - `TransactionListQuery` — `{ from?: Date, to?: Date, type?: "expense"|"income", categoryId?: string }`, exported.
  - `RecurringTemplatePatch` = `RecurringTemplate.partial()`, `RecurringTemplateListQuery` — `{ status?: "active"|"paused"|"completed"|"failed" }`, exported.
  - `CategoryPatch` = `Category.partial()`, exported from `@/lib/schemas/categories`.
  - `date` fields now accept ISO date strings (coerced to `Date`); inferred TS type stays `Date`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/__tests__/schemas.test.ts` (append inside the file, after the existing `describe` blocks):

```ts
describe("Transaction schema — wire readiness", () => {
  it("coerces an ISO date string to a Date", () => {
    const out = Transaction.parse({
      amount: 10,
      type: "expense",
      description: "x",
      date: "2026-07-01T00:00:00.000Z",
      source: "manual",
    });
    expect(out.date).toBeInstanceOf(Date);
  });

  it("TransactionPatch accepts a partial body", () => {
    const out = TransactionPatch.parse({ description: "Y" });
    expect(out).toEqual({ description: "Y" });
  });

  it("TransactionListQuery coerces from/to and validates type", () => {
    const out = TransactionListQuery.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T00:00:00.000Z",
      type: "income",
      categoryId: "c1",
    });
    expect(out.from).toBeInstanceOf(Date);
    expect(out.to).toBeInstanceOf(Date);
    expect(out.type).toBe("income");
  });

  it("TransactionListQuery rejects an unknown type", () => {
    expect(() => TransactionListQuery.parse({ type: "nope" })).toThrow();
  });
});

describe("RecurringTemplate schema — wire readiness", () => {
  it("coerces an ISO date string for nextDueDate", () => {
    const out = RecurringTemplate.parse({
      amount: 100,
      type: "expense",
      description: "x",
      cadence: "monthly",
      status: "active",
      nextDueDate: "2026-08-01T00:00:00.000Z",
    });
    expect(out.nextDueDate).toBeInstanceOf(Date);
  });

  it("RecurringTemplatePatch accepts a partial body", () => {
    expect(RecurringTemplatePatch.parse({ status: "paused" })).toEqual({ status: "paused" });
  });

  it("RecurringTemplateListQuery validates status", () => {
    expect(RecurringTemplateListQuery.parse({ status: "active" }).status).toBe("active");
    expect(() => RecurringTemplateListQuery.parse({ status: "nope" })).toThrow();
  });
});

describe("CategoryPatch", () => {
  it("accepts a partial body", () => {
    expect(CategoryPatch.parse({ name: "B" })).toEqual({ name: "B" });
  });
});
```

Also add `CategoryPatch`, `TransactionPatch`, `TransactionListQuery`, `RecurringTemplatePatch`, `RecurringTemplateListQuery` to the imports at the top of the file. Replace the import block:

```ts
import { Category } from "@/lib/schemas/categories";
import { Transaction } from "@/lib/schemas/transactions";
import { RecurringTemplate } from "@/lib/schemas/recurring-templates";
```

with:

```ts
import { Category, CategoryPatch } from "@/lib/schemas/categories";
import { Transaction, TransactionPatch, TransactionListQuery } from "@/lib/schemas/transactions";
import {
  RecurringTemplate,
  RecurringTemplatePatch,
  RecurringTemplateListQuery,
} from "@/lib/schemas/recurring-templates";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/__tests__/schemas.test.ts`
Expected: FAIL — `CategoryPatch` / `TransactionPatch` / `TransactionListQuery` / `RecurringTemplatePatch` / `RecurringTemplateListQuery` are not exported; the ISO-string date coercion tests fail (`out.date` is not a `Date`).

- [ ] **Step 3: Update categories.ts**

Replace the full contents of `src/lib/schemas/categories.ts` with:

```ts
import { z } from "zod";

export const Category = z.object({
  name: z.string().min(1),
  type: z.enum(["expense", "income", "both"]),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export type Category = z.infer<typeof Category>;

export const CategoryPatch = Category.partial();

export type CategoryPatch = z.infer<typeof CategoryPatch>;
```

- [ ] **Step 4: Update transactions.ts**

Replace the full contents of `src/lib/schemas/transactions.ts` with:

```ts
import { z } from "zod";

export const Transaction = z.object({
  amount: z
    .number()
    .positive()
    .transform((v) => Math.round(v * 100)),
  currency: z.string().length(3).default("USD"),
  type: z.enum(["expense", "income"]),
  description: z.string().min(1),
  date: z.coerce.date(),
  categoryId: z.string().nullable().optional(),
  recurringTemplateId: z.string().nullable().optional(),
  source: z.enum(["manual", "chat", "csv_import"]),
  notes: z.string().nullable().optional(),
});

export type Transaction = z.infer<typeof Transaction>;

export const TransactionPatch = Transaction.partial();

export type TransactionPatch = z.infer<typeof TransactionPatch>;

export const TransactionListQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.enum(["expense", "income"]).optional(),
  categoryId: z.string().optional(),
});

export type TransactionListQuery = z.infer<typeof TransactionListQuery>;
```

- [ ] **Step 5: Update recurring-templates.ts**

Replace the full contents of `src/lib/schemas/recurring-templates.ts` with:

```ts
import { z } from "zod";

export const RecurringTemplate = z.object({
  amount: z
    .number()
    .positive()
    .transform((v) => Math.round(v * 100)),
  currency: z.string().length(3).default("USD"),
  type: z.enum(["expense", "income"]),
  description: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  cadence: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  nextDueDate: z.coerce.date().nullable().optional(),
  status: z.enum(["active", "paused", "completed", "failed"]),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export type RecurringTemplate = z.infer<typeof RecurringTemplate>;

export const RecurringTemplatePatch = RecurringTemplate.partial();

export type RecurringTemplatePatch = z.infer<typeof RecurringTemplatePatch>;

export const RecurringTemplateListQuery = z.object({
  status: z.enum(["active", "paused", "completed", "failed"]).optional(),
});

export type RecurringTemplateListQuery = z.infer<typeof RecurringTemplateListQuery>;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `vp test run src/lib/__tests__/schemas.test.ts`
Expected: PASS — all existing cases (which pass `Date` objects, which coerce fine) plus the new wire-readiness cases.

- [ ] **Step 7: Run full check + service tests**

Run: `vp check && vp test run`
Expected: no typecheck errors (inferred `date` type is still `Date`, so services are unaffected); all service tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/schemas/categories.ts src/lib/schemas/transactions.ts src/lib/schemas/recurring-templates.ts src/lib/__tests__/schemas.test.ts
git commit -m "feat(schemas): coerce date fields, add patch and list-query schemas"
```

---

### Task 4: Categories routes

**Files:**

- Create: `src/routes/api/categories/index.ts` (GET list, POST create)
- Create: `src/routes/api/categories/$id.ts` (GET, PATCH, DELETE)
- Test: `src/routes/api/categories/__tests__/index.test.ts`
- Test: `src/routes/api/categories/__tests__/$id.test.ts`

**Interfaces:**

- Consumes: `apiHandler`, `parseBody`, `requireUser` from `@/lib/api/http` (Task 2); `Category`, `CategoryPatch` from `@/lib/schemas/categories` (Task 3); `createCategory`, `listCategories`, `getCategory`, `updateCategory`, `deleteCategory` from `@/lib/services/categories`.
- Produces: TanStack file routes at `/api/categories` and `/api/categories/$id`.

- [ ] **Step 1: Write the failing test for the index route**

Create `src/routes/api/categories/__tests__/index.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { UnauthorizedError } from "@/lib/errors";

vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/categories", () => ({
  createCategory: vi.fn(),
  listCategories: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/categories";
import { Route } from "@/routes/api/categories/index";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/categories", () => {
  it("returns an enveloped list", async () => {
    authedUser();
    vi.mocked(svc.listCategories).mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }] as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories"),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "c1" }, { id: "c2" }], meta: { count: 2 } });
    expect(svc.listCategories).toHaveBeenCalledWith("u1");
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories"),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/categories", () => {
  it("creates and returns 201 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.createCategory).mockResolvedValueOnce({
      id: "c1",
      name: "A",
      type: "expense",
    } as any);
    const req = new Request("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "A", type: "expense" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: "c1", name: "A", type: "expense" } });
    expect(svc.createCategory).toHaveBeenCalledWith("u1", { name: "A", type: "expense" });
  });

  it("returns 400 on an invalid body", async () => {
    authedUser();
    const req = new Request("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "", type: "nope" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(400);
  });

  it("returns 409 when the service throws ConflictError", async () => {
    authedUser();
    const { ConflictError } = await import("@/lib/errors");
    vi.mocked(svc.createCategory).mockRejectedValueOnce(new ConflictError("uq", "name"));
    const req = new Request("http://localhost/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: "A", type: "expense" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/routes/api/categories/__tests__/index.test.ts`
Expected: FAIL — `@/routes/api/categories/index` does not exist.

- [ ] **Step 3: Implement the index route**

Create `src/routes/api/categories/index.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, requireUser } from "@/lib/api/http";
import { Category } from "@/lib/schemas/categories";
import { createCategory, listCategories } from "@/lib/services/categories";

export const Route = createFileRoute("/api/categories/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request }) => {
        const userId = await requireUser(request);
        return listCategories(userId);
      }),
      POST: apiHandler(
        async ({ request }) => {
          const userId = await requireUser(request);
          const body = await parseBody(Category, request);
          return createCategory(userId, body);
        },
        { status: 201 },
      ),
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/routes/api/categories/__tests__/index.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing test for the $id route**

Create `src/routes/api/categories/__tests__/$id.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/categories", () => ({
  createCategory: vi.fn(),
  listCategories: vi.fn(),
  getCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/categories";
import { Route } from "@/routes/api/categories/$id";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/categories/$id", () => {
  it("returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.getCategory).mockResolvedValueOnce({ id: "c1", name: "A" } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories/c1"),
      params: { id: "c1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "c1", name: "A" } });
    expect(svc.getCategory).toHaveBeenCalledWith("u1", "c1");
  });

  it("returns 404 when not found", async () => {
    authedUser();
    vi.mocked(svc.getCategory).mockRejectedValueOnce(new NotFoundError("category", "c1"));
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories/c1"),
      params: { id: "c1" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/categories/c1"),
      params: { id: "c1" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/categories/$id", () => {
  it("updates and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.updateCategory).mockResolvedValueOnce({ id: "c1", name: "B" } as any);
    const req = new Request("http://localhost/api/categories/c1", {
      method: "PATCH",
      body: JSON.stringify({ name: "B" }),
    });
    const res = await Route.server!.handlers.PATCH({ request: req, params: { id: "c1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "c1", name: "B" } });
    expect(svc.updateCategory).toHaveBeenCalledWith("u1", "c1", { name: "B" });
  });
});

describe("DELETE /api/categories/$id", () => {
  it("deletes and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.deleteCategory).mockResolvedValueOnce({
      id: "c1",
      deleted_at: new Date(0),
    } as any);
    const res = await Route.server!.handlers.DELETE({
      request: new Request("http://localhost/api/categories/c1", { method: "DELETE" }),
      params: { id: "c1" },
    });
    expect(res.status).toBe(200);
    expect(svc.deleteCategory).toHaveBeenCalledWith("u1", "c1");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `vp test run src/routes/api/categories/__tests__/$id.test.ts`
Expected: FAIL — `@/routes/api/categories/$id` does not exist.

- [ ] **Step 7: Implement the $id route**

Create `src/routes/api/categories/$id.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, requireUser } from "@/lib/api/http";
import { CategoryPatch } from "@/lib/schemas/categories";
import { deleteCategory, getCategory, updateCategory } from "@/lib/services/categories";

export const Route = createFileRoute("/api/categories/$id")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return getCategory(userId, params!.id);
      }),
      PATCH: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        const patch = await parseBody(CategoryPatch, request);
        return updateCategory(userId, params!.id, patch);
      }),
      DELETE: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return deleteCategory(userId, params!.id);
      }),
    },
  },
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `vp test run src/routes/api/categories/__tests__/$id.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 9: Run full check**

Run: `vp check && vp test run`
Expected: no errors; all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/routes/api/categories/index.ts src/routes/api/categories/$id.ts src/routes/api/categories/__tests__/
git commit -m "feat(api): add categories CRUD routes"
```

---

### Task 5: Transactions routes

**Files:**

- Create: `src/routes/api/transactions/index.ts` (GET list with query filters, POST create)
- Create: `src/routes/api/transactions/$id.ts` (GET, PATCH, DELETE)
- Test: `src/routes/api/transactions/__tests__/index.test.ts`
- Test: `src/routes/api/transactions/__tests__/$id.test.ts`

**Interfaces:**

- Consumes: `apiHandler`, `parseBody`, `parseQuery`, `requireUser` from `@/lib/api/http` (Task 2); `Transaction`, `TransactionPatch`, `TransactionListQuery` from `@/lib/schemas/transactions` (Task 3); `createTransaction`, `listTransactions`, `getTransaction`, `updateTransaction`, `deleteTransaction` from `@/lib/services/transactions`.
- Produces: TanStack file routes at `/api/transactions` and `/api/transactions/$id`.

- [ ] **Step 1: Write the failing test for the index route**

Create `src/routes/api/transactions/__tests__/index.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/transactions", () => ({
  createTransaction: vi.fn(),
  listTransactions: vi.fn(),
  getTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/transactions";
import { Route } from "@/routes/api/transactions/index";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/transactions", () => {
  it("passes parsed query filters to the service and envelopes the list", async () => {
    authedUser();
    vi.mocked(svc.listTransactions).mockResolvedValueOnce([{ id: "t1" }] as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions?type=income&categoryId=c1"),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "t1" }], meta: { count: 1 } });
    expect(svc.listTransactions).toHaveBeenCalledWith("u1", {
      type: "income",
      categoryId: "c1",
    });
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions"),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 on an invalid query filter", async () => {
    authedUser();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions?type=nope"),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/transactions", () => {
  it("creates and returns 201 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.createTransaction).mockResolvedValueOnce({ id: "t1" } as any);
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amount: 12.34,
        type: "expense",
        description: "Lunch",
        date: "2026-07-01T00:00:00.000Z",
        source: "manual",
      }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("t1");
    const [, input] = vi.mocked(svc.createTransaction).mock.calls[0];
    expect(input.amount).toBe(1234);
    expect(input.date).toBeInstanceOf(Date);
  });

  it("returns 400 on an invalid body", async () => {
    authedUser();
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({ type: "expense" }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(400);
  });

  it("returns 404 when a referenced categoryId is missing", async () => {
    authedUser();
    const { NotFoundError } = await import("@/lib/errors");
    vi.mocked(svc.createTransaction).mockRejectedValueOnce(new NotFoundError("category", "c1"));
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        amount: 10,
        type: "expense",
        description: "x",
        date: "2026-07-01T00:00:00.000Z",
        source: "manual",
        categoryId: "c1",
      }),
    });
    const res = await Route.server!.handlers.POST({ request: req });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/routes/api/transactions/__tests__/index.test.ts`
Expected: FAIL — `@/routes/api/transactions/index` does not exist.

- [ ] **Step 3: Implement the index route**

Create `src/routes/api/transactions/index.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, parseQuery, requireUser } from "@/lib/api/http";
import { Transaction, TransactionListQuery } from "@/lib/schemas/transactions";
import { createTransaction, listTransactions } from "@/lib/services/transactions";

export const Route = createFileRoute("/api/transactions/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request }) => {
        const userId = await requireUser(request);
        const query = parseQuery(TransactionListQuery, request);
        return listTransactions(userId, query);
      }),
      POST: apiHandler(
        async ({ request }) => {
          const userId = await requireUser(request);
          const body = await parseBody(Transaction, request);
          return createTransaction(userId, body);
        },
        { status: 201 },
      ),
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/routes/api/transactions/__tests__/index.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing test for the $id route**

Create `src/routes/api/transactions/__tests__/$id.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/services/transactions", () => ({
  createTransaction: vi.fn(),
  listTransactions: vi.fn(),
  getTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

import { auth } from "@/lib/auth/server";
import * as svc from "@/lib/services/transactions";
import { Route } from "@/routes/api/transactions/$id";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/transactions/$id", () => {
  it("returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.getTransaction).mockResolvedValueOnce({ id: "t1" } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions/t1"),
      params: { id: "t1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "t1" } });
    expect(svc.getTransaction).toHaveBeenCalledWith("u1", "t1");
  });

  it("returns 404 when not found", async () => {
    authedUser();
    vi.mocked(svc.getTransaction).mockRejectedValueOnce(new NotFoundError("transaction", "t1"));
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions/t1"),
      params: { id: "t1" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/transactions/t1"),
      params: { id: "t1" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/transactions/$id", () => {
  it("updates and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.updateTransaction).mockResolvedValueOnce({ id: "t1", description: "Y" } as any);
    const req = new Request("http://localhost/api/transactions/t1", {
      method: "PATCH",
      body: JSON.stringify({ description: "Y" }),
    });
    const res = await Route.server!.handlers.PATCH({ request: req, params: { id: "t1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "t1", description: "Y" } });
    expect(svc.updateTransaction).toHaveBeenCalledWith("u1", "t1", { description: "Y" });
  });
});

describe("DELETE /api/transactions/$id", () => {
  it("deletes and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.deleteTransaction).mockResolvedValueOnce({
      id: "t1",
      deleted_at: new Date(0),
    } as any);
    const res = await Route.server!.handlers.DELETE({
      request: new Request("http://localhost/api/transactions/t1", { method: "DELETE" }),
      params: { id: "t1" },
    });
    expect(res.status).toBe(200);
    expect(svc.deleteTransaction).toHaveBeenCalledWith("u1", "t1");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `vp test run src/routes/api/transactions/__tests__/$id.test.ts`
Expected: FAIL — `@/routes/api/transactions/$id` does not exist.

- [ ] **Step 7: Implement the $id route**

Create `src/routes/api/transactions/$id.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, requireUser } from "@/lib/api/http";
import { TransactionPatch } from "@/lib/schemas/transactions";
import { deleteTransaction, getTransaction, updateTransaction } from "@/lib/services/transactions";

export const Route = createFileRoute("/api/transactions/$id")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return getTransaction(userId, params!.id);
      }),
      PATCH: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        const patch = await parseBody(TransactionPatch, request);
        return updateTransaction(userId, params!.id, patch);
      }),
      DELETE: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return deleteTransaction(userId, params!.id);
      }),
    },
  },
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `vp test run src/routes/api/transactions/__tests__/$id.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 9: Run full check**

Run: `vp check && vp test run`
Expected: no errors; all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/routes/api/transactions/index.ts src/routes/api/transactions/$id.ts src/routes/api/transactions/__tests__/
git commit -m "feat(api): add transactions CRUD routes"
```

---

### Task 6: Recurring-templates routes (CRUD + pause/activate)

**Files:**

- Create: `src/routes/api/recurring-templates/index.ts` (GET list with status filter, POST create)
- Create: `src/routes/api/recurring-templates/$id/index.ts` (GET, PATCH, DELETE)
- Create: `src/routes/api/recurring-templates/$id/pause.ts` (POST)
- Create: `src/routes/api/recurring-templates/$id/activate.ts` (POST)
- Test: `src/routes/api/recurring-templates/__tests__/index.test.ts`
- Test: `src/routes/api/recurring-templates/__tests__/$id.test.ts`
- Test: `src/routes/api/recurring-templates/__tests__/pause.test.ts`
- Test: `src/routes/api/recurring-templates/__tests__/activate.test.ts`

**Interfaces:**

- Consumes: `apiHandler`, `parseBody`, `parseQuery`, `requireUser` from `@/lib/api/http` (Task 2); `RecurringTemplate`, `RecurringTemplatePatch`, `RecurringTemplateListQuery` from `@/lib/schemas/recurring-templates` (Task 3); `createRecurringTemplate`, `listRecurringTemplates`, `getRecurringTemplate`, `updateRecurringTemplate`, `deleteRecurringTemplate`, `pauseTemplate`, `activateTemplate` from `@/lib/services/recurring-templates`.
- Produces: TanStack file routes at `/api/recurring-templates`, `/api/recurring-templates/$id`, `/api/recurring-templates/$id/pause`, `/api/recurring-templates/$id/activate`.

- [ ] **Step 1: Write the failing test for the index route**

Create `src/routes/api/recurring-templates/__tests__/index.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

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
import { Route } from "@/routes/api/recurring-templates/index";

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

beforeEach(() => {
  vi.clearAllMocks();
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/routes/api/recurring-templates/__tests__/index.test.ts`
Expected: FAIL — `@/routes/api/recurring-templates/index` does not exist.

- [ ] **Step 3: Implement the index route**

Create `src/routes/api/recurring-templates/index.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, parseQuery, requireUser } from "@/lib/api/http";
import { RecurringTemplate, RecurringTemplateListQuery } from "@/lib/schemas/recurring-templates";
import {
  createRecurringTemplate,
  listRecurringTemplates,
} from "@/lib/services/recurring-templates";

export const Route = createFileRoute("/api/recurring-templates/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request }) => {
        const userId = await requireUser(request);
        const query = parseQuery(RecurringTemplateListQuery, request);
        return listRecurringTemplates(userId, query);
      }),
      POST: apiHandler(
        async ({ request }) => {
          const userId = await requireUser(request);
          const body = await parseBody(RecurringTemplate, request);
          return createRecurringTemplate(userId, body);
        },
        { status: 201 },
      ),
    },
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/routes/api/recurring-templates/__tests__/index.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing test for the $id route**

Create `src/routes/api/recurring-templates/__tests__/$id.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

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
import { Route } from "@/routes/api/recurring-templates/$id/index";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/recurring-templates/$id", () => {
  it("returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.getRecurringTemplate).mockResolvedValueOnce({ id: "r1" } as any);
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates/r1"),
      params: { id: "r1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "r1" } });
    expect(svc.getRecurringTemplate).toHaveBeenCalledWith("u1", "r1");
  });

  it("returns 404 when not found", async () => {
    authedUser();
    vi.mocked(svc.getRecurringTemplate).mockRejectedValueOnce(
      new NotFoundError("recurring_template", "r1"),
    );
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates/r1"),
      params: { id: "r1" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();
    const res = await Route.server!.handlers.GET({
      request: new Request("http://localhost/api/recurring-templates/r1"),
      params: { id: "r1" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/recurring-templates/$id", () => {
  it("updates and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.updateRecurringTemplate).mockResolvedValueOnce({
      id: "r1",
      status: "paused",
    } as any);
    const req = new Request("http://localhost/api/recurring-templates/r1", {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    });
    const res = await Route.server!.handlers.PATCH({ request: req, params: { id: "r1" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "r1", status: "paused" } });
    expect(svc.updateRecurringTemplate).toHaveBeenCalledWith("u1", "r1", { status: "paused" });
  });
});

describe("DELETE /api/recurring-templates/$id", () => {
  it("deletes and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.deleteRecurringTemplate).mockResolvedValueOnce({
      id: "r1",
      deleted_at: new Date(0),
    } as any);
    const res = await Route.server!.handlers.DELETE({
      request: new Request("http://localhost/api/recurring-templates/r1", { method: "DELETE" }),
      params: { id: "r1" },
    });
    expect(res.status).toBe(200);
    expect(svc.deleteRecurringTemplate).toHaveBeenCalledWith("u1", "r1");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `vp test run src/routes/api/recurring-templates/__tests__/$id.test.ts`
Expected: FAIL — `@/routes/api/recurring-templates/$id/index` does not exist.

- [ ] **Step 7: Implement the $id route**

Create `src/routes/api/recurring-templates/$id/index.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, parseBody, requireUser } from "@/lib/api/http";
import { RecurringTemplatePatch } from "@/lib/schemas/recurring-templates";
import {
  deleteRecurringTemplate,
  getRecurringTemplate,
  updateRecurringTemplate,
} from "@/lib/services/recurring-templates";

export const Route = createFileRoute("/api/recurring-templates/$id/")({
  server: {
    handlers: {
      GET: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return getRecurringTemplate(userId, params!.id);
      }),
      PATCH: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        const patch = await parseBody(RecurringTemplatePatch, request);
        return updateRecurringTemplate(userId, params!.id, patch);
      }),
      DELETE: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return deleteRecurringTemplate(userId, params!.id);
      }),
    },
  },
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `vp test run src/routes/api/recurring-templates/__tests__/$id.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 9: Write the failing test for the pause route**

Create `src/routes/api/recurring-templates/__tests__/pause.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InternalError, NotFoundError } from "@/lib/errors";

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
import { Route } from "@/routes/api/recurring-templates/$id/pause";

function authedUser(id = "u1") {
  vi.mocked(auth).mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue({ user: { id }, session: { id: "s1" } }) },
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/recurring-templates/$id/pause", () => {
  it("pauses and returns 200 enveloped data", async () => {
    authedUser();
    vi.mocked(svc.pauseTemplate).mockResolvedValueOnce({ id: "r1", status: "paused" } as any);
    const res = await Route.server!.handlers.POST({
      request: new Request("http://localhost/api/recurring-templates/r1/pause", { method: "POST" }),
      params: { id: "r1" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "r1", status: "paused" } });
    expect(svc.pauseTemplate).toHaveBeenCalledWith("u1", "r1");
  });

  it("returns 404 when the template is missing", async () => {
    authedUser();
    vi.mocked(svc.pauseTemplate).mockRejectedValueOnce(
      new NotFoundError("recurring_template", "r1"),
    );
    const res = await Route.server!.handlers.POST({
      request: new Request("http://localhost/api/recurring-templates/r1/pause", { method: "POST" }),
      params: { id: "r1" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 500 when the template cannot be paused (wrong status)", async () => {
    authedUser();
    vi.mocked(svc.pauseTemplate).mockRejectedValueOnce(new InternalError("cannot pause"));
    const res = await Route.server!.handlers.POST({
      request: new Request("http://localhost/api/recurring-templates/r1/pause", { method: "POST" }),
      params: { id: "r1" },
    });
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `vp test run src/routes/api/recurring-templates/__tests__/pause.test.ts`
Expected: FAIL — `@/routes/api/recurring-templates/$id/pause` does not exist.

- [ ] **Step 11: Implement the pause route**

Create `src/routes/api/recurring-templates/$id/pause.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, requireUser } from "@/lib/api/http";
import { pauseTemplate } from "@/lib/services/recurring-templates";

export const Route = createFileRoute("/api/recurring-templates/$id/pause")({
  server: {
    handlers: {
      POST: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return pauseTemplate(userId, params!.id);
      }),
    },
  },
});
```

- [ ] **Step 12: Run test to verify it passes**

Run: `vp test run src/routes/api/recurring-templates/__tests__/pause.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 13: Write the failing test for the activate route**

Create `src/routes/api/recurring-templates/__tests__/activate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InternalError, NotFoundError } from "@/lib/errors";

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
import { Route } from "@/routes/api/recurring-templates/$id/activate";

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
```

- [ ] **Step 14: Run test to verify it fails**

Run: `vp test run src/routes/api/recurring-templates/__tests__/activate.test.ts`
Expected: FAIL — `@/routes/api/recurring-templates/$id/activate` does not exist.

- [ ] **Step 15: Implement the activate route**

Create `src/routes/api/recurring-templates/$id/activate.ts`:

```ts
import { createFileRoute } from "@tanstack/react-router";

import { apiHandler, requireUser } from "@/lib/api/http";
import { activateTemplate } from "@/lib/services/recurring-templates";

export const Route = createFileRoute("/api/recurring-templates/$id/activate")({
  server: {
    handlers: {
      POST: apiHandler(async ({ request, params }) => {
        const userId = await requireUser(request);
        return activateTemplate(userId, params!.id);
      }),
    },
  },
});
```

- [ ] **Step 16: Run test to verify it passes**

Run: `vp test run src/routes/api/recurring-templates/__tests__/activate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 17: Run full check + entire suite**

Run: `vp check && vp test run`
Expected: no lint/typecheck errors; all tests across the repo pass.

- [ ] **Step 18: Commit**

```bash
git add src/routes/api/recurring-templates/ src/routes/api/recurring-templates/__tests__/
git commit -m "feat(api): add recurring-templates CRUD + pause/activate routes"
```
