# Tasks: Recurring Template Scheduled Materialization

**Spec:** [./spec.md](./spec.md) (v1.0) | **Plan:** [./plan.md](./plan.md) (v1.0)
**Generated:** 2026-07-13
**Total tasks:** 8

---

## Tasks (in execution order)

### 1. [infra-01] Create database migration for recurring materialization indexes

**Status:** Done | **Depends on:** None | **Complexity:** S | **Stories:** US-001

Create a new Drizzle migration file that adds two indexes to support the scheduled materialization query and constraint.

**Acceptance Criteria:**

- [ ] Migration file created via `vp run db:generate`
- [ ] Partial unique index on `transactions(recurring_template_id, date)` with condition `WHERE recurring_template_id IS NOT NULL` is defined
- [ ] Composite index on `recurring_templates(status, next_due_date)` is defined
- [ ] Migration is deployable and can be applied via `vp run db:migrate:local` and `vp run db:migrate:remote`
- [ ] Index names follow existing convention: `transactions_recurring_template_due_unique` and `recurring_templates_status_next_due_date_idx`

**Tests:**

- **Given** an empty DB with migrated schema, **When** the migration is applied, **Then** both indexes exist and queries can use them

---

### 2. [us001-01] Implement cross-user repository query for due recurring templates

**Status:** Done | **Depends on:** infra-01 | **Complexity:** S | **Stories:** US-001

Add a new repository function in `src/lib/repositories/recurring-templates.ts` that queries all active templates with `next_due_date <= now` across all users (no user_id filter). This query drives the scheduled sweep.

**Acceptance Criteria:**

- [x] New function `listAllDueTemplates(now: Date): Promise<RecurringTemplate[]>` is exported from recurring-templates repository (renamed from the originally-specified `listDueTemplates(now)` — that name was already taken by the pre-existing per-user `listDueTemplates(userId, now)`; see plan.md v1.1 changelog)
- [x] Query filters by `status = 'active' AND next_due_date <= now` with no `user_id` predicate
- [x] Results include all fields needed by the service layer: `id`, `user_id`, `status`, `next_due_date`, `last_insertion_date`, `end_date`, `cadence`, `amount`, `category_id`, `description`
- [x] Query uses the composite index `recurring_templates_status_next_due_date_idx` — verified via an `EXPLAIN QUERY PLAN` assertion added at revision time (`src/lib/repositories/__tests__/recurring-templates.test.ts › uses the recurring_templates_status_next_due_date_idx composite index`)
- [x] Returns empty array when no templates match
- [x] ~~A `buildDueTemplatesQuery` variant exists for use inside `runBatch`~~ — **removed at revision time**: the sweep query is a plain read, never part of an atomic `runBatch` write, so the build-variant had no caller and shipped as dead code; deleted rather than kept (see plan.md v1.1 changelog)

**Tests:**

- **Given** multiple templates across multiple users with various statuses and due dates, **When** listing due templates for a specific timestamp, **Then** only active templates with `next_due_date <= now` are returned, regardless of user_id
- **Given** no due templates, **When** listing, **Then** empty array is returned

---

### 3. [us001-02] Implement service sweep function with catch-up loop and failure isolation

**Status:** Done | **Depends on:** us001-01 | **Complexity:** M | **Stories:** US-001, US-002, US-003

**Design decision recorded:** Option B — refactored `processDueRecurring` to delegate to a shared internal `processTemplateOccurrences(tpl, now)` helper also used by `runScheduledMaterialization`, rather than deleting it. Verified against its existing tests first (none assert single-occurrence-only behavior). Note: `processDueRecurring` now also gains failure isolation and duplicate-constraint handling it didn't have before — a behavior change, but safe since it has no production caller.

Add a new service function `runScheduledMaterialization(now: Date)` in `src/lib/services/recurring-templates.ts` that sweeps all due templates, creates catch-up transactions, and handles errors per-template. This is the core business logic.

**Acceptance Criteria:**

