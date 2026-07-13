# Tasks: Transactions List Pagination & Optional Filters

**Spec:** [./spec.md](./spec.md) (v1.1) | **Plan:** [./plan.md](./plan.md) (v1.1)
**Generated:** 2026-07-12 (updated 2026-07-13 per /revise v1.1)
**Total tasks:** 10

---

## Tasks (in execution order)

### 1. [infra-01] Add database migration for transactions_user_id_created_at_idx index

**Status:** Done | **Depends on:** None | **Complexity:** S

Generate and create a Drizzle migration that adds a composite index on `(user_id, created_at)` to the existing `transactions` table. This index enables efficient sorting and filtering by creation date per user without in-memory sort as a user's transaction history grows. The index mirrors the existing `transactions_user_id_date_idx` pattern already in the schema.

**Acceptance Criteria:**

- [ ] Migration file exists in `drizzle/` directory
- [ ] Migration adds `transactions_user_id_created_at_idx` index on `(user_id, created_at)`
- [ ] Migrations can be run locally without errors

---

### 2. [us001-01] Add null/empty preprocessing to TransactionListQuery schema

**Status:** Done | **Depends on:** None | **Complexity:** M | **Story:** US-001, US-005

Update the `TransactionListQuery` Zod schema in `src/lib/schemas/transactions.ts` to preprocess `from`, `to`, `type`, and `categoryId` fields, treating `null` and empty string (`""`) as "not provided" (coerced to `undefined`) before any downstream validation. This is the root fix for the validation crash when the LLM chat assistant sends `null` for unset filters. Include unit tests validating that null and empty-string inputs are normalized before schema validation.

**Constraints:** Use context7 MCP to fetch Zod 4.x preprocessing documentation (do not read node_modules/zod).

**Acceptance Criteria:**

- [ ] `from`, `to`, `type`, `categoryId` fields preprocess `null` and `""` to `undefined`
- [ ] Schema validation passes for queries with null or empty-string filter values
- [ ] Schema validation still rejects invalid enums (e.g. `type: "invalid"`) and malformed dates
- [ ] Unit tests confirm null/empty-string values are treated as "filter not applied"

**Tests:**

- **Given** `from: null`, **When** query is validated, **Then** field is treated as undefined/absent
- **Given** `categoryId: ""`, **When** query is validated, **Then** field is treated as undefined/absent
- **Given** `type: "invalid"`, **When** query is validated, **Then** validation fails with error

---

### 3. [us001-02] Add page/limit and null-safe from/to to ListTransactionsInput AI tool schema

**Status:** Done | **Depends on:** us001-01 | **Complexity:** S | **Story:** US-001, US-002, US-005

`page` and `limit` already exist on `ListTransactionsInput` in `src/lib/ai/tools/transactions.ts` (plain `z.number().int()...optional()`), and `from`/`to` are already wrapped in `nullishAsAbsent`. The remaining gap: wrap `page` and `limit` in the same exported `nullishAsAbsent` helper (from `src/lib/schemas/transactions.ts`) so `null` on either field normalizes to `undefined` instead of failing validation — matching spec.md v1.1's expanded US-005 criterion. `""` is not a meaningful empty value for a number and does not need special handling here.

**Acceptance Criteria:**

