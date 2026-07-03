# Service → Repository Layer Design

**Date:** 2026-07-02
**Status:** Approved

## Overview

A layered data-access architecture for Plata's three core finance tables — `transactions`, `categories`, and `recurring_templates` — built on the existing Drizzle ORM + Cloudflare D1 stack. The layering separates pure database access (repository) from business rules, tenancy, and orchestration (service). Input validation lives with the consumer (route loaders, server functions, chat tools), which calls shared zod schemas before passing trusted, typed data to the service.

This spec covers all three finance tables together because they are tightly coupled: transactions reference categories and recurring templates via foreign keys, and recurring templates spawn transactions. Designing them as one unit keeps the cross-table flows coherent.

**Out of scope:** the `chat_sessions` / `chat_messages` tables, auth tables (`users`, `sessions`, `accounts`, `verifications`), UI components, route wiring, and the LLM tool implementations. The design is future-friendly for the chat-tool path but does not build it.

## Architecture & Layering

Three layers, top to bottom:

```
Route loader / server fn / chat tool
        │  (gets userId from the Better Auth session)
        ▼
   SERVICE LAYER  (src/lib/services/<table>.ts)
   - signature: fn(userId, input)
   - receives schema-validated, typed input (no zod inside)
   - enforces tenancy: passes userId into every repo call
   - cross-table orchestration (processDueRecurring, createTransactionWithCategory)
   - verifies FK ownership (category_id, recurring_template_id belong to same user)
   - throws NotFoundError / ConflictError / InternalError
        ▼
  REPOSITORY LAYER  (src/lib/repositories/<table>.ts)
   - standalone async functions calling getDB()
   - pure Drizzle CRUD, NO business rules, NO validation
   - takes userId where a query must be scoped (filter in where)
   - returns rows or null/empty (no throws — not-found is a service concern)
        ▼
     DB  (getDB() → Drizzle D1 client)
```

**Why this shape:** the repository stays swappable and trivially mockable; every rule and every tenancy check lives in exactly one place (the service); the caller never touches Drizzle directly.

### Files

New:
- `src/lib/repositories/transactions.ts` (currently empty → filled)
- `src/lib/repositories/recurring-templates.ts`
- `src/lib/services/transactions.ts`
- `src/lib/services/categories.ts`
- `src/lib/services/recurring-templates.ts`
- `src/lib/schemas/transactions.ts`
- `src/lib/schemas/categories.ts`
- `src/lib/schemas/recurring-templates.ts`
- `src/lib/errors.ts` (typed errors)
- `src/lib/db/transaction.ts` (D1 `batch()` helper for multi-step ops)

Modified:
- `src/lib/repositories/category.ts` — rewritten to the pure-DB contract; all reads take `userId` and filter by it. The current `getCategories()` returns every category globally (a tenancy bug) and is removed.

## Errors & Validation

### Typed errors

All in `src/lib/errors.ts`, extending a common `AppError` base with `status` and a `toJSON()` so the server-fn error handler serializes them uniformly.

| Error            | Status | Origin   | Thrown when                                                                                          | Carries                          |
| ---------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- |
| `ValidationError`| 400    | Consumer | zod `parse` fails on input                                                                            | `fieldErrors` (zod `flatten()`)  |
| `NotFoundError`  | 404    | Service  | repo returns null on a lookup that must exist; FK target not found for this user; row not matched on update/delete | `resource`, `id`                 |
| `ConflictError`  | 409    | Service  | unique-constraint violation (e.g. duplicate category name per user)                                  | `constraint`, `field`            |
| `InternalError`  | 500    | Service  | unexpected: insert `.returning()` came back empty, D1 batch fails partway, invariant violated (e.g. a due template whose `status` is not `active`), illegal recurring status transition | `message`, optional `cause`      |

### Validation contract

- Shared zod schemas live in `src/lib/schemas/<entity>.ts` — one source of truth per entity. Each exports the schema as a const and an inferred type that share the **same name** (declaration merging), e.g.:
  ```ts
  export const Transaction = z.object({ /* ... */ });
  export type Transaction = z.infer<typeof Transaction>;
  ```
  Same name for const and type lets a consumer flip `import { type Transaction }` to `import { Transaction }` (the value, to call `.parse()`) with no other change.
