# Plan: Rate Limiting & Chat Endpoint Auth Gap

**Spec:** [./spec.md](./spec.md)
**Mode:** brownfield
**Status:** Approved
**Created:** 2026-07-13
**Version:** 1.0

---

## 1. Overview

Close the chat endpoint's missing auth check and add three Cloudflare-native Rate Limiting bindings (chat, auth, mutations) to bound abuse and cost exposure (see spec.md §2). Each surface gets its own binding with a distinct key strategy — user ID for chat and mutations, source IP for auth (no session exists yet at that point). A new `RateLimitedError` follows the existing `AppError` pattern for uniform 429 responses, and a small QueryCache-level error bridge is added so those (and other) errors actually reach the user as toasts — closing a gap where the "global toast handling" CLAUDE.md describes doesn't yet exist in code.

## 2. Codebase Context

**Affected modules:**

- `wrangler.jsonc` — three new `ratelimits` binding declarations
- `src/routes/api/chat.ts` — add `requireUser()` gate + rate-limit check before invoking the LLM
- `src/routes/api/auth/$.ts` — add IP-keyed rate-limit check before delegating to Better Auth
- `src/lib/api/http.ts` — extend `apiHandler` with an opt-in rate-limit option
- `src/routes/api/transactions/index.ts`, `transactions/$id.ts`, `categories/index.ts`, `categories/$id.ts`, `recurring-templates/index.ts`, `recurring-templates/$id/index.ts`, `recurring-templates/$id/activate.ts`, `recurring-templates/$id/pause.ts` — opt in to the mutation rate limit on their POST/PATCH/DELETE handlers only
- `src/lib/errors.ts` — add `RateLimitedError`
- `src/integrations/tanstack-query/root-provider.tsx` — add a `QueryCache`-level error bridge to `toastManager`
- `src/routes/_protected/index.tsx` — surface chat errors via `toastManager` in addition to (or instead of) the current inline message
- `worker-configuration.d.ts` — regenerated via `vp run wrangler:type` after the binding declarations land

**Integration points:** New bindings are peers to the existing `d1_databases` entry in `wrangler.jsonc`. `requireUser()` and `toErrorResponse()` (both in `src/lib/api/http.ts`) are reused as-is for chat's new auth gate and for shaping 429 responses. `apiHandler` is extended, not replaced, so existing route behavior for GET handlers is unchanged.

**Existing conventions to follow:** Every mutating/read API route already funnels through `apiHandler(...)`, which catches thrown errors via `toErrorResponse` and shapes them as `{ error: { name, status }, message }`. Custom error types extend a shared `AppError` base in `src/lib/errors.ts` (see `UnauthorizedError`, `ValidationError`) — `RateLimitedError` follows the same shape.

**Reusable code and utilities:** `requireUser(request)` (session resolution + 401), `toErrorResponse(error)` (error → `Response` shaping), `apiHandler(...)` (shared route envelope).

**Test setup:** Vitest + Testing Library; route tests live alongside routes in `__tests__/` folders (e.g. `src/routes/api/__tests__/chat.test.ts`), mocking dependencies at the module boundary.

## 3. Tech Stack

| Layer                 | Decision                                                                                          | Notes                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime               | Cloudflare Workers                                                                                | Existing — unchanged                                                                                                                                                               |
| Rate Limiting         | Cloudflare Workers native `ratelimits` binding                                                    | New for this feature. No third-party dependency; already available on this Workers deployment at no extra cost. Fixed-window counters with a hard 10s/60s period ceiling (see §9). |
| Auth                  | Better Auth (existing)                                                                            | `requireUser()` reused as-is for the new chat gate                                                                                                                                 |
| Error handling        | `AppError` subclasses + `toErrorResponse` (existing, `src/lib/errors.ts` / `src/lib/api/http.ts`) | `RateLimitedError` added following the existing pattern                                                                                                                            |
| Client state / toasts | TanStack Query `QueryClient` + `@base-ui/react` `toastManager` (both existing, not yet bridged)   | `QueryCache`-level `onError` added to bridge existing infrastructure that was never wired together                                                                                 |

## 4. Data Models

Expands spec.md §5 (Rate Limit Policy). These are design-time configuration entries (Cloudflare bindings), not database-persisted rows.

### Rate Limit Policy (configuration, three instances)

| Name             | Binding Name            | Key Strategy                | Limit | Period | Applies To                                                         |
| ---------------- | ----------------------- | --------------------------- | ----- | ------ | ------------------------------------------------------------------ |
| Chat limiter     | `CHAT_RATE_LIMITER`     | by-user (session `user.id`) | 5     | 60s    | `POST /api/chat`                                                   |
| Auth limiter     | `AUTH_RATE_LIMITER`     | by-ip (`CF-Connecting-IP`)  | 5     | 60s    | `/api/auth/*` (all methods)                                        |
| Mutation limiter | `MUTATION_RATE_LIMITER` | by-user (session `user.id`) | 30    | 60s    | POST/PATCH/DELETE on transactions, categories, recurring-templates |

