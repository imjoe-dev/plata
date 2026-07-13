# Plan: Recurring Template Scheduled Materialization

**Spec:** [./spec.md](./spec.md)
**Mode:** brownfield
**Status:** Approved
**Created:** 2026-07-12
**Version:** 1.1

---

## 1. Overview

Add a Cloudflare Cron Trigger that fires hourly and sweeps every user's due recurring templates in one pass, reusing the existing `recurring_templates`/`transactions` schema and the existing per-template cadence math (`advanceDueDate`, `computeNextDue`). The approach: (a) a thin `src/server.ts` entry that adds a `scheduled()` export alongside the existing SSR `fetch` handler, delegating both to their real implementations rather than inlining logic; the actual cron logic lives in a new `src/lib/jobs/materialize-recurring.ts` module, (b) a new cross-user repository query and a service-layer sweep function that loops each due template until it's caught up (see spec §2, §US-002) and isolates per-template failures into `status = 'failed'` (see spec §US-003), and (c) a DB-level uniqueness guard so a re-invoked or overlapping run can never double-post a transaction for the same occurrence (see spec §7 Constraints).

## 2. Codebase Context

**Affected modules:**

- `src/db/schema.ts` — one new partial unique index on `transactions`, one new composite index on `recurring_templates`
- `src/lib/repositories/recurring-templates.ts` — new cross-user query, `listAllDueTemplates(now)` (kept distinct from the existing per-user `listDueTemplates(userId, now)` rather than overloading the same name)
- `src/lib/services/recurring-templates.ts` — new sweep function, refactor to extract shared per-template catch-up logic
- `src/server.ts` — **new file**, thin Workers entry point (pass-through only, no job logic)
- `src/lib/jobs/materialize-recurring.ts` — **new file**, the actual `scheduled()` callback logic
- `wrangler.jsonc` — repoint `main`, add `[triggers]`/`crons`
- `drizzle/` — one new migration

**Integration points:**

- `src/server.ts`'s `scheduled` export is a one-line delegation to `src/lib/jobs/materialize-recurring.ts`, which in turn calls straight into the existing service layer (`src/lib/services/recurring-templates.ts`) the same way route handlers do — no new architectural layer, and `server.ts` itself stays small enough that it needs no real logic testing beyond "does it delegate."
- `getDB()` (`src/db/index.ts`) reads `env` from the `cloudflare:workers` ambient import rather than a request-scoped binding, so it works identically inside a `scheduled()` handler with no plumbing changes.

**Existing conventions to follow:**

- Repository layer: raw Drizzle queries + `build*` query-builder variants for use inside `runBatch` (`@/lib/db/transaction`) — the new cross-user query follows the same `list*`/`build*` naming.
- Service layer: business logic + error mapping via `NotFoundError`/`InternalError` from `@/lib/errors`.
- Migrations generated via `vp run db:generate`, applied via `vp run db:migrate:local` / `db:migrate:remote`.
- Tests colocated in `__tests__/`, run via `vp run test`; repository tests spin up an in-memory better-sqlite3 DB migrated against the real `drizzle/` folder (`src/lib/repositories/__tests__/db-helper.ts`).

**Reusable code and utilities:**

- `advanceDueDate` / `computeNextDue` (`src/lib/services/recurring-templates.ts`) — cadence math, unchanged.
- `runBatch` (`@/lib/db/transaction`) — atomic multi-statement writes, reused for each occurrence's insert+update pair.
- `buildInsertTransaction` / `buildUpdateTemplate` — existing query builders, reused as-is.

**Test setup:** Vitest; new tests follow `src/lib/repositories/__tests__/recurring-templates.test.ts` and `src/lib/services/__tests__/recurring-templates.test.ts` patterns (in-memory D1-equivalent via better-sqlite3 + real migrations).

## 3. Tech Stack

_(existing stack, recorded as constraints — no new technology introduced)_

| Layer      | Decision                  | Notes                                                                                                                                                                              |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime    | Cloudflare Workers        | `scheduled()` export added to the existing Worker                                                                                                                                  |
| Scheduling | Cloudflare Cron Triggers  | `[triggers].crons` in `wrangler.jsonc`, hourly                                                                                                                                     |
| ORM / DB   | Drizzle ORM + D1 (SQLite) | Existing `recurring_templates`/`transactions` tables, extended with two indexes                                                                                                    |
| Framework  | TanStack Start            | Thin `src/server.ts` via `createServerEntry`, replaces the default `@tanstack/react-start/server-entry` as `main`; real job logic lives in `src/lib/jobs/materialize-recurring.ts` |

## 4. Data Models

Extends spec §5. No new entities — both existing entities gain enforcement of invariants already stated in the spec.

### RecurringTemplate

No field changes. Behavioral contract added:

- A new service function processes **all** occurrences a template has missed in one pass (not just the next one), stopping when `next_due_date > now` or `end_date` is reached.
- On any error while materializing one occurrence, the template is updated to `status: "failed"` and processing moves to the next template — it does not re-throw and does not halt the run.

