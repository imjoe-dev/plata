# Plan: Transactions List Pagination & Optional Filters

**Spec:** [./spec.md](./spec.md)
**Mode:** brownfield
**Status:** Approved
**Created:** 2026-07-12
**Version:** 1.1

---

## 1. Overview

This is a targeted refactor of the existing `GET /api/transactions` route and the `list_transactions` chat tool that calls it, both already built on TanStack Start file-based API routes, Zod validation, and a thin Drizzle-ORM repository layer. Three changes deliver spec §2's goals: (1) make every filter tolerant of `null`/empty-string values so the chat tool's tool-calling behavior can no longer crash validation, (2) add offset-based `page`/`limit` pagination with a fixed `created_at desc` default order at the repository, service, and route layers, and (3) extend the shared `{ data, meta }` response envelope with pagination metadata, propagated through to the chat tool so the LLM can tell whether more pages exist.

## 2. Codebase Context

**Affected modules:**

- `src/lib/schemas/transactions.ts` — `TransactionListQuery` (HTTP query schema)
- `src/lib/repositories/transactions.ts` — `listTransactions`, `ListFilters`
- `src/lib/services/transactions.ts` — `listTransactions` passthrough
- `src/routes/api/transactions/index.ts` — `GET` handler
- `src/lib/api/http.ts` — `apiHandler` envelope construction
- `src/lib/ai/tools/transactions.ts` — `ListTransactionsInput`, `listTransactionsDef`
- `src/lib/ai/tools/client.ts` — `listTransactionsHandler`
- `src/lib/ai/fetch.ts` — `apiGet` (discards response `meta` today)
- `src/db/schema.ts` — `transactions` table indexes
- `drizzle/` — new migration for the added index

**Integration points:** the route's `GET` handler is the single entry point consumers hit; the AI tool's `listTransactionsHandler` is the only current consumer, calling it through `apiGet`. Both must accept the same new optional query params (`page`, `limit`) and both schemas independently redeclare `from`/`to`, while `type`/`categoryId` on `ListTransactionsInput` already reuse `TransactionListQuery.shape.*` — a fix to the shared schema's field definitions therefore also fixes the AI tool for those two fields.

**Existing conventions to follow:**

- Query/body validation always goes through `parseQuery`/`parseBody` (`src/lib/api/http.ts:51-71`), which turn a Zod failure into a `ValidationError` → 400 response. No hand-rolled validation in route handlers.
- Repository functions take `(userId, filters)` and return plain Drizzle rows; the service layer is a thin passthrough (`src/lib/services/transactions.ts:49-51`) that adds business rules only where needed (none apply to listing).
- `apiHandler` (`src/lib/api/http.ts:34-49`) decides the response envelope by inspecting the handler's return value — currently `Array.isArray(result)` → `{ data, meta: { count } }`, else `{ data: result }`. This inspection point is the natural place to add a paginated-envelope case without touching the other two branches or any other route.
- AI tool input schemas (`src/lib/ai/tools/transactions.ts`) reuse pieces of the HTTP query schema via `TransactionListQuery.shape.X?.meta({ description })` rather than redefining validation rules — new fields should follow the same reuse pattern.
- `toDollars()` (`src/lib/ai/tools/client.ts:43-45`) is applied to every transaction row before it's returned to the LLM; this stays unchanged, just applied to the rows inside the new paginated shape.

**Reusable code and utilities:** `parseQuery`, `apiHandler`, the existing `and(...)`/`gte`/`lte`/`eq` filter-condition builder in `listTransactions` (repository), and the `TransactionListQuery.shape.*` reuse pattern in the AI tool schema.

**Test setup:** Vitest via `vp test`. Repository tests (`src/lib/repositories/__tests__/transactions.test.ts`) spin up a real in-memory SQLite DB (`db-helper.ts`) and seed rows directly — this is where pagination/ordering/filter-combination behavior should be tested end-to-end against real SQL. Service tests (`src/lib/services/__tests__/transactions.test.ts`) mock the repository module and test passthrough/business-rule behavior in isolation. No route-level HTTP tests exist today for transactions; none are being introduced by this plan (schema-level null/empty-handling is covered by unit tests on the schema itself).

