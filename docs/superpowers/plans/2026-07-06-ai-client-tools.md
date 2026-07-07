# AI Client Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the chat model 17 type-safe, auto-executing TanStack AI client tools that `fetch` the existing categories / transactions / recurring-templates REST endpoints so the assistant can read and mutate the user's financial data during a conversation.

**Architecture:** Each tool is defined once with `toolDefinition({ name, description, inputSchema, outputSchema })` in a pure, server-safe module, then implemented on the client with `def.client(fn)` where `fn` calls a shared `fetch` wrapper. The server route `chat.ts` passes the bare **definitions** to `chat({ tools })` (executed in the browser); the client hook passes the **implementations** to `useChat` via `createChatClientOptions`. Tool inputs use a plain `z.number().positive()` for `amount` (major units) to avoid the API's double cents-conversion; client impls divide API cents by 100 on output so the model reasons in dollars end-to-end.

**Tech Stack:** TanStack AI (`@tanstack/ai` `toolDefinition`, `@tanstack/ai-client` `clientTools`/`createChatClientOptions`, `@tanstack/ai-react` `useChat`/`fetchServerSentEvents`), zod v4, Vitest (`vite-plus/test`).

## Global Constraints

- Test runner: `vp test run` (alias from `package.json` `"test": "vp test run"`). Tests import from `"vite-plus/test"`.
- Lint + typecheck + format: `vp check` (run after each task; the pre-commit hook also runs `vp check --fix`).
- Test environment is `node`; test files match `src/**/*.test.ts` (see `vitest.config.ts`). No DOM — do not use `renderHook`; test pure functions/exports instead.
- Path alias `@` → `src/` (configured in `vitest.config.ts` and `tsconfig.json`).
- Mock style: `vi.mock("@/lib/...", () => ({ fnName: vi.fn() }))` then `vi.mocked(...)`. Mock the global `fetch` with `vi.stubGlobal("fetch", fn)`.
- zod v4 (4.4.3): `.meta({ description })` is available on any `ZodType` (leaf, object, optional, enum).
- TanStack AI API: `toolDefinition` from `@tanstack/ai`; `def.client(fn)` returns a client tool whose `execute` is `fn`; `clientTools(...tools)` and `createChatClientOptions({ connection, forwardedProps, tools })` from `@tanstack/ai-client`; `useChat` + `fetchServerSentEvents` from `@tanstack/ai-react`.
- Amount contract: tool `inputSchema` amount = plain `z.number().positive()` (major units, e.g. `9.99`). The API schema (`src/lib/schemas/transactions.ts`, `recurring-templates.ts`) does the cents transform. Client impls divide the API's cents `amount` by 100 before returning.
- `create_transaction` tool input: `source` defaults to `"chat"` (override of the existing required enum) so AI-created transactions are tagged correctly without burdening the model.
- API response envelope: success → `{ data }` (single) or `{ data, meta: { count } }` (list); error → `{ error, message }`. Rows are snake_case; timestamps arrive as ISO strings over JSON (Drizzle `timestamp_ms` Date → `JSON.stringify` → ISO string).
- Commit style matches `git log`: `feat(ai): ...`, `chore: ...`, `docs: ...`.

---

### Task 1: fetch wrapper (`src/lib/ai/fetch.ts`)

**Files:**

- Create: `src/lib/ai/fetch.ts`
- Test: `src/lib/ai/__tests__/fetch.test.ts`

**Interfaces:**

- Consumes: global `fetch`.
- Produces: `apiGet<T>(path, query?)`, `apiPost<T>(path, body)`, `apiPatch<T>(path, body)`, `apiDelete<T>(path)`. Each returns `Promise<T>` where `T` is the unwrapped `data` field. `query` values may be `string | number | boolean | Date | undefined | null` (Date → `.toISOString()`, null/undefined skipped). Non-2xx throws `new Error(message)` using the API's `message`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/__tests__/fetch.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/ai/fetch";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiGet", () => {
  it("builds a query string and unwraps { data }", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "c1" } }));
    const result = await apiGet("/api/categories", { type: "expense" });
    expect(result).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories?type=expense");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("serializes Date query params as ISO strings and skips null/undefined", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [], meta: { count: 0 } }));
    await apiGet("/api/transactions", {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: undefined,
      categoryId: null,
    });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions?from=2026-01-01T00%3A00%3A00.000Z");
  });

  it("omits the query string when no query is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));
    await apiGet("/api/categories");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories");
  });
});

describe("apiPost", () => {
  it("sends a JSON body and unwraps data", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { data: { id: "c1" } }));
    const result = await apiPost("/api/categories", { name: "Food" });
    expect(result).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ name: "Food" });
  });
});

describe("apiPatch", () => {
  it("sends PATCH with a body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "c1", name: "X" } }));
    await apiPatch("/api/categories/c1", { name: "X" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ name: "X" });
  });
});

describe("apiDelete", () => {
  it("sends DELETE with no body and unwraps data", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "c1" } }));
    const result = await apiDelete("/api/categories/c1");
    expect(result).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});