- [ ] New function signature: `runScheduledMaterialization(now: Date): Promise<{ processedTemplates: number; occurrencesCreated: number; failedTemplates: number }>`
- [ ] For each due template from the repository:
  - [ ] Loop: while `next_due_date <= now` and `status === 'active'`:
    - [ ] Create one transaction dated to the current `next_due_date` (using existing `buildInsertTransaction`)
    - [ ] Advance the template's `next_due_date` (using existing `advanceDueDate`)
    - [ ] If `next_due_date` exceeds `end_date`, mark template `status = 'completed'` (existing behavior)
    - [ ] Use `runBatch` to atomically insert transaction + update template
  - [ ] On any error during materialization of a given template:
    - [ ] Mark that template's `status = 'failed'`
    - [ ] Do NOT re-throw; continue to next template
  - [ ] On DB unique constraint violation (duplicate `(recurring_template_id, date)`):
    - [ ] Treat as "already handled" (not an error)
    - [ ] Advance `next_due_date` as if the transaction had been created
    - [ ] Do NOT mark template failed
- [ ] Return aggregate counts: `processedTemplates` (total iterated), `occurrencesCreated` (transactions inserted), `failedTemplates` (marked failed)
- [ ] Reuse existing utilities: `advanceDueDate`, `computeNextDue`, `buildInsertTransaction`, `buildUpdateTemplate`, `runBatch`

**Design Decision Flag:**

- [ ] **DECISION:** The existing `processDueRecurring` function (per-user, single-occurrence materialization) becomes redundant after this task. Decide whether to:
  - **Option A:** Delete `processDueRecurring` entirely (it has no production callers; only tests use it)
  - **Option B:** Refactor `processDueRecurring` to call a shared catch-up loop function, eliminating code duplication
  - Document your decision in the commit message and update comments in the code to reflect the chosen path.

**Tests:**

- **Given** a single due template, **When** running the sweep, **Then** one transaction is created dated to `next_due_date` and the template's `next_due_date` is advanced
- **Given** a template with N missed occurrences (e.g., `next_due_date` is 3 days old, cadence is daily), **When** running the sweep, **Then** N transactions are created, each dated to its own original due date, and the template is caught up
- **Given** a template that would exceed its `end_date` during catch-up, **When** running the sweep, **Then** transactions are created only up to the last valid occurrence and the template becomes `completed`
- **Given** a template whose materialization throws an error (e.g., category was deleted), **When** running the sweep, **Then** the template is marked `status = 'failed'`, the error does not stop processing of other templates, and other templates in the same run complete normally
- **Given** a DB constraint violation on `(recurring_template_id, date)` (duplicate occurrence), **When** running the sweep, **Then** the transaction is not created, `next_due_date` still advances, and the template is not marked failed
- **Given** multiple templates across multiple users, some with errors, **When** running the sweep, **Then** counts returned are accurate and failed templates are isolated from successful ones

---

### 4. [us001-03] Implement materialize-recurring job module

**Status:** Done | **Depends on:** us001-02 | **Complexity:** S | **Stories:** US-001

Create a new `src/lib/jobs/materialize-recurring.ts` module that exports the `scheduled()` callback logic for the cron trigger. This module wraps the service function and handles async completion.

**Acceptance Criteria:**

- [ ] New file `src/lib/jobs/materialize-recurring.ts` is created
- [ ] Export function `materializeRecurring(controller, env, ctx): Promise<void>`
- [ ] Extract `now` from `controller.scheduledTime`
- [ ] Call `runScheduledMaterialization(now)` from the recurring-templates service
- [ ] Log the returned counts (processedTemplates, occurrencesCreated, failedTemplates) for observability
- [ ] Wrap the async call with `ctx.waitUntil()` so the platform does not terminate the handler before D1 writes complete
- [ ] No branching logic; pure delegation to the service layer

**Tests:**

- **Given** a mock controller with scheduledTime, env, and ctx, **When** calling materializeRecurring, **Then** the service function is called with the correct timestamp and ctx.waitUntil wraps the promise

---

### 5. [us001-04] Implement server entry point with scheduled export

**Status:** Done | **Depends on:** us001-03 | **Complexity:** S | **Stories:** US-001

Create a new `src/server.ts` file that replaces the default TanStack Start server entry and delegates both `fetch` and `scheduled` exports to their respective handlers.