**Domain invariants:**

- A request that would exceed its policy's limit is rejected with 429 before the underlying operation (LLM call, Better Auth handler, or DB write) executes — no partial side effects.
- If the limiter binding call itself throws/errors, the request is treated as exceeded (fail closed, per spec §7 / US-006).

## 5. API Surface

No new endpoints — existing endpoints gain new response behavior.

| Method        | Path                                    | Auth (before)                                      | Auth/Limit (after)                                       | Stories        |
| ------------- | --------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- | -------------- |
| POST          | `/api/chat`                             | None                                               | 401 if unauthenticated (new); 429 if >5 req/60s per user | US-001, US-002 |
| ALL           | `/api/auth/*`                           | None (unchanged — this is the auth surface itself) | 429 if >5 req/60s per source IP                          | US-003         |
| POST          | `/api/transactions`                     | Session required                                   | + 429 if >30 req/60s per user                            | US-004         |
| PATCH, DELETE | `/api/transactions/:id`                 | Session required                                   | + 429 if >30 req/60s per user                            | US-004         |
| POST          | `/api/categories`                       | Session required                                   | + 429 if >30 req/60s per user                            | US-004         |
| PATCH, DELETE | `/api/categories/:id`                   | Session required                                   | + 429 if >30 req/60s per user                            | US-004         |
| POST          | `/api/recurring-templates`              | Session required                                   | + 429 if >30 req/60s per user                            | US-004         |
| PATCH, DELETE | `/api/recurring-templates/:id`          | Session required                                   | + 429 if >30 req/60s per user                            | US-004         |
| POST          | `/api/recurring-templates/:id/activate` | Session required                                   | + 429 if >30 req/60s per user                            | US-004         |
| POST          | `/api/recurring-templates/:id/pause`    | Session required                                   | + 429 if >30 req/60s per user                            | US-004         |

### Key Request / Response Contracts

**429 response shape (all three surfaces)** — matches the existing `toErrorResponse` envelope:

```
Response: { error: { name: "RateLimitedError", status: 429 }, message: string }
```

**401 on `/api/chat` (new)** — identical shape to the `UnauthorizedError` already produced by every other API route via `requireUser()`:

```
Response: { error: { name: "UnauthorizedError", status: 401 }, message: string }
```

## 6. Security Plan

### Authentication & Authorization

- `/api/chat` gains the same `requireUser()` gate every other API route already has — closes the pre-existing gap where it was the only unauthenticated route.
- `/api/auth/*` remains intentionally open (it's the auth surface itself) but is throttled per source IP.

### Rate Limiting

| Endpoint Group                                                | Limit       | Window | Key                            |
| ------------------------------------------------------------- | ----------- | ------ | ------------------------------ |
| `POST /api/chat`                                              | 5 requests  | 60s    | authenticated user ID          |
| `/api/auth/*`                                                 | 5 requests  | 60s    | source IP (`CF-Connecting-IP`) |
| Mutating routes (transactions/categories/recurring-templates) | 30 requests | 60s    | authenticated user ID          |

### Security Checklist

- [ ] Rate-limit checks run before any expensive/mutating work (LLM call, Better Auth delegation, DB write) — never after.
- [ ] Rate-limit failures (binding errors) fail closed, not open.
- [ ] `RateLimitedError` responses never leak internal binding names, namespace IDs, or raw Cloudflare error details — generic user-facing message only.

## 7. Technical Decisions

### Burst limiting instead of long-window budgets

**Decision:** Implement all three limits as 60-second fixed windows via Cloudflare's native `ratelimits` binding (chat 5/60s, auth 5/60s, mutations 30/60s — mutations already matched a 60s window natively).
**Alternatives considered:** A Durable Object-backed counter for true rolling 1-hour (chat) / 10-minute (auth) windows, as originally elicited.
**Rationale:** The native binding's `simple.period` only accepts 10 or 60 seconds — confirmed against current Cloudflare docs. A 60s window can't express an hourly budget natively. Given this is a personal/multi-user finance app rather than a large-scale multi-tenant product, the added infrastructure (a new Durable Object namespace + migration) to get precise long windows isn't justified by the risk being mitigated.
**Tradeoffs accepted:** These are burst caps, not precise budget caps — a user sustaining exactly 5 req/60s for a full hour could still reach ~300 chat requests, well above the originally-elicited 20/hour target. This is an explicit, accepted tradeoff (see spec.md notes on US-002/US-003), not a silent gap. If actual abuse patterns show this is insufficient, revisit with a Durable-Object-backed limiter.

### RateLimitedError follows the existing AppError pattern

**Decision:** Add `RateLimitedError extends AppError` (status 429) in `src/lib/errors.ts`, alongside the existing `UnauthorizedError`/`ValidationError`.
**Alternatives considered:** Returning ad-hoc `Response` objects per call site.
**Rationale:** Keeps all three rate-limited surfaces producing a consistent, `toErrorResponse`-shaped body, matching how every other error in the app already surfaces.
**Tradeoffs accepted:** None — this is the established convention.

### Mutation rate limit is opt-in per handler registration, not global

**Decision:** Extend `apiHandler` with an optional rate-limit config, applied only where each route file registers its POST/PATCH/DELETE handler (not its GET handler).
**Alternatives considered:** (a) A single global check in `server.ts`'s `fetch()` covering the whole Worker; (b) embedding the check inside `requireUser()` itself, since every route already calls it.
**Rationale:** A global `fetch()` check can't distinguish GET from POST/PATCH/DELETE without re-parsing routing, and embedding it in `requireUser()` would also rate-limit GET requests, which spec §3 explicitly excludes (Non-Goals). Per-handler-registration opt-in keeps the exclusion exact and explicit at each call site, with no new middleware layer (there isn't one today).
**Tradeoffs accepted:** Slightly more repetition (one opt-in flag per write-handler registration, ~9 call sites) versus a single central check — acceptable given the codebase's existing preference for explicit per-route wiring over hidden global middleware.