describe("error handling", () => {
  it("throws the API message on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: {}, message: "Validation failed" }));
    await expect(apiGet("/api/categories")).rejects.toThrow("Validation failed");
  });

  it("falls back to a status message when no message is present", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    await expect(apiGet("/api/categories")).rejects.toThrow("Request failed with status 500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/ai/__tests__/fetch.test.ts`
Expected: FAIL — module `@/lib/ai/fetch` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/fetch.ts`:

```ts
type QueryValue = string | number | boolean | Date | undefined | null;
type Query = Record<string, QueryValue>;

function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const url = path + buildQuery(query);
  const init: RequestInit = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    const message =
      typeof json === "object" && json !== null && "message" in json
        ? String((json as { message: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return (json as { data: T }).data;
}

export function apiGet<T>(path: string, query?: Query): Promise<T> {
  return request<T>("GET", path, undefined, query);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>("DELETE", path);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/ai/__tests__/fetch.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run lint/typecheck/format**

Run: `vp check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/fetch.ts src/lib/ai/__tests__/fetch.test.ts
git commit -m "feat(ai): add fetch wrapper for client tools"
```

---

### Task 2: categories tool definitions (`src/lib/ai/tools/categories.ts`)

**Files:**

- Create: `src/lib/ai/tools/categories.ts`
- Test: `src/lib/ai/tools/__tests__/categories.test.ts`

**Interfaces:**

- Consumes: `Category`, `CategoryPatch` from `src/lib/schemas/categories.ts` (constraint source of truth).
- Produces: `CategoryRow` (zod object, output schema), and five tool definitions exported by name: `listCategoriesDef`, `createCategoryDef`, `getCategoryDef`, `updateCategoryDef`, `deleteCategoryDef`. Consumed by `src/lib/ai/tools/index.ts` (Task 5) and `src/lib/ai/tools/client.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/tools/__tests__/categories.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import {
  CategoryRow,
  createCategoryDef,
  deleteCategoryDef,
  getCategoryDef,
  listCategoriesDef,
  updateCategoryDef,
} from "@/lib/ai/tools/categories";

describe("categories tool definitions", () => {
  it("exposes five tools with stable names", () => {
    expect(listCategoriesDef.name).toBe("list_categories");
    expect(createCategoryDef.name).toBe("create_category");
    expect(getCategoryDef.name).toBe("get_category");
    expect(updateCategoryDef.name).toBe("update_category");
    expect(deleteCategoryDef.name).toBe("delete_category");
  });

  it("create_category accepts a valid category and rejects a bad type", () => {
    const parsed = createCategoryDef.inputSchema!.safeParse({
      name: "Food",
      type: "expense",
    });
    expect(parsed.success).toBe(true);
    const bad = createCategoryDef.inputSchema!.safeParse({ name: "Food", type: "nope" });
    expect(bad.success).toBe(false);
  });

  it("update_category requires an id and makes other fields optional", () => {
    const parsed = updateCategoryDef.inputSchema!.safeParse({ id: "c1" });
    expect(parsed.success).toBe(true);
    const noId = updateCategoryDef.inputSchema!.safeParse({ name: "X" });
    expect(noId.success).toBe(false);
  });

  it("get_category and delete_category require only an id", () => {
    expect(getCategoryDef.inputSchema!.safeParse({ id: "c1" }).success).toBe(true);
    expect(getCategoryDef.inputSchema!.safeParse({}).success).toBe(false);
    expect(deleteCategoryDef.inputSchema!.safeParse({ id: "c1" }).success).toBe(true);
  });

  it("CategoryRow validates a snake_case row with ISO timestamps", () => {
    const row = {
      id: "c1",
      name: "Food",
      type: "expense",
      color: null,
      icon: null,
      user_id: "u1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    };
    expect(CategoryRow.safeParse(row).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/ai/tools/__tests__/categories.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/tools/categories.ts`:

```ts
import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import { Category, CategoryPatch } from "@/lib/schemas/categories";

export const CategoryRow = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["expense", "income", "both"]),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type CategoryRow = z.infer<typeof CategoryRow>;

const ListCategoriesInput = z.object({});

const CreateCategoryInput = Category.extend({
  name: Category.shape.name.meta({ description: "Category name." }),
  type: Category.shape.type.meta({ description: "Category type: expense, income, or both." }),
  color: Category.shape.color.meta({ description: "Optional color, e.g. a hex code." }),
  icon: Category.shape.icon.meta({ description: "Optional icon name." }),
});

const IdInput = z.object({
  id: z.string().meta({ description: "Category id." }),
});

const UpdateCategoryInput = CategoryPatch.extend({
  id: z.string().meta({ description: "Category id." }),
  name: CategoryPatch.shape.name?.meta({ description: "New category name." }),
  type: CategoryPatch.shape.type?.meta({ description: "New category type." }),
  color: CategoryPatch.shape.color?.meta({ description: "New color." }),
  icon: CategoryPatch.shape.icon?.meta({ description: "New icon." }),
});

export const listCategoriesDef = toolDefinition({
  name: "list_categories",
  description: "List all categories for the current user.",
  inputSchema: ListCategoriesInput,
  outputSchema: z.array(CategoryRow),
});

export const createCategoryDef = toolDefinition({
  name: "create_category",
  description: "Create a new category.",
  inputSchema: CreateCategoryInput,
  outputSchema: CategoryRow,
});

export const getCategoryDef = toolDefinition({
  name: "get_category",
  description: "Get a single category by id.",
  inputSchema: IdInput,
  outputSchema: CategoryRow,
});

export const updateCategoryDef = toolDefinition({
  name: "update_category",
  description: "Update an existing category by id.",
  inputSchema: UpdateCategoryInput,
  outputSchema: CategoryRow,
});

export const deleteCategoryDef = toolDefinition({
  name: "delete_category",
  description: "Soft-delete a category by id.",
  inputSchema: IdInput,
  outputSchema: CategoryRow,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/ai/tools/__tests__/categories.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run lint/typecheck/format**

Run: `vp check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools/categories.ts src/lib/ai/tools/__tests__/categories.test.ts
git commit -m "feat(ai): add categories tool definitions"
```

---

### Task 3: transactions tool definitions (`src/lib/ai/tools/transactions.ts`)

**Files:**

- Create: `src/lib/ai/tools/transactions.ts`
- Test: `src/lib/ai/tools/__tests__/transactions.test.ts`

**Interfaces:**

- Consumes: `Transaction`, `TransactionPatch`, `TransactionListQuery` from `src/lib/schemas/transactions.ts` (constraint source; the `amount` transform is intentionally NOT reused).
- Produces: `TransactionRow` (output schema, `amount` in major units) and five tool definitions: `listTransactionsDef`, `createTransactionDef`, `getTransactionDef`, `updateTransactionDef`, `deleteTransactionDef`. The `create_transaction` input overrides `source` to default `"chat"`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/tools/__tests__/transactions.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import {
  TransactionRow,
  createTransactionDef,
  deleteTransactionDef,
  getTransactionDef,
  listTransactionsDef,
  updateTransactionDef,
} from "@/lib/ai/tools/transactions";

describe("transactions tool definitions", () => {
  it("exposes five tools with stable names", () => {
    expect(listTransactionsDef.name).toBe("list_transactions");
    expect(createTransactionDef.name).toBe("create_transaction");
    expect(getTransactionDef.name).toBe("get_transaction");
    expect(updateTransactionDef.name).toBe("update_transaction");
    expect(deleteTransactionDef.name).toBe("delete_transaction");
  });

  it("create_transaction accepts a positive amount in major units and does NOT transform to cents", () => {
    const parsed = createTransactionDef.inputSchema!.safeParse({
      amount: 9.99,
      type: "expense",
      description: "Lunch",
      date: "2026-07-01T00:00:00.000Z",
      source: "manual",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(9.99);
      expect(parsed.data.currency).toBe("USD");
    }
  });

  it("create_transaction rejects a non-positive amount", () => {
    const parsed = createTransactionDef.inputSchema!.safeParse({
      amount: -5,
      type: "expense",
      description: "x",
      date: "2026-07-01T00:00:00.000Z",
      source: "manual",
    });
    expect(parsed.success).toBe(false);
  });

  it("create_transaction defaults source to 'chat' when omitted", () => {
    const parsed = createTransactionDef.inputSchema!.safeParse({
      amount: 10,
      type: "expense",
      description: "x",
      date: "2026-07-01T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.source).toBe("chat");
  });

  it("list_transactions accepts optional date/type/categoryId filters", () => {
    expect(
      listTransactionsDef.inputSchema!.safeParse({
        from: "2026-01-01T00:00:00.000Z",
        type: "income",
      }).success,
    ).toBe(true);
    expect(listTransactionsDef.inputSchema!.safeParse({ type: "nope" }).success).toBe(false);
  });

  it("update_transaction requires an id and makes amount optional", () => {
    expect(updateTransactionDef.inputSchema!.safeParse({ id: "t1" }).success).toBe(true);
    expect(updateTransactionDef.inputSchema!.safeParse({ id: "t1", amount: 5 }).success).toBe(true);
    expect(updateTransactionDef.inputSchema!.safeParse({ amount: 5 }).success).toBe(false);
  });

  it("TransactionRow validates a row and reports amount in major units", () => {
    const row = {
      id: "t1",
      amount: 9.99,
      currency: "USD",
      type: "expense",
      description: "Lunch",
      date: "2026-07-01T00:00:00.000Z",
      category_id: null,
      user_id: "u1",
      recurring_template_id: null,
      source: "chat",
      notes: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
    };
    expect(TransactionRow.safeParse(row).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/ai/tools/__tests__/transactions.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/tools/transactions.ts`:

```ts
import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import { Transaction, TransactionListQuery, TransactionPatch } from "@/lib/schemas/transactions";

export const TransactionRow = z.object({
  id: z.string(),
  amount: z.number().meta({ description: "Amount in major currency units, e.g. 9.99 for $9.99." }),
  currency: z.string(),
  type: z.enum(["expense", "income"]),
  description: z.string(),
  date: z.string(),
  category_id: z.string().nullable(),
  user_id: z.string(),
  recurring_template_id: z.string().nullable(),
  source: z.enum(["manual", "chat", "csv_import"]),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type TransactionRow = z.infer<typeof TransactionRow>;

const AmountInput = z
  .number()
  .positive()
  .meta({ description: "Amount in major currency units, e.g. 9.99 for $9.99." });

const ListTransactionsInput = z.object({
  from: TransactionListQuery.shape.from?.meta({
    description: "ISO date string, inclusive lower bound.",
  }),
  to: TransactionListQuery.shape.to?.meta({
    description: "ISO date string, inclusive upper bound.",
  }),
  type: TransactionListQuery.shape.type?.meta({ description: "Filter by expense or income." }),
  categoryId: TransactionListQuery.shape.categoryId?.meta({
    description: "Filter by category id.",
  }),
});

const CreateTransactionInput = Transaction.omit({ amount: true, source: true }).extend({
  amount: AmountInput,
  source: z
    .enum(["manual", "chat", "csv_import"])
    .default("chat")
    .meta({ description: "Origin of the transaction. Defaults to 'chat' for AI-created rows." }),
  currency: Transaction.shape.currency.meta({ description: "ISO 4217 currency code, e.g. USD." }),
  type: Transaction.shape.type.meta({ description: "Transaction type: expense or income." }),
  description: Transaction.shape.description.meta({ description: "Human-readable description." }),
  date: Transaction.shape.date.meta({ description: "ISO date string." }),
  categoryId: Transaction.shape.categoryId?.meta({ description: "Optional category id." }),
  recurringTemplateId: Transaction.shape.recurringTemplateId?.meta({
    description: "Optional recurring template id.",
  }),
  notes: Transaction.shape.notes?.meta({ description: "Optional free-form notes." }),
});

const IdInput = z.object({ id: z.string().meta({ description: "Transaction id." }) });

const UpdateTransactionInput = TransactionPatch.omit({ amount: true }).extend({
  id: z.string().meta({ description: "Transaction id." }),
  amount: AmountInput.optional(),
});

export const listTransactionsDef = toolDefinition({
  name: "list_transactions",
  description:
    "List transactions for the current user, optionally filtered by date range, type, or category.",
  inputSchema: ListTransactionsInput,
  outputSchema: z.array(TransactionRow),
});

export const createTransactionDef = toolDefinition({
  name: "create_transaction",
  description: "Create a new transaction. Amount is in major currency units (e.g. 9.99 for $9.99).",
  inputSchema: CreateTransactionInput,
  outputSchema: TransactionRow,
});

export const getTransactionDef = toolDefinition({
  name: "get_transaction",
  description: "Get a single transaction by id.",
  inputSchema: IdInput,
  outputSchema: TransactionRow,
});

export const updateTransactionDef = toolDefinition({
  name: "update_transaction",
  description: "Update an existing transaction by id. Amount is in major currency units.",
  inputSchema: UpdateTransactionInput,
  outputSchema: TransactionRow,
});

export const deleteTransactionDef = toolDefinition({
  name: "delete_transaction",
  description: "Soft-delete a transaction by id.",
  inputSchema: IdInput,
  outputSchema: TransactionRow,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/ai/tools/__tests__/transactions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run lint/typecheck/format**

Run: `vp check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools/transactions.ts src/lib/ai/tools/__tests__/transactions.test.ts
git commit -m "feat(ai): add transactions tool definitions"
```

---

### Task 4: recurring-templates tool definitions (`src/lib/ai/tools/recurring-templates.ts`)

**Files:**

- Create: `src/lib/ai/tools/recurring-templates.ts`
- Test: `src/lib/ai/tools/__tests__/recurring-templates.test.ts`

**Interfaces:**

- Consumes: `RecurringTemplate`, `RecurringTemplatePatch`, `RecurringTemplateListQuery` from `src/lib/schemas/recurring-templates.ts` (constraint source; `amount` transform NOT reused).
- Produces: `RecurringTemplateRow` (output schema, `amount` in major units) and seven tool definitions: `listRecurringTemplatesDef`, `createRecurringTemplateDef`, `getRecurringTemplateDef`, `updateRecurringTemplateDef`, `deleteRecurringTemplateDef`, `activateRecurringTemplateDef`, `pauseRecurringTemplateDef`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/tools/__tests__/recurring-templates.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import {
  RecurringTemplateRow,
  activateRecurringTemplateDef,
  createRecurringTemplateDef,
  deleteRecurringTemplateDef,
  getRecurringTemplateDef,
  listRecurringTemplatesDef,
  pauseRecurringTemplateDef,
  updateRecurringTemplateDef,
} from "@/lib/ai/tools/recurring-templates";

describe("recurring-templates tool definitions", () => {
  it("exposes seven tools with stable names", () => {
    expect(listRecurringTemplatesDef.name).toBe("list_recurring_templates");
    expect(createRecurringTemplateDef.name).toBe("create_recurring_template");
    expect(getRecurringTemplateDef.name).toBe("get_recurring_template");
    expect(updateRecurringTemplateDef.name).toBe("update_recurring_template");
    expect(deleteRecurringTemplateDef.name).toBe("delete_recurring_template");
    expect(activateRecurringTemplateDef.name).toBe("activate_recurring_template");
    expect(pauseRecurringTemplateDef.name).toBe("pause_recurring_template");
  });

  it("create_recurring_template accepts a positive amount in major units (no cents transform)", () => {
    const parsed = createRecurringTemplateDef.inputSchema!.safeParse({
      amount: 12.5,
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(12.5);
      expect(parsed.data.currency).toBe("USD");
    }
  });

  it("list_recurring_templates accepts an optional status filter", () => {
    expect(listRecurringTemplatesDef.inputSchema!.safeParse({ status: "active" }).success).toBe(
      true,
    );
    expect(listRecurringTemplatesDef.inputSchema!.safeParse({ status: "nope" }).success).toBe(
      false,
    );
  });

  it("activate/pause/get/delete require only an id", () => {
    const id = { id: "r1" };
    expect(activateRecurringTemplateDef.inputSchema!.safeParse(id).success).toBe(true);
    expect(pauseRecurringTemplateDef.inputSchema!.safeParse(id).success).toBe(true);
    expect(getRecurringTemplateDef.inputSchema!.safeParse(id).success).toBe(true);
    expect(deleteRecurringTemplateDef.inputSchema!.safeParse(id).success).toBe(true);
  });

  it("RecurringTemplateRow validates a row with amount in major units", () => {
    const row = {
      id: "r1",
      amount: 12.5,
      currency: "USD",
      type: "expense",
      description: "Rent",
      category_id: null,
      cadence: "monthly",
      next_due_date: "2026-08-01T00:00:00.000Z",
      last_insertion_date: null,
      status: "active",
      start_date: null,
      end_date: null,
      user_id: "u1",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
    };
    expect(RecurringTemplateRow.safeParse(row).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/ai/tools/__tests__/recurring-templates.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/tools/recurring-templates.ts`:

```ts
import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import {
  RecurringTemplate,
  RecurringTemplateListQuery,
  RecurringTemplatePatch,
} from "@/lib/schemas/recurring-templates";

export const RecurringTemplateRow = z.object({
  id: z.string(),
  amount: z
    .number()
    .meta({ description: "Amount in major currency units, e.g. 12.50 for $12.50." }),
  currency: z.string(),
  type: z.enum(["expense", "income"]),
  description: z.string(),
  category_id: z.string().nullable(),
  cadence: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  next_due_date: z.string().nullable(),
  last_insertion_date: z.string().nullable(),
  status: z.enum(["active", "paused", "completed", "failed"]),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type RecurringTemplateRow = z.infer<typeof RecurringTemplateRow>;

const AmountInput = z
  .number()
  .positive()
  .meta({ description: "Amount in major currency units, e.g. 12.50 for $12.50." });

const ListRecurringTemplatesInput = z.object({
  status: RecurringTemplateListQuery.shape.status?.meta({
    description: "Filter by status: active, paused, completed, or failed.",
  }),
});

const CreateRecurringTemplateInput = RecurringTemplate.omit({ amount: true }).extend({
  amount: AmountInput,
  currency: RecurringTemplate.shape.currency.meta({ description: "ISO 4217 currency code." }),
  type: RecurringTemplate.shape.type.meta({ description: "expense or income." }),
  description: RecurringTemplate.shape.description.meta({
    description: "Human-readable description.",
  }),
  categoryId: RecurringTemplate.shape.categoryId?.meta({ description: "Optional category id." }),
  cadence: RecurringTemplate.shape.cadence.meta({
    description: "How often the template recurs.",
  }),
  nextDueDate: RecurringTemplate.shape.nextDueDate?.meta({
    description: "Optional ISO date for the next due date.",
  }),
  status: RecurringTemplate.shape.status.meta({ description: "Template status." }),
  startDate: RecurringTemplate.shape.startDate?.meta({ description: "Optional ISO start date." }),
  endDate: RecurringTemplate.shape.endDate?.meta({ description: "Optional ISO end date." }),
});

const IdInput = z.object({ id: z.string().meta({ description: "Recurring template id." }) });

const UpdateRecurringTemplateInput = RecurringTemplatePatch.omit({ amount: true }).extend({
  id: z.string().meta({ description: "Recurring template id." }),
  amount: AmountInput.optional(),
});

export const listRecurringTemplatesDef = toolDefinition({
  name: "list_recurring_templates",
  description: "List recurring templates for the current user, optionally filtered by status.",
  inputSchema: ListRecurringTemplatesInput,
  outputSchema: z.array(RecurringTemplateRow),
});

export const createRecurringTemplateDef = toolDefinition({
  name: "create_recurring_template",
  description: "Create a new recurring template. Amount is in major currency units.",
  inputSchema: CreateRecurringTemplateInput,
  outputSchema: RecurringTemplateRow,
});

export const getRecurringTemplateDef = toolDefinition({
  name: "get_recurring_template",
  description: "Get a single recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
});

export const updateRecurringTemplateDef = toolDefinition({
  name: "update_recurring_template",
  description: "Update an existing recurring template by id. Amount is in major currency units.",
  inputSchema: UpdateRecurringTemplateInput,
  outputSchema: RecurringTemplateRow,
});

export const deleteRecurringTemplateDef = toolDefinition({
  name: "delete_recurring_template",
  description: "Soft-delete a recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
});

export const activateRecurringTemplateDef = toolDefinition({
  name: "activate_recurring_template",
  description: "Activate a paused recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
});

export const pauseRecurringTemplateDef = toolDefinition({
  name: "pause_recurring_template",
  description: "Pause an active recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/ai/tools/__tests__/recurring-templates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run lint/typecheck/format**

Run: `vp check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools/recurring-templates.ts src/lib/ai/tools/__tests__/recurring-templates.test.ts
git commit -m "feat(ai): add recurring-templates tool definitions"
```

---

### Task 5: definitions aggregate (`src/lib/ai/tools/index.ts`)

**Files:**

- Create: `src/lib/ai/tools/index.ts`
- Test: `src/lib/ai/tools/__tests__/index.test.ts`

**Interfaces:**

- Consumes: the 17 `*Def` exports from Tasks 2–4.
- Produces: `allToolDefinitions` — a readonly array of 17 tool definitions, imported by `src/routes/api/chat.ts` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/tools/__tests__/index.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import { allToolDefinitions } from "@/lib/ai/tools/index";

describe("allToolDefinitions", () => {
  it("contains 17 tools", () => {
    expect(allToolDefinitions).toHaveLength(17);
  });

  it("has unique names", () => {
    const names = allToolDefinitions.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes every expected tool name", () => {
    const names = new Set(allToolDefinitions.map((t) => t.name));
    const expected = [
      "list_categories",
      "create_category",
      "get_category",
      "update_category",
      "delete_category",
      "list_transactions",
      "create_transaction",
      "get_transaction",
      "update_transaction",
      "delete_transaction",
      "list_recurring_templates",
      "create_recurring_template",
      "get_recurring_template",
      "update_recurring_template",
      "delete_recurring_template",
      "activate_recurring_template",
      "pause_recurring_template",
    ];
    for (const name of expected) expect(names.has(name)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/ai/tools/__tests__/index.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/tools/index.ts`:

```ts
import {
  createCategoryDef,
  deleteCategoryDef,
  getCategoryDef,
  listCategoriesDef,
  updateCategoryDef,
} from "./categories";
import {
  activateRecurringTemplateDef,
  createRecurringTemplateDef,
  deleteRecurringTemplateDef,
  getRecurringTemplateDef,
  listRecurringTemplatesDef,
  pauseRecurringTemplateDef,
  updateRecurringTemplateDef,
} from "./recurring-templates";
import {
  createTransactionDef,
  deleteTransactionDef,
  getTransactionDef,
  listTransactionsDef,
  updateTransactionDef,
} from "./transactions";

export const allToolDefinitions = [
  listCategoriesDef,
  createCategoryDef,
  getCategoryDef,
  updateCategoryDef,
  deleteCategoryDef,
  listTransactionsDef,
  createTransactionDef,
  getTransactionDef,
  updateTransactionDef,
  deleteTransactionDef,
  listRecurringTemplatesDef,
  createRecurringTemplateDef,
  getRecurringTemplateDef,
  updateRecurringTemplateDef,
  deleteRecurringTemplateDef,
  activateRecurringTemplateDef,
  pauseRecurringTemplateDef,
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/ai/tools/__tests__/index.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run lint/typecheck/format**

Run: `vp check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools/index.ts src/lib/ai/tools/__tests__/index.test.ts
git commit -m "feat(ai): aggregate all tool definitions"
```

---

### Task 6: add `@tanstack/ai-client` dependency and wire definitions into the server (`src/routes/api/chat.ts`)

**Files:**

- Modify: `package.json` (add `@tanstack/ai-client` to `dependencies`)
- Modify: `src/routes/api/chat.ts` (pass `tools: allToolDefinitions` to `chat()`)
- Test: `src/routes/api/__tests__/chat.test.ts`

**Interfaces:**

- Consumes: `allToolDefinitions` from `src/lib/ai/tools/index.ts` (Task 5).
- Produces: `@tanstack/ai-client@^0.16.3` installed (needed by Task 7's `client.ts`); the chat route passes the 17 definitions to the model.

- [ ] **Step 1: Add the dependency**

Edit `package.json` `dependencies` to add (matching the transitive version already pulled by `@tanstack/ai-react@0.15.4`):

```json
"@tanstack/ai-client": "^0.16.3",
```

Run: `vp install`
Expected: lockfile updated, `@tanstack/ai-client` now a direct dependency.

- [ ] **Step 2: Write the failing test**

Create `src/routes/api/__tests__/chat.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

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
  it("passes all 17 tool definitions to chat()", async () => {
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
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `vp test run src/routes/api/__tests__/chat.test.ts`
Expected: FAIL — `call.tools` is undefined (the route does not pass tools yet).

- [ ] **Step 4: Wire the definitions into the route**

Edit `src/routes/api/chat.ts`. Add the import and pass `tools`:

```ts
import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from "@tanstack/ai";
import { createOpenaiChat, openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { allToolDefinitions } from "@/lib/ai/tools/index";

const SUPPORTED_MODELS = ["gpt-5.4-mini"] as const;
type SupportedModel = (typeof SUPPORTED_MODELS)[number];

const adapters: Record<SupportedModel, ReturnType<typeof openaiText>> = {
  "gpt-5.4-mini": createOpenaiChat("gpt-5.4-mini", env.OPENAI_API_KEY),
};

const modelIdSchema = z.object({
  model_id: z.enum(SUPPORTED_MODELS),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const { messages, forwardedProps } = await chatParamsFromRequestBody(body);
        const { model_id } = modelIdSchema.parse(forwardedProps ?? {});

        const stream = chat({
          adapter: adapters[model_id],
          messages,
          tools: allToolDefinitions,
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `vp test run src/routes/api/__tests__/chat.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Run full lint/typecheck/format**

Run: `vp check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json src/routes/api/chat.ts src/routes/api/__tests__/chat.test.ts
git commit -m "feat(ai): pass client tool definitions to chat route"
```

---

### Task 7: client implementations for categories (`src/lib/ai/tools/client.ts`)

**Files:**

- Create: `src/lib/ai/tools/client.ts`
- Test: `src/lib/ai/tools/__tests__/client-categories.test.ts`

**Interfaces:**

- Consumes: `apiGet`/`apiPost`/`apiPatch`/`apiDelete` from `src/lib/ai/fetch.ts` (Task 1); the five categories `*Def` from `src/lib/ai/tools/categories.ts` (Task 2); `clientTools` from `@tanstack/ai-client`.
- Produces: exported handler functions `listCategoriesHandler`, `createCategoryHandler`, `getCategoryHandler`, `updateCategoryHandler`, `deleteCategoryHandler`; their `.client()` tool objects; and `allClientTools` (initially containing the 5 categories tools; extended in Tasks 8–9). Imported by `src/hooks/use-plata-chat.ts` (Task 10).

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/tools/__tests__/client-categories.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createCategoryHandler,
  deleteCategoryHandler,
  getCategoryHandler,
  listCategoriesHandler,
  updateCategoryHandler,
} from "@/lib/ai/tools/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("listCategoriesHandler", () => {
  it("GETs /api/categories and returns the data array", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: "c1" }], meta: { count: 1 } }));
    const result = await listCategoriesHandler();
    expect(result).toEqual([{ id: "c1" }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories");
    expect(init.method).toBe("GET");
  });
});

describe("createCategoryHandler", () => {
  it("POSTs the body to /api/categories", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "c1" } }, 201));
    const result = await createCategoryHandler({ name: "Food", type: "expense" });
    expect(result).toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Food", type: "expense" });
  });
});