**Acceptance Criteria:**

- [ ] New file `src/server.ts` is created
- [ ] Import `createServerEntry` from `@tanstack/react-start/server-entry`
- [ ] Export `createServerEntry({ fetch: ..., scheduled: ... })`
- [ ] `fetch` handler is one-line delegation to the framework's default handler (existing behavior preserved)
- [ ] `scheduled` handler is one-line delegation to `materializeRecurring` from `src/lib/jobs/materialize-recurring.ts`
- [ ] No branching logic, error handling, or state management in `server.ts` itself; it is purely a pass-through

**Tests:**

- **Given** a fetch request, **When** server.ts receives it, **Then** the request is delegated to the framework handler and the response is returned unchanged
- **Given** a scheduled event from the cron trigger, **When** server.ts receives it, **Then** the event is delegated to materializeRecurring

---

### 6. [us001-05] Update wrangler.jsonc to repoint main and add cron trigger

**Status:** Done | **Depends on:** us001-04 | **Complexity:** S | **Stories:** US-001

Update the Cloudflare Workers configuration to use the new server entry point and enable the hourly cron trigger.

**Acceptance Criteria:**

- [ ] `wrangler.jsonc` `main` field is changed from `@tanstack/react-start/server-entry` to `./src/server.ts`
- [ ] `[triggers].crons` array is added with value `["0 * * * *"]` (hourly at minute 0)
- [ ] Build output contains the compiled `src/server.ts` and correctly references the job module
- [ ] No other fields in `wrangler.jsonc` are modified (preserve existing config)

**Tests:**

- **Given** the updated `wrangler.jsonc`, **When** building the project, **Then** the build succeeds and the output includes the scheduled handler
- **Given** the Workers runtime, **When** the cron trigger fires at the configured time, **Then** the scheduled handler is invoked

---

### 7. [us001-06] Test cross-user repository query for due templates

**Status:** Done | **Depends on:** us001-01 | **Complexity:** S | **Stories:** US-001 — coverage already fully satisfied by us001-01's tests, no additions needed

Add comprehensive tests for the new `listDueTemplates` repository function in `src/lib/repositories/__tests__/recurring-templates.test.ts`.

**Acceptance Criteria:**

- [ ] Test file exists at `src/lib/repositories/__tests__/recurring-templates.test.ts` (or is extended if it already exists)
- [ ] Test: query with multiple templates across multiple users at various statuses returns only active templates with `next_due_date <= now`
- [ ] Test: query returns empty array when no templates match criteria
- [ ] Test: query with multiple due templates across different users returns all matching templates (user_id is not filtered)
- [ ] Test: paused/completed/failed templates are excluded from results
- [ ] Test: templates with `next_due_date > now` are excluded
- [ ] All tests use in-memory better-sqlite3 DB migrated against real `drizzle/` schema (follow existing pattern via `db-helper.ts`)
- [ ] Tests run via `vp run test`

**Tests:**

- **Given** templates with various statuses and due dates across multiple users, **When** listing due templates at a specific time, **Then** only active templates with `next_due_date <= now` are returned

---

### 8. [us001-07] Test service sweep function, catch-up loop, failure isolation, and duplicate handling

**Status:** Done | **Depends on:** us001-02 | **Complexity:** M | **Stories:** US-001, US-002, US-003 — added a missing "no due occurrences" case plus a real-DB integration test proving the unique-index detection against a genuine constraint violation (not just a mocked error shape); also added a `.batch()` shim to `db-helper.ts` shared test infra since better-sqlite3 has no native batch.

Add comprehensive tests for the new `runScheduledMaterialization` service function in `src/lib/services/__tests__/recurring-templates.test.ts`.

**Acceptance Criteria:**