## 3. Tech Stack

_(brownfield — existing stack, recorded as constraints)_

| Layer       | Decision                             | Version                            | Notes                                                                         |
| ----------- | ------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------- |
| Framework   | TanStack Start file-based API routes | `latest` (`@tanstack/react-start`) | `GET` handler stays a `server.handlers.GET` on the existing route file        |
| Validation  | Zod                                  | ^4.4.3                             | `.meta()` usage confirms Zod 4; new schema code must stay Zod-4-compatible    |
| ORM         | Drizzle ORM                          | ^0.45.2                            | `.limit()`/`.offset()`/`.orderBy()` query builder methods used for pagination |
| Database    | Cloudflare D1 (SQLite)               | —                                  | No window functions relied upon; count uses a separate query (see §9)         |
| Migrations  | Drizzle Kit                          | ^0.31.10                           | `pnpm run db:generate` then `db:migrate:local`/`db:migrate:remote`            |
| Test runner | Vitest (via `vp test`)               | —                                  | In-memory `better-sqlite3` for repository tests                               |

## 4. Data Models

This expands spec §5's "Page" concept and the existing `Transaction` entity's pagination-relevant fields.

### ListFilters _(existing type, unchanged)_

| Field      | Type                  | Required | Notes                           |
| ---------- | --------------------- | -------- | ------------------------------- |
| from       | Date                  | No       | inclusive lower bound on `date` |
| to         | Date                  | No       | inclusive upper bound on `date` |
| type       | Enum(expense, income) | No       | exact match                     |
| categoryId | string                | No       | exact match on `category_id`    |

### Pagination _(new)_

| Field | Type    | Required | Constraints     | Notes                       |
| ----- | ------- | -------- | --------------- | --------------------------- |
| page  | integer | No       | ≥ 1             | Defaults to 1 when omitted  |
| limit | integer | No       | 1–100 inclusive | Defaults to 20 when omitted |

**Domain invariants:**

- `page`/`limit` are resolved to their defaults at the route handler (the sole place defaults are applied), not baked into the Zod schema as defaults — this keeps the schema's shape (all fields genuinely optional/absent) accurate for the AI tool's generated description, and keeps default-application in one place. The service and repository layers always receive already-resolved values; they carry no default of their own.
- A value violating the stated constraints (e.g. `limit=500`, `page=0`) is a **validation error (400)**, not silently clamped — consistent with how every other out-of-range Zod-validated field in this codebase already behaves.
- Ordering is fixed to `created_at desc` for this iteration; no `sortBy`/`sortDir` param is introduced (per spec — configurable sort was explicitly not chosen).

### PaginatedListResult\<T\> _(new — repository/service return shape)_

| Field | Type    | Notes                                                         |
| ----- | ------- | ------------------------------------------------------------- |
| rows  | T[]     | The page's rows, already filtered and ordered                 |
| total | integer | Total count of rows matching the filters, ignoring pagination |

`page`, `limit`, and `hasMore` are derived by the caller (route handler) from `{ rows, total }` plus the resolved pagination inputs — they aren't stored redundantly on this type.

### Response envelope addition (`GET /api/transactions`)

| Field        | Type          | Notes                                |
| ------------ | ------------- | ------------------------------------ |
| data         | Transaction[] | unchanged — the page's rows          |
| meta.count   | integer       | unchanged — `data.length`            |
| meta.page    | integer       | resolved page number                 |
| meta.limit   | integer       | resolved page size                   |
| meta.total   | integer       | total matching rows across all pages |
| meta.hasMore | boolean       | `page * limit < total`               |

## 5. Database Schema Design

### transactions _(diff only — table already exists)_

**New index:**