describe("getCategoryHandler", () => {
  it("GETs /api/categories/$id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "c1" } }));
    await getCategoryHandler({ id: "c1" });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
  });
});

describe("updateCategoryHandler", () => {
  it("PATCHes the patch (without id) to /api/categories/$id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "c1", name: "X" } }));
    await updateCategoryHandler({ id: "c1", name: "X" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ name: "X" });
  });
});

describe("deleteCategoryHandler", () => {
  it("DELETEs /api/categories/$id", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "c1" } }));
    await deleteCategoryHandler({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categories/c1");
    expect(init.method).toBe("DELETE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/ai/tools/__tests__/client-categories.test.ts`
Expected: FAIL — `@/lib/ai/tools/client` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ai/tools/client.ts`:

```ts
import { clientTools } from "@tanstack/ai-client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/ai/fetch";
import {
  createCategoryDef,
  deleteCategoryDef,
  getCategoryDef,
  listCategoriesDef,
  updateCategoryDef,
  type CategoryRow,
} from "./categories";

export async function listCategoriesHandler(): Promise<CategoryRow[]> {
  return apiGet<CategoryRow[]>("/api/categories");
}

export async function createCategoryHandler(input: {
  name: string;
  type: "expense" | "income" | "both";
  color?: string;
  icon?: string;
}): Promise<CategoryRow> {
  return apiPost<CategoryRow>("/api/categories", input);
}

export async function getCategoryHandler(input: { id: string }): Promise<CategoryRow> {
  return apiGet<CategoryRow>(`/api/categories/${input.id}`);
}

export async function updateCategoryHandler(input: {
  id: string;
  name?: string;
  type?: "expense" | "income" | "both";
  color?: string;
  icon?: string;
}): Promise<CategoryRow> {
  const { id, ...patch } = input;
  return apiPatch<CategoryRow>(`/api/categories/${id}`, patch);
}

export async function deleteCategoryHandler(input: { id: string }): Promise<CategoryRow> {
  return apiDelete<CategoryRow>(`/api/categories/${input.id}`);
}

const listCategories = listCategoriesDef.client(listCategoriesHandler);
const createCategory = createCategoryDef.client(createCategoryHandler);
const getCategory = getCategoryDef.client(getCategoryHandler);
const updateCategory = updateCategoryDef.client(updateCategoryHandler);
const deleteCategory = deleteCategoryDef.client(deleteCategoryHandler);

export const allClientTools = clientTools(
  listCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/ai/tools/__tests__/client-categories.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run lint/typecheck/format**

Run: `vp check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools/client.ts src/lib/ai/tools/__tests__/client-categories.test.ts
git commit -m "feat(ai): add categories client tool implementations"
```

---

### Task 8: client implementations for transactions (cents → dollars)

**Files:**

- Modify: `src/lib/ai/tools/client.ts` (append transactions handlers + extend `allClientTools`)
- Test: `src/lib/ai/tools/__tests__/client-transactions.test.ts`

**Interfaces:**

- Consumes: the five transactions `*Def` from `src/lib/ai/tools/transactions.ts` (Task 3); the fetch wrapper.
- Produces: `listTransactionsHandler`, `createTransactionHandler`, `getTransactionHandler`, `updateTransactionHandler`, `deleteTransactionHandler` — each divides the API's cents `amount` by 100 before returning. `allClientTools` grows to 10 tools.

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/tools/__tests__/client-transactions.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createTransactionHandler,
  deleteTransactionHandler,
  getTransactionHandler,
  listTransactionsHandler,
  updateTransactionHandler,
} from "@/lib/ai/tools/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("listTransactionsHandler", () => {
  it("GETs /api/transactions with query and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: "t1", amount: 999 }], meta: { count: 1 } }));
    const result = await listTransactionsHandler({ type: "expense" });
    expect(result).toEqual([{ id: "t1", amount: 9.99 }]);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions?type=expense");
  });
});