### Transaction

No field changes. Invariant added:

- `(recurring_template_id, date)` is unique whenever `recurring_template_id` is not null — enforced at the database level (see §5), not just in application logic. This is what makes the run safe to invoke more than once for the same reference time (spec §8 NFR).

## 5. Database Schema Design

Diffs against the existing schema (`src/db/schema.ts`) — both are additive, no column changes, no data migration needed.

### `transactions` — add partial unique index

| Index                                        | Columns                         | Condition                                 | Reason                                                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transactions_recurring_template_due_unique` | `(recurring_template_id, date)` | `WHERE recurring_template_id IS NOT NULL` | Hard guarantee against double-posting the same occurrence if a scheduled run overlaps or is re-invoked (Workers `scheduled()` is at-least-once). Partial so it doesn't constrain manually-entered transactions, which have `recurring_template_id IS NULL`. |

### `recurring_templates` — add composite index

| Index                                          | Columns                   | Reason                                                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recurring_templates_status_next_due_date_idx` | `(status, next_due_date)` | The new cross-user sweep query filters by `status = 'active' AND next_due_date <= now` with no `user_id` predicate — the existing indexes are both `user_id`-prefixed and don't serve this access pattern. |

## 6. API Surface

No HTTP endpoints. The only new "surface" is the Workers `scheduled()` export, which is invoked by the Cloudflare platform on the configured cron schedule — not by a client.

| Trigger      | Schedule             | Description                                                          | Stories                |
| ------------ | -------------------- | -------------------------------------------------------------------- | ---------------------- |
| Cron Trigger | `0 * * * *` (hourly) | Sweeps and materializes all due recurring templates across all users | US-001, US-002, US-003 |

### Contracts

**`scheduled(controller, env, ctx)`** (Workers runtime callback, `src/server.ts`)

```
Input:  controller.scheduledTime (the run's reference "now")
Effect: one-line delegation to src/lib/jobs/materialize-recurring.ts — server.ts
        itself contains no job logic
Output: none (Workers scheduled handlers have no response body)
```

**`materializeRecurring(controller, env, ctx)`** (new, `src/lib/jobs/materialize-recurring.ts`)

```
Input:  the same (controller, env, ctx) passed through from server.ts
Effect: calls the service-layer sweep function; awaited via ctx.waitUntil so the
        platform doesn't terminate the invocation before D1 writes complete
Output: none — this is where the real logic and its tests live, kept out of
        server.ts entirely
```

**`runScheduledMaterialization(now: Date): Promise<{ processedTemplates: number; occurrencesCreated: number; failedTemplates: number }>`** (new, `src/lib/services/recurring-templates.ts`)

```
1. Fetch all active templates with next_due_date <= now, across all users
   (new repository function, no user_id filter)
2. For each template, independently:
   a. Loop: while next_due_date <= now and status still active —
      create one transaction dated to that occurrence's due date,
      advance next_due_date, and check end_date (-> completed if exceeded)
   b. On any error during (a): mark the template status = 'failed', stop
      processing that template, continue to the next one
3. Return aggregate counts for observability (logged by the caller)
```

## 7. Security Plan

Not applicable — no new user-facing surface, no new input from untrusted sources. The `scheduled()` handler is only ever invoked by the Cloudflare platform itself, not reachable via HTTP.

## 8. Concurrency & Load

**Expected load:** personal-finance-app scale (single-digit to low-hundreds of users, each with a handful of templates) — the hourly sweep is expected to complete in well under a second of D1 query/write time.

