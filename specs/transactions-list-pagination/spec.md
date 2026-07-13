# Spec: Transactions List Pagination & Optional Filters

**Status:** Implemented
**Created:** 2026-07-12
**Version:** 1.1

---

## 1. Overview

Users list their transactions through the LLM chat assistant (e.g. "list my transactions", "lista los gastos"). Today, asking the assistant to list transactions with no specific filter (e.g. "list all my transactions") fails: the assistant's `list_transactions` tool call sends explicit `null` for unset filters, and the tool's input validation rejects `null` (only accepting a real string or an omitted field), producing a validation error instead of results. Separately, the underlying `GET /api/transactions` endpoint has no pagination at all — it always returns every matching row for a user with no limit, no page, and no explicit ordering, which will not scale as users accumulate transactions. This effort fixes the null-handling crash and adds real pagination, while preserving every filter capability that exists today.

## 2. Goals

- Asking the assistant to list transactions with no filters (or only some filters) succeeds and returns results, instead of failing validation.
- The transactions list can be retrieved a page at a time, with the caller in control of how many results come back per page.
- Every filter available today (date range, type, category) continues to work, remains optional, and can be combined with pagination.
- Results are returned in a well-defined, predictable order by default (most recently created first), so pages are stable and consistent across requests.

## 3. Non-Goals

- Changing pagination or filter behavior for `/api/categories` or `/api/recurring-templates` — out of scope for this effort.
- Building a dedicated `/transactions` frontend list page/UI — this effort covers the API and the chat tool only; no such page exists today.
- Cursor-based pagination — this effort uses page-number-based pagination.
- Adding new filters (e.g. amount range, free-text search) beyond what exists today (date range, type, category).

## 4. Roles & Actors

| Role                      | Description                                                                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| End User                  | An authenticated Plata user who asks the chat assistant to list their transactions, optionally narrowing by date, type, or category.                                                                                              |
| LLM Chat Assistant        | Calls the `list_transactions` tool on the user's behalf, translating natural-language requests ("show my expenses in June", "list everything") into tool arguments. Today it sends `null` for any filter the user didn't mention. |
| System (Transactions API) | Validates the request, applies filters, orders and paginates results, and returns them to the caller (chat tool or any future direct API consumer).                                                                               |

## 5. Domain Model

### Transaction

Represents a single income or expense entry owned by a user. (Full field list is unchanged by this effort — see existing schema.)

- **Key fields:** `date` (business date, used for `from`/`to` filtering), `created_at` (when the row was recorded, used for default ordering), `type` (expense | income), `category_id`.
- **Relationships:** belongs to one User; optionally belongs to one Category.
- **Business rules:** unaffected by this effort (soft-deleted rows continue to be excluded from listings).

### Page (new concept)

A bounded, ordered slice of a user's transaction list.

- **Key fields:** `page` (1-based page number the caller is requesting), `limit` (max rows per page), the returned rows, and enough metadata for the caller to know whether more pages exist.
- **Business rules:** a page request with no filters returns a slice of _all_ the user's non-deleted transactions, ordered newest-created-first by default; a page request with filters returns a slice of the filtered set, same ordering rules.

## 6. User Stories

### [US-001] List transactions with no filters via chat

**Priority:** Must Have
**Actor:** End User (via LLM Chat Assistant)

> As an end user, I want to ask the assistant to list all my transactions without specifying a date range, type, or category, so that I can see my activity without having to narrow it down first.

**Acceptance Criteria:**

- [ ] Asking the assistant to list transactions with no filters mentioned returns results (does not fail with a validation error).
- [ ] The assistant no longer needs to ask the user to pick "gastos" or "ingresos" before it can list anything — type remains an optional narrowing filter, not a requirement.
- [ ] Explicitly omitting a filter and explicitly passing "no preference" for a filter behave identically (both are treated as "not filtering on this field").

---

### [US-002] Retrieve transactions a page at a time