describe("createTransactionHandler", () => {
  it("POSTs dollars to /api/transactions and converts the response cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 1234 } }, 201));
    const result = await createTransactionHandler({
      amount: 12.34,
      type: "expense",
      description: "Lunch",
      date: new Date("2026-07-01T00:00:00.000Z"),
      source: "chat",
      currency: "USD",
    });
    expect(result).toEqual({ id: "t1", amount: 12.34 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.amount).toBe(12.34);
    expect(body.date).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("getTransactionHandler", () => {
  it("GETs /api/transactions/$id and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 500 } }));
    const result = await getTransactionHandler({ id: "t1" });
    expect(result).toEqual({ id: "t1", amount: 5 });
  });
});

describe("updateTransactionHandler", () => {
  it("PATCHes the patch (without id) and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 2500 } }));
    const result = await updateTransactionHandler({ id: "t1", amount: 25 });
    expect(result).toEqual({ id: "t1", amount: 25 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/transactions/t1");
    expect(JSON.parse(init.body as string)).toEqual({ amount: 25 });
  });
});

describe("deleteTransactionHandler", () => {
  it("DELETEs /api/transactions/$id and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "t1", amount: 1000 } }));
    const result = await deleteTransactionHandler({ id: "t1" });
    expect(result).toEqual({ id: "t1", amount: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/ai/tools/__tests__/client-transactions.test.ts`
Expected: FAIL — the transaction handlers are not exported from `client.ts` yet.

- [ ] **Step 3: Append transactions handlers to `client.ts`**

Add the following to `src/lib/ai/tools/client.ts` (below the categories section). Update the imports at the top to also import from `./transactions`, and extend the `allClientTools` call.

Updated import block (replace the existing `import` from `./categories` block and add the transactions import):

```ts
import { clientTools } from "@tanstack/ai-client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/ai/fetch";
import {
  createCategoryDef,
  deleteCategoryDef,
  getCategoryDef,
  listCategoriesDef,
  updateCategoryDef,
  type CategoryRow,
} from "./categories";
import {
  createTransactionDef,
  deleteTransactionDef,
  getTransactionDef,
  listTransactionsDef,
  updateTransactionDef,
  type TransactionRow,
} from "./transactions";

type TxRow = { id: string; amount: number; [k: string]: unknown };

function toDollars<T extends { amount: number }>(row: T): T {
  return { ...row, amount: row.amount / 100 };
}
```

Append the handler functions and tool objects (after the categories `.client(...)` declarations):

```ts
export async function listTransactionsHandler(input: {
  from?: Date;
  to?: Date;
  type?: "expense" | "income";
  categoryId?: string;
}): Promise<TransactionRow[]> {
  const rows = await apiGet<TxRow[]>("/api/transactions", input as Record<string, unknown>);
  return rows.map(toDollars) as unknown as TransactionRow[];
}

export async function createTransactionHandler(input: {
  amount: number;
  currency: string;
  type: "expense" | "income";
  description: string;
  date: Date;
  categoryId?: string | null;
  recurringTemplateId?: string | null;
  source: "manual" | "chat" | "csv_import";
  notes?: string | null;
}): Promise<TransactionRow> {
  const row = await apiPost<TxRow>("/api/transactions", input);
  return toDollars(row) as unknown as TransactionRow;
}

export async function getTransactionHandler(input: { id: string }): Promise<TransactionRow> {
  const row = await apiGet<TxRow>(`/api/transactions/${input.id}`);
  return toDollars(row) as unknown as TransactionRow;
}

export async function updateTransactionHandler(input: {
  id: string;
  amount?: number;
  currency?: string;
  type?: "expense" | "income";
  description?: string;
  date?: Date;
  categoryId?: string | null;
  recurringTemplateId?: string | null;
  source?: "manual" | "chat" | "csv_import";
  notes?: string | null;
}): Promise<TransactionRow> {
  const { id, ...patch } = input;
  const row = await apiPatch<TxRow>(`/api/transactions/${id}`, patch);
  return toDollars(row) as unknown as TransactionRow;
}

export async function deleteTransactionHandler(input: { id: string }): Promise<TransactionRow> {
  const row = await apiDelete<TxRow>(`/api/transactions/${input.id}`);
  return toDollars(row) as unknown as TransactionRow;
}

const listTransactions = listTransactionsDef.client(listTransactionsHandler);
const createTransaction = createTransactionDef.client(createTransactionHandler);
const getTransaction = getTransactionDef.client(getTransactionHandler);
const updateTransaction = updateTransactionDef.client(updateTransactionHandler);
const deleteTransaction = deleteTransactionDef.client(deleteTransactionHandler);
```

Replace the existing `allClientTools` declaration with:

```ts
export const allClientTools = clientTools(
  listCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  listTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/ai/tools/__tests__/client-transactions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run all client tests + lint**

Run: `vp test run src/lib/ai && vp check`
Expected: all green, no type/lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools/client.ts src/lib/ai/tools/__tests__/client-transactions.test.ts
git commit -m "feat(ai): add transactions client tool implementations"
```

---

### Task 9: client implementations for recurring-templates (cents → dollars, activate/pause)

**Files:**

- Modify: `src/lib/ai/tools/client.ts` (append recurring-templates handlers + extend `allClientTools`)
- Test: `src/lib/ai/tools/__tests__/client-recurring-templates.test.ts`

**Interfaces:**

- Consumes: the seven recurring-templates `*Def` from `src/lib/ai/tools/recurring-templates.ts` (Task 4); the fetch wrapper; the `toDollars` helper added in Task 8.
- Produces: seven handlers; `allClientTools` finalised at 17 tools.

- [ ] **Step 1: Write the failing test**

Create `src/lib/ai/tools/__tests__/client-recurring-templates.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  activateRecurringTemplateHandler,
  createRecurringTemplateHandler,
  deleteRecurringTemplateHandler,
  getRecurringTemplateHandler,
  listRecurringTemplatesHandler,
  pauseRecurringTemplateHandler,
  updateRecurringTemplateHandler,
} from "@/lib/ai/tools/client";
import { allClientTools } from "@/lib/ai/tools/client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("listRecurringTemplatesHandler", () => {
  it("GETs /api/recurring-templates?status=active and converts cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: [{ id: "r1", amount: 1500 }], meta: { count: 1 } }));
    const result = await listRecurringTemplatesHandler({ status: "active" });
    expect(result).toEqual([{ id: "r1", amount: 15 }]);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recurring-templates?status=active");
  });
});

describe("createRecurringTemplateHandler", () => {
  it("POSTs dollars and converts the response cents to dollars", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 1250 } }, 201));
    const result = await createRecurringTemplateHandler({
      amount: 12.5,
      currency: "USD",
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
    });
    expect(result).toEqual({ id: "r1", amount: 12.5 });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.amount).toBe(12.5);
  });
});

