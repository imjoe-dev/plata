# API Routes for Services — Design

**Date:** 2026-07-04
**Status:** Approved
**Goal:** Expose the service layer (`src/lib/services/*`) over HTTP with input validation and a consistent, correct mapping from service errors to HTTP status codes and error bodies.

## Context

Plata's service layer already encapsulates domain logic and throws a typed `AppError` hierarchy (`ValidationError` 400, `NotFoundError` 404, `ConflictError` 409, `InternalError` 500) from `src/lib/errors.ts`. Schemas are zod objects in `src/lib/schemas/*.ts`. The framework is TanStack Start with file-based routing and `server.handlers` on `createFileRoute` (existing examples: `src/routes/api/chat.ts`, `src/routes/api/auth/$.ts`). There is no shared HTTP/error-mapping helper today, and `ensureSession` throws a generic `Error("Unauthorized")` that would surface as a 500 instead of a 401.

## Decisions

- Add an `UnauthorizedError(401)` to the `AppError` hierarchy and make `ensureSession` throw it.
- Introduce a shared `src/lib/api/http.ts` with `apiHandler`, `toErrorResponse`, `parseBody`, `parseQuery`, and `requireUser` so every route maps errors and shapes responses identically.
- Envelope every successful response as `{ data }` (single) or `{ data, meta: { count } }` (list).
- Make zod date fields wire-ready via `z.coerce.date()` so ISO strings from JSON parse; inferred types stay `Date`.
- Full CRUD for categories, transactions, and recurring-templates, plus `pause` and `activate` action endpoints for recurring-templates. `processDueRecurring` stays out of HTTP (future Cloudflare Cron trigger).

## Error-mapping foundation

### `src/lib/errors.ts`

Add `UnauthorizedError extends AppError` mirroring the existing subclasses (status 401, `toJSON()` returning `{ name, status }`).

### `src/lib/auth/functions.ts`

`ensureSession` throws `UnauthorizedError` instead of `new Error("Unauthorized")`. `getSession` is unchanged.

### `src/lib/api/http.ts` (new)

Shared HTTP helpers used by every route:

- `apiHandler(fn, { status = 200 })` — wraps an async handler in try/catch. On success, envelopes the result: `{ data }` for a single row, `{ data, meta: { count } }` for an array. Returns a `Response` with the given status. On error, delegates to `toErrorResponse`.
- `toErrorResponse(error)` — maps to a `Response`:
  - `AppError` → its `status` and `{ error: err.toJSON(), message: err.message }`.
  - `ZodError` → 400 with `{ error: { name: "ValidationError", status: 400, fieldErrors }, message: "Validation failed" }`.
  - Anything else → 500 with `{ error: { name: "InternalError", status: 500 }, message: "Internal server error" }` (no internals leaked).
- `parseBody(schema, request)` — `await request.json()` then `safeParse`; throws `ValidationError(fieldErrors)` on failure.
- `parseQuery(schema, request)` — read `new URL(request.url).searchParams` into a plain object, `safeParse`, throws `ValidationError` on failure.
- `requireUser(request)` — calls `auth().api.getSession({ headers: request.headers })`; throws `UnauthorizedError` if absent; returns `session.user.id`.

## Schemas → wire-ready (`src/lib/schemas/*.ts`)

- `transactions.ts` and `recurring-templates.ts`: change `z.date()` → `z.coerce.date()`. The inferred type stays `Date` (services unaffected; existing schema tests still pass because `Date` inputs coerce fine), and ISO strings from JSON now parse.
- Export partial schemas for PATCH bodies: `CategoryPatch = Category.partial()`, `TransactionPatch`, `RecurringTemplatePatch`.
- Export query-param schemas:
  - `TransactionListQuery` — `from?` and `to?` as `z.coerce.date()`, `type?` as the expense/income enum, `categoryId?` as a string.
  - `RecurringTemplateListQuery` — `status?` as the active/paused/completed/failed enum.

## Route files

TanStack file-based routing with `server.handlers`:

```
src/routes/api/
  categories/
    index.ts          GET list, POST create
    $id.ts            GET, PATCH, DELETE
  transactions/
    index.ts          GET list (query filters), POST create
    $id.ts            GET, PATCH, DELETE
  recurring-templates/
    index.ts          GET list (status filter), POST create
    $id/
      index.ts        GET, PATCH, DELETE
      pause.ts        POST pause
      activate.ts     POST activate
```

Flat `$id.ts` for the two simple resources (matches the existing `api/auth/$.ts` style). `$id/` directory for recurring-templates because it has child action routes (`pause`, `activate`).