- [ ] `page` and `limit` preprocess `null` to `undefined` (via `nullishAsAbsent`)
- [ ] `page`/`limit` still reject genuinely invalid values (e.g. `page: 0`, `page: -1`, `limit: 500`, non-numeric strings)
- [ ] `page`/`limit` still default to 1/20 in documentation via `.meta()` (unchanged from current state)
- [ ] Tool schema still generates a valid tool definition for Claude (construction doesn't throw)

**Tests:**

- **Given** `{ page: null, limit: null }`, **When** AI tool input is validated, **Then** tool accepts it (fields treated as absent)
- **Given** `{ page: 0 }` or `{ limit: 500 }`, **When** validated, **Then** validation still fails

---

### 4. [us002-01] Define Pagination and PaginatedListResult types

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** US-002

Create or update type definitions in `src/lib/schemas/transactions.ts` (or a shared types file) for:

1. `Pagination`: contains resolved `page` (number ≥ 1, default 1) and `limit` (number 1–100, default 20)
2. `PaginatedListResult<T>`: a generic response envelope with `rows: T[]` and `total: number` (total count of rows matching filters, ignoring pagination)

These types are the contract between the repository/service layer and the API route handler. They are implementation details not exposed directly to HTTP callers (the route builds the response envelope with additional derived fields: `hasMore`, `page`, `limit`).

**Acceptance Criteria:**

- [ ] `Pagination` type is defined with `page` and `limit` fields
- [ ] `PaginatedListResult<T>` is a generic type with `rows` and `total` fields
- [ ] Types are exported and available for import in repository and service modules

**Tests:**

- **Given** the types exist, **When** instantiated with sample data, **Then** TypeScript compilation succeeds

---

### 5. [us002-02] Update listTransactions repository with pagination and ordering

**Status:** Done | **Depends on:** us002-01 | **Complexity:** M | **Story:** US-002, US-004

Update the `listTransactions` function in `src/lib/repositories/transactions.ts` to:

1. Accept a new third parameter: `pagination: Pagination`
2. Apply `.offset((page - 1) * limit).limit(limit).orderBy(transactions.created_at, 'desc')` to the query builder (fixed ordering)
3. Fetch the paginated rows
4. Fetch a separate `count(*)` query sharing the same filter conditions to get the total
5. Return `{ rows, total }` as a `PaginatedListResult<TransactionRow>`

The existing filter-building logic (and/gte/lte/eq conditions) is unchanged. The default sort is by `created_at` descending (most recently created first), ensuring stable, predictable ordering across page requests. Validation of `page ≥ 1` and `1 ≤ limit ≤ 100` happens at the schema layer, not here.

**Constraints:** Use context7 MCP to fetch Drizzle `.limit()`, `.offset()`, `.orderBy()` and count queries documentation. Do not read node_modules/drizzle-orm.

**Acceptance Criteria:**

- [ ] Repository function signature changed to `(userId, filters, pagination) → Promise<PaginatedListResult<TransactionRow>>`
- [ ] Returned rows are ordered by `created_at desc`
- [ ] Total count is fetched and returned separately from the paginated rows
- [ ] Pagination parameters are applied correctly (offset = (page - 1) \* limit)
- [ ] Unit tests pass for pagination (page 1, page 2, out-of-range page) with various filter combinations
- [ ] Ordering is stable across repeated requests with the same filters

**Tests:**

- **Given** a user with 50 transactions and `limit=20`, **When** fetching `page=1`, **Then** receive 20 rows and `total=50`
- **Given** the same user and `page=3`, **When** fetching with `limit=20`, **Then** receive empty rows and `total=50` (out-of-bounds page)
- **Given** filtering by category with results, **When** paginating, **Then** `total` reflects only filtered rows
- **Given** the same query twice, **When** comparing page 1 results, **Then** rows are identical (ordering is stable)

---

### 6. [us002-03] Update listTransactions service layer

**Status:** Done | **Depends on:** us002-02 | **Complexity:** S | **Story:** US-002

`listTransactions` in `src/lib/services/transactions.ts` already passes `(userId, filters, pagination)` through to the repository unchanged and returns `PaginatedListResult<TransactionRow>`. The remaining gap: remove the `pagination: Pagination = { page: 1, limit: 20 }` default parameter value, making `pagination` a required parameter — per plan.md v1.1, the route handler is the sole place defaults are resolved, and a second default on the service is redundant and a future drift risk (defaults could get out of sync between the two layers).

**Acceptance Criteria:**

- [ ] `pagination` parameter has no default value (required, not `= { page: 1, limit: 20 }`)
- [ ] Calling the service without a third argument now fails to typecheck (confirms the default is truly gone)
- [ ] All existing call sites (the route handler) already pass an explicit `{ page, limit }`, so no other code needs updating
- [ ] Service tests still pass

**Tests:**

- **Given** the service is called with `(userId, filters, { page, limit })`, **When** invoked, **Then** it passes through to the repository unchanged (existing test, unaffected)
- **Given** TypeScript compiles the call site in `src/routes/api/transactions/index.ts`, **When** `vp check` runs, **Then** no type error (confirms the one real call site already supplies pagination explicitly)

---

### 7. [us002-04] Add paginated envelope detection to apiHandler

**Status:** Done | **Depends on:** us002-01 | **Complexity:** S | **Story:** US-002

Update the `apiHandler` function in `src/lib/api/http.ts` to add a third detection branch: if the handler's return value is an object with both `data` and `meta` fields already set (i.e., `{ data, meta: { ... } }`), pass it through unchanged. This preserves the current behavior for array returns and plain-object returns while enabling the paginated transactions route to build its own envelope before returning.

**Acceptance Criteria:**

- [ ] `apiHandler` detects and preserves paginated envelope shape `{ data, meta }`
- [ ] Existing routes (categories, recurring-templates, single-transaction) unchanged (their return shapes do not collide with this detection)
- [ ] Error handling (`try/catch`) still applies to the paginated envelope case

**Tests:**

- **Given** handler returns `{ data: [...], meta: { count: 5, page: 1, ... } }`, **When** `apiHandler` processes it, **Then** envelope is returned as-is
- **Given** handler returns `[...]` (array), **When** `apiHandler` processes it, **Then** array branch behavior unchanged

---

### 8. [us002-05] Update GET /api/transactions route handler

**Status:** Done | **Depends on:** us002-03, us002-04 | **Complexity:** M | **Story:** US-002, US-003

Update the `GET` handler in `src/routes/api/transactions/index.ts` to:

1. Parse query params using the existing `parseQuery(request, TransactionListQuery)` pattern
2. Extract and resolve pagination: `page = query.page ?? 1`, `limit = query.limit ?? 20`
3. Call the service with both filters and pagination: `await listTransactions(userId, filters, { page, limit })`
4. Build the response envelope with pagination metadata:
   ```
   { data: rows, meta: { count: rows.length, page, limit, total, hasMore: page * limit < total } }
   ```
5. Return this envelope (which `apiHandler` detects and passes through)

The route is the only place where default values for `page`/`limit` are applied; the Zod schema keeps them as genuinely optional fields (no defaults in `.default()`) to maintain accurate tool documentation.

**Acceptance Criteria:**

- [ ] Query params are parsed with `parseQuery(request, TransactionListQuery)`
- [ ] Pagination defaults are applied: `page` → 1, `limit` → 20
- [ ] Pagination is passed to the service alongside filters
- [ ] Response envelope includes all pagination fields: `page`, `limit`, `total`, `hasMore`, `count`
- [ ] Out-of-bounds page requests return an empty data array with correct metadata, not an error
- [ ] Response is JSON-serializable without errors

**Tests:**

- **Given** request with no pagination params, **When** route handler executes, **Then** defaults `page=1, limit=20` and returns `count=min(20, actual_rows)`
- **Given** request with `page=2&limit=10` and a user with 25 transactions, **When** executed, **Then** returns rows 11–20 with `hasMore=true`
- **Given** request with `page=100&limit=10`, **When** user has only 25 transactions, **Then** returns empty data array with `hasMore=false`
- **Given** request with filters + pagination, **When** executed, **Then** response includes `total` (filtered count) and `hasMore` reflects filtered total

---

### 9. [us002-06] Create metadata-preserving fetch helper for AI tool layer

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** US-002

Create a new fetch helper function in `src/lib/ai/fetch.ts` alongside the existing `apiGet` that returns both `data` and `meta` from a GET response, rather than discarding `meta` like `apiGet` does today. This helper (e.g., `apiGetWithMeta`) is used only by `listTransactionsHandler` and preserves the response's pagination metadata so the LLM can read `hasMore` and decide whether to request another page.

**Acceptance Criteria:**

- [ ] New function `apiGetWithMeta` (or similar) exists in `src/lib/ai/fetch.ts`
- [ ] Function accepts a URL and returns `{ data, meta }` from the HTTP response
- [ ] Existing `apiGet` is unchanged (other AI tool handlers continue to work as before)
- [ ] Function handles errors the same way `apiGet` does

**Tests:**

- **Given** fetch returns `{ data: [...], meta: { ... } }`, **When** `apiGetWithMeta` is called, **Then** both `data` and `meta` are returned

---

### 10. [us002-07] Update listTransactionsDef output schema and listTransactionsHandler to return paginated output

**Status:** Done | **Depends on:** us002-06 | **Complexity:** S | **Story:** US-002

Update two coupled pieces so the tool's declared contract matches what the handler actually returns:

1. In `src/lib/ai/tools/transactions.ts`, define a new `ListTransactionsOutput` Zod schema — `{ transactions: TransactionRow[], page: number, limit: number, total: number, hasMore: boolean }` — and set it as `listTransactionsDef`'s `outputSchema`, replacing the current bare `z.array(TransactionRow)`.
2. In `src/lib/ai/tools/client.ts`, update `listTransactionsHandler` to:
   - Use the new `apiGetWithMeta` fetch helper instead of `apiGet` when calling `GET /api/transactions`
   - Apply `toDollars()` to each transaction row in the returned data (existing behavior, unchanged)
   - Return an object matching `ListTransactionsOutput`: `{ transactions: rows, page, limit, total, hasMore }`

This output format allows the LLM to see pagination metadata and decide whether to call `list_transactions` again for the next page. Keep `TransactionRow`'s existing shape unchanged — only the top-level tool output shape changes.

**Acceptance Criteria:**

- [ ] `ListTransactionsOutput` schema is defined and used as `listTransactionsDef.outputSchema`
- [ ] Handler uses `apiGetWithMeta` to fetch transactions
- [ ] `toDollars()` is still applied to each row
- [ ] Handler returns `{ transactions, page, limit, total, hasMore }` object matching `ListTransactionsOutput` (not a bare array)
- [ ] Existing `ListTransactionsInput` tool schema is compatible with the new output format
- [ ] Tool definition (`listTransactionsDef`) still constructs successfully with the new output schema

**Tests:**

- **Given** service returns paginated results, **When** handler executes, **Then** LLM receives `{ transactions: [...], page: 1, limit: 20, total: 50, hasMore: true }`
- **Given** handler calls tool with `page: 2`, **When** results come back, **Then** LLM sees `page: 2` in output
- **Given** the handler's return value, **When** validated against `ListTransactionsOutput`, **Then** validation succeeds

---

## Story Coverage

| Story  | Priority    | Tasks                                                                | Coverage |
| ------ | ----------- | -------------------------------------------------------------------- | -------- |
| US-001 | Must Have   | us001-01, us001-02                                                   | ✓ Full   |
| US-002 | Must Have   | us002-01, us002-02, us002-03, us002-04, us002-05, us002-06, us002-07 | ✓ Full   |
| US-003 | Must Have   | us002-02, us002-05                                                   | ✓ Full   |
| US-004 | Must Have   | infra-01, us002-02                                                   | ✓ Full   |
| US-005 | Should Have | us001-01, us001-02                                                   | ✓ Full   |