describe("getRecurringTemplateHandler", () => {
  it("GETs /api/recurring-templates/$id and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 800 } }));
    expect(await getRecurringTemplateHandler({ id: "r1" })).toEqual({ id: "r1", amount: 8 });
  });
});

describe("updateRecurringTemplateHandler", () => {
  it("PATCHes the patch (without id) and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 2000 } }));
    expect(await updateRecurringTemplateHandler({ id: "r1", amount: 20 })).toEqual({
      id: "r1",
      amount: 20,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recurring-templates/r1");
    expect(JSON.parse(init.body as string)).toEqual({ amount: 20 });
  });
});

describe("deleteRecurringTemplateHandler", () => {
  it("DELETEs /api/recurring-templates/$id and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 100 } }));
    expect(await deleteRecurringTemplateHandler({ id: "r1" })).toEqual({ id: "r1", amount: 1 });
  });
});

describe("activateRecurringTemplateHandler", () => {
  it("POSTs to /api/recurring-templates/$id/activate with no body and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 500 } }));
    expect(await activateRecurringTemplateHandler({ id: "r1" })).toEqual({ id: "r1", amount: 5 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recurring-templates/r1/activate");
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });
});

describe("pauseRecurringTemplateHandler", () => {
  it("POSTs to /api/recurring-templates/$id/pause with no body and converts cents", async () => {
    fetchMock.mockResolvedValueOnce(ok({ data: { id: "r1", amount: 500 } }));
    expect(await pauseRecurringTemplateHandler({ id: "r1" })).toEqual({ id: "r1", amount: 5 });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/recurring-templates/r1/pause");
  });
});

describe("allClientTools", () => {
  it("contains 17 client tools", () => {
    expect(allClientTools).toHaveLength(17);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/lib/ai/tools/__tests__/client-recurring-templates.test.ts`
Expected: FAIL — recurring-templates handlers not exported yet; `allClientTools` has 10 entries.

- [ ] **Step 3: Append recurring-templates handlers to `client.ts`**

Add the recurring-templates import to the top import block of `src/lib/ai/tools/client.ts`:

```ts
import {
  activateRecurringTemplateDef,
  createRecurringTemplateDef,
  deleteRecurringTemplateDef,
  getRecurringTemplateDef,
  listRecurringTemplatesDef,
  pauseRecurringTemplateDef,
  updateRecurringTemplateDef,
  type RecurringTemplateRow,
} from "./recurring-templates";
```

Append the handlers and tool objects (after the transactions `.client(...)` declarations):

```ts
type RtRow = { id: string; amount: number; [k: string]: unknown };

export async function listRecurringTemplatesHandler(input: {
  status?: "active" | "paused" | "completed" | "failed";
}): Promise<RecurringTemplateRow[]> {
  const rows = await apiGet<RtRow[]>("/api/recurring-templates", input as Record<string, unknown>);
  return rows.map(toDollars) as unknown as RecurringTemplateRow[];
}

export async function createRecurringTemplateHandler(input: {
  amount: number;
  currency: string;
  type: "expense" | "income";
  description: string;
  categoryId?: string | null;
  cadence: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  nextDueDate?: Date | null;
  status: "active" | "paused" | "completed" | "failed";
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<RecurringTemplateRow> {
  const row = await apiPost<RtRow>("/api/recurring-templates", input);
  return toDollars(row) as unknown as RecurringTemplateRow;
}

export async function getRecurringTemplateHandler(input: {
  id: string;
}): Promise<RecurringTemplateRow> {
  const row = await apiGet<RtRow>(`/api/recurring-templates/${input.id}`);
  return toDollars(row) as unknown as RecurringTemplateRow;
}

export async function updateRecurringTemplateHandler(input: {
  id: string;
  amount?: number;
  currency?: string;
  type?: "expense" | "income";
  description?: string;
  categoryId?: string | null;
  cadence?: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
  nextDueDate?: Date | null;
  status?: "active" | "paused" | "completed" | "failed";
  startDate?: Date | null;
  endDate?: Date | null;
}): Promise<RecurringTemplateRow> {
  const { id, ...patch } = input;
  const row = await apiPatch<RtRow>(`/api/recurring-templates/${id}`, patch);
  return toDollars(row) as unknown as RecurringTemplateRow;
}

export async function deleteRecurringTemplateHandler(input: {
  id: string;
}): Promise<RecurringTemplateRow> {
  const row = await apiDelete<RtRow>(`/api/recurring-templates/${input.id}`);
  return toDollars(row) as unknown as RecurringTemplateRow;
}

export async function activateRecurringTemplateHandler(input: {
  id: string;
}): Promise<RecurringTemplateRow> {
  const row = await apiPost<RtRow>(`/api/recurring-templates/${input.id}/activate`, undefined);
  return toDollars(row) as unknown as RecurringTemplateRow;
}

export async function pauseRecurringTemplateHandler(input: {
  id: string;
}): Promise<RecurringTemplateRow> {
  const row = await apiPost<RtRow>(`/api/recurring-templates/${input.id}/pause`, undefined);
  return toDollars(row) as unknown as RecurringTemplateRow;
}

const listRecurringTemplates = listRecurringTemplatesDef.client(listRecurringTemplatesHandler);
const createRecurringTemplate = createRecurringTemplateDef.client(createRecurringTemplateHandler);
const getRecurringTemplate = getRecurringTemplateDef.client(getRecurringTemplateHandler);
const updateRecurringTemplate = updateRecurringTemplateDef.client(updateRecurringTemplateHandler);
const deleteRecurringTemplate = deleteRecurringTemplateDef.client(deleteRecurringTemplateHandler);
const activateRecurringTemplate = activateRecurringTemplateDef.client(
  activateRecurringTemplateHandler,
);
const pauseRecurringTemplate = pauseRecurringTemplateDef.client(pauseRecurringTemplateHandler);
```

Replace the existing `allClientTools` declaration with the final 17-tool bundle:

```ts
export const allClientTools = clientTools(
  listCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  listTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  listRecurringTemplates,
  createRecurringTemplate,
  getRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate,
  activateRecurringTemplate,
  pauseRecurringTemplate,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/lib/ai/tools/__tests__/client-recurring-templates.test.ts`
Expected: PASS (8 tests, including the 17-tool count).

- [ ] **Step 5: Run the full test suite + lint**

Run: `vp test run && vp check`
Expected: all tests green; no type/lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools/client.ts src/lib/ai/tools/__tests__/client-recurring-templates.test.ts
git commit -m "feat(ai): add recurring-templates client tool implementations"
```

---

### Task 10: wire client tools into the chat hook (`src/hooks/use-plata-chat.ts`)

**Files:**

- Modify: `src/hooks/use-plata-chat.ts`
- Test: `src/hooks/__tests__/use-plata-chat.test.ts`

**Interfaces:**

- Consumes: `allClientTools` from `src/lib/ai/tools/client.ts` (Task 9); `createChatClientOptions` from `@tanstack/ai-client`; `useChat`, `fetchServerSentEvents` from `@tanstack/ai-react`.
- Produces: an exported `plataChatOptions` object (built with `createChatClientOptions`) carrying `connection`, `forwardedProps: { model_id }`, and `tools: allClientTools`; `usePlataChat` calls `useChat(plataChatOptions)` and preserves the existing `useBufferedMessages` wrapper.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/use-plata-chat.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";

import { plataChatOptions } from "@/hooks/use-plata-chat";

describe("plataChatOptions", () => {
  it("registers all 17 client tools", () => {
    expect(plataChatOptions.tools).toHaveLength(17);
  });

  it("forwards the model_id prop", () => {
    expect(plataChatOptions.forwardedProps).toEqual({ model_id: "gpt-5.4-mini" });
  });

  it("targets /api/chat", () => {
    expect(plataChatOptions.connection).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vp test run src/hooks/__tests__/use-plata-chat.test.ts`
Expected: FAIL — `plataChatOptions` is not exported.

- [ ] **Step 3: Wire the options into the hook**

Replace `src/hooks/use-plata-chat.ts` with:

```ts
import { useEffect, useRef, useState, startTransition } from "react";
import { createChatClientOptions, fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import type { UIMessage } from "@tanstack/ai-react";

import { allClientTools } from "@/lib/ai/tools/client";

function useBufferedMessages(raw: UIMessage[]) {
  const [buffered, setBuffered] = useState(raw);
  const latestRef = useRef(raw);
  const pendingRef = useRef(false);

  useEffect(() => {
    latestRef.current = raw;
    if (!pendingRef.current) {
      pendingRef.current = true;
      requestAnimationFrame(() => {
        startTransition(() => {
          setBuffered(latestRef.current);
        });
        pendingRef.current = false;
      });
    }
  }, [raw]);

  return buffered;
}

export const plataChatOptions = createChatClientOptions({
  connection: fetchServerSentEvents("/api/chat"),
  forwardedProps: { model_id: "gpt-5.4-mini" },
  tools: allClientTools,
});

export function usePlataChat() {
  const chat = useChat(plataChatOptions);

  const messages = useBufferedMessages(chat.messages);

  return { ...chat, messages };
}
```

> Note: `@tanstack/ai-react` re-exports `createChatClientOptions`, `fetchServerSentEvents`, `useChat`, and `UIMessage`, so a single import source works.

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test run src/hooks/__tests__/use-plata-chat.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite + lint + typecheck**

Run: `vp test run && vp check`
Expected: all green, no type/lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-plata-chat.ts src/hooks/__tests__/use-plata-chat.test.ts
git commit -m "feat(ai): wire client tools into the chat hook"
```