- The existing drizzle-inferred type exports in `src/db/schema.ts` (`Transaction`, `Category`, `RecurringTemplate`, and their `Insert*` variants) are **removed**. They are currently referenced only by `repositories/category.ts` (being rewritten here); prose mentions in story files are unrelated. The zod schemas' same-named exports become the canonical entity types.
- **Consumers** (route loaders, server fns, chat tools) import the schema value and call `.parse()` themselves, then pass the typed result to the service.
- The **service** performs no `zod.parse`. It trusts the typed input and owns business logic, tenancy, and orchestration only. Service function signatures take the schema's exported type — e.g. `createTransaction(userId: string, input: Transaction)` — so the input shape has a single source of truth (the schema) and the service contract is "give me data already validated to this shape."
- Derived/computed fields are **not** in the input schema — the service sets them: `id` (via `crypto.randomUUID()`), `user_id` (from the arg), `created_at`/`updated_at` (DB defaults).

### Input vs. insert payload

- The zod schema type is the **consumer input** shape. Its `amount` field uses a `.transform()` to convert the caller's decimal to cents, so the inferred type already carries `amount` as cents (integer). Because the consumer calls `.parse()`, the transform runs **before** the value reaches the service — the service receives cents, not decimals.
- The service forms the **insert payload** from that input by only adding the derived fields: `id` (via `crypto.randomUUID()`) and `user_id` (from the arg). No amount coercion happens in the service.
- The repo's `.values()` call is type-checked by Drizzle at the call site (the insert shape is inferred from the table definition), so **no named `Insert*` type is needed** — the compiler still enforces insertion correctness. Removing the drizzle-inferred `Insert*` exports does not weaken safety.
- Repo return types (selected rows) are **inferred** from the Drizzle queries rather than annotated with a named row type; the service lets that inference flow through. This keeps YAGNI — no separate row schemas are introduced unless a later need arises.

## Data Model & Domain Rules

### Money handling

- `amount` is integer **cents** in the DB (the `integer` column). The zod schema in `src/lib/schemas/transactions.ts` (and `recurring-templates.ts`) accepts a decimal `number` from the caller and transforms to cents: `z.number().transform(v => Math.round(v * 100))`. The service and repo only ever see cents.
- `currency` defaults to `"USD"` at the DB level; the schema requires a 3-letter ISO 4217 code, defaulting to `"USD"`.

### Tenancy & ownership