- [ ] Test file exists at `src/lib/services/__tests__/recurring-templates.test.ts` (or is extended if it already exists)
- [ ] Test: single due template materializes one transaction dated to `next_due_date` and advances the template
- [ ] Test: template with N missed occurrences (e.g., 3 days overdue on daily cadence) creates exactly N transactions, each dated to its original due date, oldest first
- [ ] Test: catch-up stops when reaching template's `end_date` and marks template `completed`
- [ ] Test: materialization error on one template marks it `status = 'failed'` without stopping processing of other templates
- [ ] Test: duplicate `(recurring_template_id, date)` constraint violation (via DB unique index) does not mark template failed, and `next_due_date` still advances
- [ ] Test: all counts returned are accurate: `processedTemplates`, `occurrencesCreated`, `failedTemplates`
- [ ] Test: template with no due occurrences (because `next_due_date > now`) is skipped
- [ ] All tests use in-memory better-sqlite3 DB migrated against real `drizzle/` schema
- [ ] Tests run via `vp run test`

**Tests:**

- **Given** a template 3 days overdue on daily cadence, **When** running the sweep, **Then** 3 transactions are created dated to each missed day
- **Given** a template whose materialization throws, **When** running the sweep, **Then** other templates complete and the error is not re-thrown
- **Given** a duplicate transaction already exists for the same occurrence, **When** running the sweep, **Then** the constraint violation is caught and treated as "already handled," not an error

---

### 9. [us001-08] Verify server.ts delegation preserves app SSR and routing

**Status:** Done | **Depends on:** us001-05 | **Complexity:** M | **Stories:** US-001 — added automated delegation unit test (src/**tests**/server.test.ts) plus manual dev-server curl verification (/, /login, API routes); route topology differs from the task's assumed paths (no public `/`, `/` is the one protected route) — mapped intent to actual routes, documented in the task's implementer report.

Integration test to verify that the new `server.ts` entry point correctly delegates the `fetch` handler to the framework and does not break SSR, routing, or existing HTTP endpoints.

**Acceptance Criteria:**

- [ ] Test file exists (e.g., `src/__tests__/server.test.ts` or similar) or verification is done via the running app
- [ ] The app starts without errors when using `server.ts` as the main entry point
- [ ] A request to `/` returns a 200 response with HTML content (SSR works)
- [ ] A request to `/login` returns a 200 response with the login page
- [ ] A request to a protected route (`/_protected/dashboard` or similar) returns 302 redirect to `/login` (auth check works)
- [ ] A request to an API endpoint (e.g., `/api/transactions`) returns a valid response (routing works)
- [ ] The scheduled handler is reachable and callable (manually trigger or observe in dev mode)
- [ ] No TypeScript or build errors; `vp check` and `vp build` pass

**Tests:**

- **Given** the app is running with `server.ts` as main, **When** making a fetch request to the root, **Then** a 200 response with HTML is received
- **Given** a protected route, **When** accessing it unauthenticated, **Then** a 302 redirect to login is returned
- **When** the cron trigger fires, **Then** the scheduled handler is invoked without breaking the concurrent fetch handler

---

## Story Coverage

| Story  | Priority  | Tasks                                                                                    | Coverage |
| ------ | --------- | ---------------------------------------------------------------------------------------- | -------- |
| US-001 | Must Have | infra-01, us001-01, us001-02, us001-03, us001-04, us001-05, us001-06, us001-07, us001-08 | ✓ Full   |
| US-002 | Must Have | us001-02, us001-07                                                                       | ✓ Full   |
| US-003 | Must Have | us001-02, us001-07                                                                       | ✓ Full   |

---

## Notes

- **Migration ordering risk (from plan §10):** The database schema migration (infra-01) must be deployed and applied in production _before_ the scheduled handler and service logic go live (us001-02 through us001-05). This ensures the unique index exists to prevent duplicate transactions in case of overlapping cron invocations.
- **Explicit decision point:** Task us001-02 includes a design decision about the now-redundant `processDueRecurring` function. The implementer must choose to either delete it or refactor it to share the catch-up loop logic, and document that choice in the commit.
- **No new infrastructure:** All tasks use existing Cloudflare Workers, D1, Drizzle, and TanStack Start infrastructure already in the codebase.
- **Reuse existing utilities:** Tasks reuse `advanceDueDate`, `computeNextDue`, `runBatch`, `buildInsertTransaction`, and `buildUpdateTemplate` from the existing codebase to avoid code duplication.