- `transactions_user_id_created_at_idx` on `(user_id, created_at)` — reason: the new default sort (`created_at desc`, scoped per user) would otherwise force an in-memory sort on every list call as a user's row count grows; mirrors the existing `transactions_user_id_date_idx` pattern already in the schema for the `date` column.

No other columns, constraints, or tables change.

## 6. API Surface

| Method | Path              | Auth | Description                                                  | Stories                                |
| ------ | ----------------- | ---- | ------------------------------------------------------------ | -------------------------------------- |
| GET    | /api/transactions | Yes  | List the current user's transactions, filtered and paginated | US-001, US-002, US-003, US-004, US-005 |

### Key Request / Response Contracts

**GET /api/transactions**

```
Query (all optional):
  from: ISO date string | "" | omitted        (empty string / omitted / null-equivalent → not applied)
  to: ISO date string | "" | omitted
  type: "expense" | "income" | omitted
  categoryId: string | omitted
  page: positive integer, default 1
  limit: positive integer 1-100, default 20

Response: {
  data: Transaction[],
  meta: { count: number, page: number, limit: number, total: number, hasMore: boolean }
}
Errors: 400 Validation failed (bad enum, non-positive page, limit out of 1-100 range) | 401 Unauthorized
```

**Chat tool: `list_transactions`**

Input gains the same `page`/`limit` fields as the HTTP query, reused from the same schema shapes as `type`/`categoryId` already are. Output changes from a bare `Transaction[]` to an object carrying pagination metadata, so the LLM can decide whether to request another page:

```
Input:  { from?, to?, type?, categoryId?, page?, limit? }   (all optional; null tolerated on every field, empty-string tolerated on from/to/type/categoryId)
Output: { transactions: Transaction[], page: number, limit: number, total: number, hasMore: boolean }
```

This requires the AI-tool fetch layer to stop discarding the HTTP response's `meta` for this one call (see §9, "AI tool must see pagination metadata").

## 7. Technical Decisions

### Null/empty-safe optional filters