### Chat and auth routes get inline checks, not `apiHandler`

**Decision:** `/api/chat` and `/api/auth/$` get their rate-limit (and, for chat, auth) checks written inline in their existing handlers, reusing `requireUser`/`toErrorResponse` directly rather than being restructured to use `apiHandler`.
**Alternatives considered:** Wrapping both in `apiHandler` for consistency with the rest of the API surface.
**Rationale:** `apiHandler` assumes a JSON-data-returning handler and wraps successful results in a `{ data, meta }` envelope; `/api/chat` returns a streaming SSE `Response` and `/api/auth/$` returns whatever Better Auth's own handler produces — neither fits that shape. Forcing both through `apiHandler` would require changing its success-path behavior, risking every other route that depends on the current envelope.
**Tradeoffs accepted:** Two routes have bespoke inline logic instead of the shared wrapper — acceptable since both were already bespoke (chat has no wrapper today; auth fully delegates to a third-party handler).

### Closing the toast-wiring gap centrally, not per call site

**Decision:** Add a `QueryCache`-level `onError` to the existing `QueryClient` (`src/integrations/tanstack-query/root-provider.tsx`) that calls `toastManager.add(...)` using the thrown error's `.message` (already produced by the existing `src/lib/ai/fetch.ts` wrapper). Separately, wire the chat hook's `error` state (`usePlataChat()` in `src/routes/_protected/index.tsx`) to also call `toastManager.add(...)`, since chat doesn't go through TanStack Query.
**Alternatives considered:** (a) Manually add a `toastManager.add(...)` call at each of the ~9 mutation call sites; (b) leave toast wiring out of scope and only satisfy US-005 for whichever routes happen to already show something.
**Rationale:** Investigation found no global toast wiring exists today despite CLAUDE.md describing one — only the login page calls `toastManager` manually, and chat shows a generic inline message. A single `QueryCache`-level bridge fixes this for all current and future React-Query-driven calls at once, which is less code than repeating the same call at every site, and actually delivers the behavior CLAUDE.md already claims exists.
**Tradeoffs accepted:** This changes error UX for _all_ existing queries/mutations app-wide (any of them that error will now toast), not just the three new rate-limited surfaces — a deliberate, scoped side effect of closing a real gap, flagged here for visibility rather than left as a surprise.

### IP extraction via `CF-Connecting-IP`

**Decision:** Read `request.headers.get("CF-Connecting-IP")` directly in `/api/auth/$.ts` for the auth limiter's key. No fallback header chain.
**Alternatives considered:** Also checking `X-Forwarded-For` as a fallback.
**Rationale:** `CF-Connecting-IP` is set by Cloudflare's edge on every request reaching a Worker and cannot be spoofed by the client (Cloudflare overwrites it) — a fallback to a spoofable header would weaken the guarantee this limiter exists to provide.
**Tradeoffs accepted:** None.

## 8. Open Questions & Risks

- [ ] **Burst-vs-budget gap (accepted risk):** the 60s-window limits bound burst rate but not true hourly/10-minute spend — see §7. Revisit with a Durable-Object-backed counter if real abuse patterns exceed what burst limiting catches.
- [ ] **Shared-IP false positives (accepted risk):** users behind the same NAT/corporate IP share the auth limiter's budget (5/60s). Given this app's expected user base, this is judged low-likelihood; monitor after rollout.
- [ ] **Fail-closed operational risk (accepted, per spec §7/US-006):** a genuine Cloudflare Rate Limiting service disruption would block chat, auth, and all mutations simultaneously rather than degrade gracefully. This is the deliberately-chosen tradeoff for stronger security posture — worth keeping in mind if such an outage is ever observed.
- [ ] **CSV import (deferred, per spec §9):** not built yet; no plan impact today, but will need either a bulk-create endpoint or an explicit exemption from the mutation limiter once it exists.

---

_Spec: [./spec.md](./spec.md) | Mode: brownfield_