**Invocation guarantees:** Cloudflare Cron Triggers are at-least-once, not exactly-once — the design must (and does, via §5's unique index) tolerate the same reference hour being processed twice without side effects beyond the first successful pass.

**Isolation:** each template is processed independently (its own try/catch and its own `runBatch`); one template erroring out does not abort the templates processed before or after it in the same sweep (satisfies spec §8 NFR and US-003's acceptance criteria).

## 9. Technical Decisions

### Custom Workers entry point for the scheduled handler, kept thin

**Decision:** Add `src/server.ts` using `@tanstack/react-start/server-entry`'s `createServerEntry({ fetch, scheduled })`, and change `wrangler.jsonc`'s `main` from the package's built-in `@tanstack/react-start/server-entry` to `./src/server.ts`. Both exports are one-line delegations — `fetch` to the framework's default handler, `scheduled` to `src/lib/jobs/materialize-recurring.ts` — so `server.ts` itself contains no branching logic of its own.
**Alternatives considered:** Inlining the job logic directly in `server.ts`'s `scheduled` export; a wholly separate Worker/service just for the cron job.
**Rationale:** TanStack Start's server-entry-point guide documents `server.ts` as the intended extension point for Workers-specific features (queues, scheduled events, Durable Objects) — it's the framework-sanctioned way to add a `scheduled` export without forking the SSR entry. Keeping both exports as pure delegation means `server.ts` — the one file that fronts all SSR/route traffic — stays trivially reviewable, and the actual job logic lives in an ordinary, independently-testable module like the rest of the codebase instead of inside the Workers entry point. A separate Worker would avoid touching `server.ts` at all, but needs its own `wrangler.jsonc`, its own D1 binding, and duplicate deployment — pure overhead for what's a same-repo, same-database job.
**Tradeoffs accepted:** None significant — this is strictly less risky than inlining, at the cost of one extra file (`src/lib/jobs/materialize-recurring.ts`).

### Cross-user sweep query and per-template catch-up loop

**Decision:** Add a new repository function, `listAllDueTemplates(now)`, with no `user_id` filter (`status = 'active' AND next_due_date <= now`), and a new service function, `runScheduledMaterialization(now)`, that, per template, loops occurrences until caught up rather than processing one occurrence per call. `processDueRecurring` (the existing per-user, single-occurrence function) is kept, refactored to delegate to the same shared internal per-template helper (`processTemplateOccurrences`) that `runScheduledMaterialization` uses, rather than deleted — this was an open question at plan time (see below), resolved during implementation.
**Alternatives considered:** Enumerate all users and call the existing per-user `processDueRecurring` once per user; rely on the cron firing frequently enough that "one occurrence per invocation" naturally catches up over several runs; delete `processDueRecurring` outright instead of refactoring it to share the loop.
**Rationale:** Per-user enumeration means one query per user (N+1) for no benefit — the templates table already carries `user_id` per row, so a single global query is strictly cheaper. The catch-up loop is required by spec §US-002 (a template missing several runs must produce one transaction per missed occurrence in the _next_ successful run, not trickle out over several future runs). `processDueRecurring` was kept (not deleted) because its existing tests didn't assert single-occurrence-only behavior, so sharing the helper was risk-free and preserved that test coverage instead of discarding it.
**Tradeoffs accepted:** `processDueRecurring` now also gains failure-isolation and duplicate-constraint handling it didn't have before — a behavior change, though safe since it has no production caller (confirmed at implementation time).

### Database-level idempotency guard

**Decision:** Partial unique index on `transactions(recurring_template_id, date)` where `recurring_template_id IS NOT NULL`, in addition to the existing application-level `last_insertion_date >= next_due_date` skip check.
**Alternatives considered:** Rely solely on the application-level check.
**Rationale:** The app-level check protects against redundant work _within_ a single call's in-memory view, but Workers' at-least-once `scheduled()` guarantee means two overlapping invocations could both read "not yet inserted" before either writes. Spec §7 explicitly requires never duplicating a transaction under re-invocation — only a DB constraint gives that guarantee unconditionally.
**Tradeoffs accepted:** A duplicate-occurrence insert now fails at the DB layer; the service function must treat that failure as "already handled, not an error" (skip, don't mark `failed`) rather than letting it bubble up as a materialization failure.

### Cron frequency: hourly

**Decision:** `[triggers].crons = ["0 * * * *"]` (hourly).
**Alternatives considered:** Once daily at a fixed UTC hour.
**Rationale:** Templates carry a specific time-of-day (inherited from `start_date`), not just a calendar date. A daily fixed-time run would leave templates due later in the day systematically late by up to ~24h; hourly caps worst-case lateness at ~1h regardless of a template's time-of-day, at negligible extra D1 query cost given this app's scale.
**Tradeoffs accepted:** 24x the invocation count versus a daily run — immaterial here, but worth revisiting if the user base or template count grows by orders of magnitude.

## 10. Open Questions & Risks

- [ ] **Recovering a `failed` template** remains out of scope (spec §3, §9) — this plan does not add a reactivation path. A template that fails during a sweep stays `failed` indefinitely until a future spec addresses recovery.
- [ ] **Migration ordering risk:** the new partial unique index must be added and deployed _before_ the scheduled handler starts running against production data, otherwise a narrow window exists where a double-invocation could insert a duplicate prior to the constraint existing. Sequence implementation/deploy steps accordingly (migration first, cron trigger + `server.ts` second).

## Changelog

### v1.1 — 2026-07-13

- Resolved the "fate of `processDueRecurring`" open question (§9, §10): implementation chose to refactor it to share the new catch-up loop rather than delete it — folded into §9's decision record, removed from Open Questions.
- Renamed the new cross-user repository function from the originally-specified `listDueTemplates(now)` to `listAllDueTemplates(now)` throughout, to avoid colliding with the pre-existing per-user `listDueTemplates(userId, now)`.
- Removed the planned `buildDueTemplatesQuery` build-variant from scope — it was never called by any `runBatch` batch (the sweep query is a plain read, not part of an atomic multi-statement write), so it shipped as dead code and was deleted at validation.

---

_Spec: [./spec.md](./spec.md) | Mode: brownfield_