Each handler follows the same shape:

1. `requireUser(request)` → `userId`.
2. `parseBody` / `parseQuery` as needed.
3. Call the corresponding service function with `(userId, ...)`.
4. Return the row(s); the envelope and status are applied by `apiHandler`.

### Endpoint matrix

| Resource     | Method | Path                                    | Service call                                 |
| ------------ | ------ | --------------------------------------- | -------------------------------------------- |
| Categories   | GET    | `/api/categories`                       | `listCategories(userId)`                     |
| Categories   | POST   | `/api/categories`                       | `createCategory(userId, body)`               |
| Categories   | GET    | `/api/categories/$id`                   | `getCategory(userId, id)`                    |
| Categories   | PATCH  | `/api/categories/$id`                   | `updateCategory(userId, id, body)`           |
| Categories   | DELETE | `/api/categories/$id`                   | `deleteCategory(userId, id)`                 |
| Transactions | GET    | `/api/transactions`                     | `listTransactions(userId, query)`            |
| Transactions | POST   | `/api/transactions`                     | `createTransaction(userId, body)`            |
| Transactions | GET    | `/api/transactions/$id`                 | `getTransaction(userId, id)`                 |
| Transactions | PATCH  | `/api/transactions/$id`                 | `updateTransaction(userId, id, body)`        |
| Transactions | DELETE | `/api/transactions/$id`                 | `deleteTransaction(userId, id)`              |
| Recurring    | GET    | `/api/recurring-templates`              | `listRecurringTemplates(userId, { status })` |
| Recurring    | POST   | `/api/recurring-templates`              | `createRecurringTemplate(userId, body)`      |
| Recurring    | GET    | `/api/recurring-templates/$id`          | `getRecurringTemplate(userId, id)`           |
| Recurring    | PATCH  | `/api/recurring-templates/$id`          | `updateRecurringTemplate(userId, id, body)`  |
| Recurring    | DELETE | `/api/recurring-templates/$id`          | `deleteRecurringTemplate(userId, id)`        |
| Recurring    | POST   | `/api/recurring-templates/$id/pause`    | `pauseTemplate(userId, id)`                  |
| Recurring    | POST   | `/api/recurring-templates/$id/activate` | `activateTemplate(userId, id)`               |

## Status & response contract

| Outcome         | Status | Body                                                                     |
| --------------- | ------ | ------------------------------------------------------------------------ |
| Created         | 201    | `{ data: row }`                                                          |
| OK single       | 200    | `{ data: row }`                                                          |
| OK list         | 200    | `{ data: [...], meta: { count } }`                                       |
| Validation fail | 400    | `{ error: { name, status, fieldErrors }, message: "Validation failed" }` |
| Unauthorized    | 401    | `{ error: { name, status }, message: "Unauthorized" }`                   |
| Not found       | 404    | `{ error: { name, status, resource, id }, message }`                     |
| Conflict        | 409    | `{ error: { name, status, constraint, field }, message }`                |
| Internal        | 500    | `{ error: { name, status }, message: "Internal server error" }`          |

## Testing

### `src/lib/api/__tests__/http.test.ts` (pure, high value)

- `toErrorResponse` maps each `AppError` subclass (`ValidationError`, `UnauthorizedError`, `NotFoundError`, `ConflictError`, `InternalError`) to the right status and body shape.
- `toErrorResponse` maps a `ZodError` to 400 with `fieldErrors`.
- `toErrorResponse` maps an unknown error to 500 with a generic message and no leaked internals.
- `apiHandler` envelopes a single row as `{ data }` with the given status.
- `apiHandler` envelopes an array as `{ data, meta: { count } }`.
- `parseBody` throws `ValidationError` on bad input; `parseQuery` throws `ValidationError` on bad query params.

### Route tests

One test file per route file. Invoke `Route.server.handlers.METHOD({ request, params })` with a constructed `Request`, mocking `@/lib/auth/server` (for `getSession`) and the relevant service module — mirroring the existing `vi.mock` style in `src/lib/services/__tests__/*.test.ts`. Cover, per resource, one representative test for each outcome: success + envelope, 400 validation, 404, 409 (categories only), 401 unauthorized.

## Out of scope

- `processDueRecurring` HTTP route (future Cloudflare Cron trigger).
- Pagination of list endpoints (the `meta` envelope leaves room for it).
- Auth/RBAC beyond the current single-user session model.
- Changes to the UI or TanStack Query hooks.