**Priority:** Must Have
**Actor:** End User / any consumer of the transactions list

> As a consumer of the transactions list, I want to request a specific page of results with a maximum number of rows, so that large transaction histories don't have to be returned all at once.

**Acceptance Criteria:**

- [ ] The list request accepts an optional page number and an optional page size (limit).
- [ ] When no page/limit is given, a sensible default page size is used rather than returning the entire table.
- [ ] The response indicates enough information for the caller to know whether further pages exist (e.g. total count and/or whether there's a next page).
- [ ] Requesting a page beyond the available data returns an empty page, not an error.

---

### [US-003] Combine pagination with existing filters

**Priority:** Must Have
**Actor:** End User

> As an end user, I want to filter by date range, type, or category and still get paginated results, so that narrowing my search doesn't lose the ability to page through a large filtered result set.

**Acceptance Criteria:**

- [ ] Date range (`from`/`to`), type, and category filters all continue to work exactly as they do today.
- [ ] Any combination of filters can be used together with page/limit.
- [ ] All filters remain optional and independent — supplying one does not require supplying another.

---

### [US-004] Predictable default ordering

**Priority:** Must Have
**Actor:** End User

> As an end user, I want transactions listed in a consistent, predictable order by default, so that paging through results doesn't show me duplicates or skip rows between pages.

**Acceptance Criteria:**

- [ ] When no explicit sort is requested, results are ordered by creation time, most recent first.
- [ ] The default order is stable across repeated requests with the same filters (no reordering between page 1 and page 2 of the same query).

---

### [US-005] Resilient filter input handling

**Priority:** Should Have
**Actor:** LLM Chat Assistant

> As the assistant filling in tool arguments on the user's behalf, I want the system to tolerate `null` or empty values for filters I'm not using, so that my tool calls don't fail due to how I represent "not specified."

**Acceptance Criteria:**

- [ ] Passing `null` for `from`, `to`, or `categoryId` is treated the same as omitting the field entirely.
- [ ] Passing an empty string for `from` or `to` is treated the same as omitting the field entirely (does not throw a date-parsing error).
- [ ] Passing `null` for `page` or `limit` is treated the same as omitting the field entirely (falls back to the default), not a validation error.

---

## 7. Constraints

- Must not change behavior or response shape for existing callers in ways that break the current `list_transactions` chat tool beyond what's needed to fix the described bug (i.e. stay additive/backward-compatible where possible).
- Must work within the existing per-user data isolation — a user can only ever page through their own transactions.
- Must remain performant as a user's transaction history grows into the thousands of rows (default ordering column should be indexed).

## 8. Non-Functional Requirements

| Category    | Requirement                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Performance | Listing and paginating a single user's transactions must remain fast as their history grows to several thousand rows; the default sort column must be indexed rather than sorted in memory. |
| Reliability | Malformed or "empty" filter input (null, empty string) must never crash the request — it must be treated as "filter not applied."                                                           |

## Changelog

### v1.1 — 2026-07-13

- US-005: added an explicit acceptance criterion that `null` for `page`/`limit` falls back to the default, closing a gap the validator found — the AI tool's `page`/`limit` fields were not null-safe like the other filter fields, risking the same crash class this feature fixes.

## 9. Open Questions

- [ ] Should the `list_transactions` chat tool itself expose `page`/`limit` to the LLM (so it can explicitly ask for "the next page"), or should the chat tool always request a fixed, reasonably-sized page internally since there's no UI for the user to request "page 2" today? Owner: product/engineering, to be resolved in `/plan`.
- [ ] Exact default and maximum page size values — deferred to `/plan` as an implementation detail.
- [ ] Exact response envelope shape for pagination metadata (e.g. `total`, `hasMore`, `totalPages`) — deferred to `/plan`.

---

_Next step: Run `/plan specs/transactions-list-pagination/spec.md` to generate the technical plan._