- Every repo query that reads/writes a user-scoped row filters `where(eq(table.user_id, userId))`. A `getTransactionById(userId, id)` that finds a row belonging to another user returns `null` (treated as `NotFoundError` by the service) — it never leaks existence.
- `category_id` and `recurring_template_id` on a transaction: the service verifies the referenced category/template belongs to the **same** `userId` before inserting. A cross-tenant reference → `NotFoundError` (the shape was valid; the resource just doesn't exist for this user).
- The current `getCategories()` repo bug (no user filter) is fixed by rewriting `category.ts` so all reads take and filter on `userId`.

### Soft delete

- `transactions`, `categories`, and `recurring_templates` all have `deleted_at`. The service uses **soft delete** (sets `deleted_at = now`), and read queries exclude `where(isNull(deleted_at))` by default. No hard-delete is exposed from the service for these three.

### IDs & timestamps

- `id` is generated by the service via `crypto.randomUUID()` (available globally on Cloudflare Workers — confirmed in the Web Crypto runtime API) before insert — not by the DB or the caller.
- `created_at`/`updated_at` rely on the schema's existing `default`/`$onUpdate`.

## Service & Repository APIs

Signatures only; implementation detail lands in the plan.

### Transactions

**Repository** (`src/lib/repositories/transactions.ts`)
- `createTransaction(userId, input)` → inserts `input` (which already carries the service-generated `id`); returns the inserted row.
- `getTransactionById(userId, id)` → row | null (scoped by `user_id`).
- `listTransactions(userId, filters)` → row[] (filters: date range, `type`, `category_id`; excludes `deleted_at`).
- `updateTransaction(userId, id, patch)` → row | null.
- `softDeleteTransaction(userId, id)` → row | null.

**Service** (`src/lib/services/transactions.ts`)
- `createTransaction(userId, input)` → verifies `category_id` and `recurring_template_id` (if present) belong to the same user (else `NotFoundError`); generates id; calls repo; empty `.returning()` → `InternalError`.
- `createTransactionWithCategory(userId, input)` → if the caller passes a new-category spec inline, creates the category then the transaction in a D1 `batch()` (atomic).
- `getTransaction`, `listTransactions`, `updateTransaction`, `deleteTransaction` → thin wrappers that turn repo `null` into `NotFoundError` on single-row ops.

### Categories

**Repository** (`src/lib/repositories/category.ts`) — rewritten
- `createCategory`, `getCategoryById(userId, id)`, `listCategories(userId)`, `updateCategory(userId, id, patch)`, `softDeleteCategory(userId, id)` — all scoped by `userId`.

**Service** (`src/lib/services/categories.ts`)
- CRUD mirroring the repo; `NotFoundError` on missing; `InternalError` on failed write. Unique-constraint violations (the `categories_name_user_id_unique` index) are caught and re-thrown as `ConflictError(409)` carrying the constraint/field.

### Recurring Templates

**Repository** (`src/lib/repositories/recurring-templates.ts`)
- `createRecurringTemplate`, `getRecurringTemplateById(userId, id)`, `listRecurringTemplates(userId, {status?})`, `updateRecurringTemplate(userId, id, patch)`, `softDeleteRecurringTemplate(userId, id)`.
- `listDueTemplates(userId, now)` → active templates with `next_due_date <= now` (feeds `processDueRecurring`).

**Service** (`src/lib/services/recurring-templates.ts`)
- CRUD + explicit status-transition methods: `activateTemplate(userId, id)`, `pauseTemplate(userId, id)`. Legal transitions only; an illegal transition (e.g. `completed` → `active`) is an invariant violation → `InternalError(500)`.
- `processDueRecurring(userId, now)` → for each due template:
  1. Insert a linked transaction (`recurring_template_id` set, `source` left to the caller's context — see Open Questions).
  2. Advance `next_due_date` by the template's `cadence`.
  3. Mark `status = "completed"` if the new `next_due_date` passes `end_date`.
  4. Idempotent via `last_insertion_date`: skip templates already processed for the current due period.
  5. Each template's insert+update runs in a D1 `batch()` (atomic per template).

### Multi-step ops helper

`src/lib/db/transaction.ts` wraps Drizzle's D1 `batch()` so `createTransactionWithCategory` and each `processDueRecurring` iteration run atomically. If a batch fails partway, the service throws `InternalError(500)` with the underlying error as `cause`.

## Error Mapping at the Edge

- A single `catch` at the server-fn boundary: if `instanceof AppError`, respond with its `.status` and `.toJSON()` body; otherwise log and respond `500` as a generic `InternalError`. Consumers stay thin — they `parse()` → call the service → let errors propagate.
- **Chat tool path:** future LLM tool functions call services the same way. A thrown `AppError` becomes a structured tool-error payload back to the model. Because services take explicit `userId`, the tool resolves the session's userId and passes it through — no special wiring is required.

## Test Strategy

Vitest is already configured.

- **Repository tests:** against a real SQLite via `better-sqlite3` local (the schema uses SQLite syntax; `@types/better-sqlite3` is in devDeps). Spin up an in-memory DB, apply migrations, seed. Assert SQL behavior: tenancy filters, soft-delete exclusion, unique constraints, due-template queries.
- **Service tests:** mock the repository module (`vi.mock`). Assert business rules: FK ownership checks throw `NotFoundError`, failed `.returning()` throws `InternalError`, unique violations surface as `ConflictError(409)`, illegal status transitions throw `InternalError`, and `processDueRecurring` cadence advancement + `last_insertion_date` idempotency.
- **Schema tests:** assert zod schemas coerce cents correctly and reject bad input.
- No component/route tests in this spec — the layer has no UI.

## Open Questions

1. **Source field on template-spawned transactions.** `processDueRecurring` inserts transactions with `recurring_template_id` set. What value should `source` take — a new `recurring` enum value, or reuse `manual`? The current `source` enum is `["manual", "chat", "csv_import"]`. Decision deferred to the plan; the schema may need a migration to add `"recurring"`.

## What's Not Included

- The `chat_sessions` / `chat_messages` tables and their service/repository layers.
- Auth tables (`users`, `sessions`, `accounts`, `verifications`).
- UI components and route wiring that consume these services.
- The LLM tool implementations that will call these services.
- Reports / budgets (generated on-the-fly from transaction queries).