**Decision:** Wrap `from`, `to`, `type`, `categoryId` in both `TransactionListQuery` and `ListTransactionsInput` with a preprocessing step that treats `null` and `""` as "not provided" (coerced to `undefined`) before the underlying type/enum validation runs. `page`/`limit` get the same `null`-as-absent treatment (via the same `nullishAsAbsent` helper) on `ListTransactionsInput` — an LLM sending `page: null` must fall back to the default rather than fail validation, the same crash class this feature exists to fix. `""` is not a meaningful empty representation for a number and is not specifically accommodated for `page`/`limit`.
**Alternatives considered:** Making the fields `.nullable()` instead, and handling `null` further downstream in the repository.
**Rationale:** The crash happens at Zod validation time, before any downstream code runs — the fix has to live at the schema boundary. Preprocessing to `undefined` means every downstream consumer (repository `ListFilters`, the AI tool's own logic) keeps treating "not provided" as the one and only absence case, instead of every layer needing to separately handle three possible "empty" representations (`undefined`, `null`, `""`). Extending this to `page`/`limit` keeps every optional field on `ListTransactionsInput` uniformly null-safe instead of leaving two fields as an exception the LLM could still crash on.
**Tradeoffs accepted:** A user who deliberately wants to query for a literal empty-string category id (not a real use case here) can no longer do so — acceptable since `categoryId` is always a real ID or absent.

### Two-argument repository signature: filters + pagination

**Decision:** `listTransactions(userId, filters: ListFilters, pagination: Pagination) → Promise<PaginatedListResult<TransactionRow>>`, keeping `ListFilters` and the new `Pagination` type as separate parameters rather than merging pagination fields into `ListFilters`.
**Alternatives considered:** Adding `page`/`limit` directly onto `ListFilters`.
**Rationale:** Filters and pagination are orthogonal concerns (spec §5 already models "Page" as a distinct concept from the `Transaction`/filter domain) — keeping them separate parameters makes the repository function's contract self-documenting and avoids conflating "what rows match" with "which slice of them."
**Tradeoffs accepted:** Every call site now passes two arguments instead of one; there's exactly one call site today (the service passthrough) so this cost is negligible.

### Paginated envelope detection in `apiHandler`

**Decision:** `apiHandler` gains a third branch: if the handler's return value is a plain object already shaped like `{ data, meta }` (i.e., a route builds the paginated envelope itself before returning), pass it through unchanged; otherwise keep today's `Array.isArray` / plain-object fallback behavior exactly as-is.
**Alternatives considered:** Bypassing `apiHandler` entirely for this one route and constructing the `Response` manually; changing `apiHandler`'s array branch to always look for pagination metadata.
**Rationale:** This is additive and touches zero behavior for every other route (`categories`, `recurring-templates`, single-transaction routes) that still return bare arrays or single objects — none of those happen to already return an object with both `data` and `meta` keys, so there's no collision. Keeping `apiHandler`'s try/catch and error-mapping means the paginated route doesn't lose that behavior by constructing its own `Response`.
**Tradeoffs accepted:** `apiHandler`'s envelope-detection logic gains one more case to reason about; acceptable given it stays a small, well-tested pure function.

### Two-query pagination (data + count)

**Decision:** Fetch the page's rows with `.limit()/.offset()/.orderBy(created_at desc)` and fetch `total` with a separate `count(*)` query sharing the same filter conditions, rather than a single query with a window function.
**Alternatives considered:** A single query using a SQL window function (`COUNT(*) OVER()`) to get rows and total together.
**Rationale:** D1/SQLite window-function support is inconsistent enough across environments that a plain, portable `count(*)` is the safer default for a first pagination implementation with no existing precedent in this codebase.
**Tradeoffs accepted:** Two round trips per list call instead of one — acceptable at this app's expected per-user data volumes; revisit if profiling later shows it's a bottleneck.

### AI tool must see pagination metadata

**Decision:** Add a dedicated fetch helper (alongside `apiGet`) that returns both `data` and `meta` from a GET response instead of discarding `meta`, used only by `listTransactionsHandler`; every other `apiGet` call site is untouched.
**Alternatives considered:** Changing `apiGet`'s generic return type to always include `meta`, requiring every existing caller to be updated to destructure `.data`.
**Rationale:** The whole point of exposing `page`/`limit` as chat-tool input (per the resolved open question) is so the LLM can decide whether to ask for another page — that's only possible if the tool's output tells it `hasMore`/`total`. Scoping the fetch-layer change to one new helper avoids touching every other AI tool handler.
**Tradeoffs accepted:** Two slightly different GET helpers now exist in `src/lib/ai/fetch.ts` (one meta-preserving, one not) — acceptable given only one call site needs the metadata today.

## Changelog

### v1.1 — 2026-07-13

- Corrected §4 "Domain invariants": defaults for `page`/`limit` resolve at the route handler only, not the service layer (matches what tasks.md us002-05 actually specified and what was built) — the service's own default parameter value is redundant and being removed as part of this revision.
- Extended the "Null/empty-safe optional filters" technical decision (§7) to cover `page`/`limit` on `ListTransactionsInput`, per spec.md v1.1's expanded US-005.

## 8. Open Questions & Risks

- [ ] **Migration rollout:** the new `(user_id, created_at)` index needs `pnpm run db:generate` followed by `db:migrate:local`/`db:migrate:remote` — confirm who runs the remote migration and when, since this plan doesn't cover deployment sequencing.
- [ ] **Risk — existing rows' `created_at` ties:** rows created via CSV import or backfill could share identical `created_at` timestamps (millisecond resolution should make this rare in practice, but isn't impossible), which could make page boundaries unstable for those rows. Low likelihood given `created_at` includes sub-second precision; not mitigated further in this plan unless it surfaces in testing.

---

_Spec: [./spec.md](./spec.md) | Mode: brownfield_
