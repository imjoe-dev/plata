# Tasks: Rate Limiting & Chat Endpoint Auth Gap

**Spec:** [./spec.md](./spec.md) (v1.0) | **Plan:** [./plan.md](./plan.md) (v1.0)
**Generated:** 2026-07-13
**Total tasks:** 12

---

## Tasks (in execution order)

### 1. [infra-01] Add rate limiter bindings to wrangler.jsonc

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** Infra (supports US-002, US-003, US-004)

Add three `ratelimits` entries to `wrangler.jsonc`, as peers to the existing `d1_databases` entry: `CHAT_RATE_LIMITER` (limit 5, period 60), `AUTH_RATE_LIMITER` (limit 5, period 60), `MUTATION_RATE_LIMITER` (limit 30, period 60), each with a unique `namespace_id`. Regenerate `worker-configuration.d.ts` via `vp run wrangler:type` so the three bindings are typed on `Env`.

**Acceptance Criteria:**

- [ ] `wrangler.jsonc` has three `ratelimits` entries with distinct `name`/`namespace_id` values and the limits above.
- [ ] `worker-configuration.d.ts`'s `Env` interface includes `CHAT_RATE_LIMITER`, `AUTH_RATE_LIMITER`, `MUTATION_RATE_LIMITER` typed as `RateLimit` after regeneration.
- [ ] `vp run build` still succeeds with the new bindings declared.

**Tests:**

- **Given** the updated `wrangler.jsonc`, **When** `vp run wrangler:type` runs, **Then** the generated `Env` interface exposes all three new bindings with no type errors elsewhere in the codebase.

---

### 2. [infra-02] Add RateLimitedError to the shared error hierarchy

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** Infra (supports US-002, US-003, US-004)

In `src/lib/errors.ts`, add `RateLimitedError extends AppError` with HTTP status 429, following the same shape as the existing `UnauthorizedError`/`ValidationError`. Ensure `toErrorResponse` (`src/lib/api/http.ts`) maps it to a 429 `Response` with the standard `{ error: { name, status }, message }` envelope.

**Acceptance Criteria:**

- [ ] `RateLimitedError` exists in `src/lib/errors.ts`, extends `AppError`, status 429.
- [ ] `toErrorResponse(new RateLimitedError(...))` produces a 429 `Response` matching the existing error envelope shape.

**Tests:**

- **Given** a thrown `RateLimitedError`, **When** it passes through `toErrorResponse`, **Then** the resulting `Response` has status 429 and a JSON body of `{ error: { name: "RateLimitedError", status: 429 }, message: string }`.

---

### 3. [infra-03] Implement shared checkRateLimit helper

**Status:** Done | **Depends on:** infra-01, infra-02 | **Complexity:** S | **Story:** Infra (supports US-002, US-003, US-004, US-006)

Add a small helper (e.g. `checkRateLimit(binding: RateLimit, key: string): Promise<void>` in `src/lib/api/http.ts` or a new `src/lib/api/rate-limit.ts`) that calls `binding.limit({ key })`-equivalent, throws `RateLimitedError` when the limit is exceeded, and — per spec §7/US-006 — also throws `RateLimitedError` if the binding call itself throws (fail closed). This is the single place all three rate-limited surfaces call into, avoiding duplicated try/catch logic at each call site.

**Acceptance Criteria:**

- [ ] Exceeding the limit throws `RateLimitedError`.
- [ ] The underlying binding call throwing (simulated failure) also throws `RateLimitedError` (fail closed), not a silent pass-through.
- [ ] Staying under the limit resolves without throwing.

**Tests:**

- **Given** a mocked rate limiter binding whose `.limit()` resolves `{ success: false }`, **When** `checkRateLimit` is called, **Then** it throws `RateLimitedError`.
- **Given** a mocked binding whose `.limit()` rejects/throws, **When** `checkRateLimit` is called, **Then** it throws `RateLimitedError` (fail closed).
- **Given** a mocked binding whose `.limit()` resolves `{ success: true }`, **When** `checkRateLimit` is called, **Then** it resolves without throwing.

---

### 4. [us001-01] Require authentication on the chat endpoint

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** US-001

In `src/routes/api/chat.ts`, call the existing `requireUser(request)` (from `src/lib/api/http.ts`) at the top of the `POST` handler, before any LLM call, matching the pattern every other API route already uses. Propagate the thrown `UnauthorizedError` through `toErrorResponse` so an unauthenticated request never reaches `chat(...)`.

**Acceptance Criteria:**

- [ ] `POST /api/chat` without a valid session returns 401 and never calls `chat(...)`/reaches the LLM.
- [ ] `POST /api/chat` with a valid session behaves exactly as before this task.

**Tests:**

- **Given** a request to `/api/chat` with no session cookie, **When** `POST` is invoked, **Then** the response is 401 and the mocked `chat()` function is never called.
- **Given** a request with a valid session, **When** `POST` is invoked, **Then** the existing SSE streaming behavior is unchanged.

---

### 5. [us002-01] Rate-limit the chat endpoint per user

**Status:** Done | **Depends on:** us001-01, infra-03 | **Complexity:** M | **Story:** US-002

In `src/routes/api/chat.ts`, after the `requireUser()` gate from us001-01, call `checkRateLimit(env.CHAT_RATE_LIMITER, userId)` before invoking `chat(...)`. On `RateLimitedError`, return the 429 response via `toErrorResponse` instead of starting the SSE stream.

**Acceptance Criteria:**

- [ ] A user issuing more than 5 requests to `/api/chat` within 60 seconds receives 429 on the 6th+ request, and the LLM is not called for the rejected request.
- [ ] Requests within the 5/60s threshold are unaffected.
- [ ] The limit is keyed per authenticated user ID, not shared globally.

**Tests:**

- **Given** a mocked `CHAT_RATE_LIMITER` that reports the limit exceeded for a given user, **When** that user calls `POST /api/chat`, **Then** the response is 429 and `chat(...)` is never invoked.
- **Given** two different users each under their own limit, **When** both call `POST /api/chat`, **Then** neither is affected by the other's usage.

---

### 6. [us003-01] Rate-limit auth endpoints per IP

**Status:** Done | **Depends on:** infra-03 | **Complexity:** M | **Story:** US-003

In `src/routes/api/auth/$.ts`, before delegating to `auth().handler(request)`, extract the source IP via `request.headers.get("CF-Connecting-IP")` and call `checkRateLimit(env.AUTH_RATE_LIMITER, ip)`. On `RateLimitedError`, return a 429 `Response` directly (via `toErrorResponse`) instead of delegating to Better Auth.

**Acceptance Criteria:**

- [ ] More than 5 requests to any `/api/auth/*` path from the same IP within 60 seconds receive 429 on the 6th+ request, and Better Auth's handler is not invoked for the rejected request.
- [ ] Legitimate login/OAuth flows under that threshold are unaffected.
- [ ] The limit is keyed per source IP (`CF-Connecting-IP`), not per user (no session exists at this point).

**Tests:**

- **Given** a mocked `AUTH_RATE_LIMITER` reporting the limit exceeded for a given IP, **When** a request to any `/api/auth/*` path arrives from that IP, **Then** the response is 429 and `auth().handler` is never invoked.
- **Given** requests from two different IPs, **When** one exceeds its limit, **Then** the other IP's requests are unaffected.

---

### 7. [us004-01] Add opt-in rate limiting to apiHandler

**Status:** Done | **Depends on:** infra-03 | **Complexity:** M | **Story:** US-004

Extend `apiHandler` in `src/lib/api/http.ts` with an optional config (e.g. a second argument `{ rateLimit: true }`) that, when set, calls `checkRateLimit(env.MUTATION_RATE_LIMITER, userId)` (using the already-resolved user ID from `requireUser`) before running the wrapped handler. When the option is omitted (the default, used by all existing GET handlers), behavior is completely unchanged.

**Acceptance Criteria:**

- [ ] `apiHandler(handler)` (no option) behaves identically to today — no rate limiting applied.
- [ ] `apiHandler(handler, { rateLimit: true })` checks `MUTATION_RATE_LIMITER` keyed by the authenticated user ID before running `handler`.
- [ ] Existing GET routes (unchanged call sites) are verified unaffected.

**Tests:**

- **Given** a route using `apiHandler(handler)` with no rate-limit option, **When** called repeatedly past what would be the mutation limit, **Then** no 429 is ever returned (opted out).
- **Given** a route using `apiHandler(handler, { rateLimit: true })` with a mocked `MUTATION_RATE_LIMITER` reporting exceeded, **When** called, **Then** the response is 429 and the wrapped `handler` is never invoked.

---

### 8. [us004-02] Rate-limit transaction write routes

**Status:** Done | **Depends on:** us004-01 | **Complexity:** S | **Story:** US-004

In `src/routes/api/transactions/index.ts` (`POST`) and `src/routes/api/transactions/$id.ts` (`PATCH`, `DELETE`), pass `{ rateLimit: true }` to their `apiHandler(...)` registration. Leave the `GET` handlers in both files unchanged.

**Acceptance Criteria:**

- [ ] `POST /api/transactions`, `PATCH /api/transactions/:id`, `DELETE /api/transactions/:id` are rate-limited at 30/60s per user.
- [ ] `GET /api/transactions` and `GET /api/transactions/:id` (if present) are unaffected.

**Tests:**

- **Given** a mocked `MUTATION_RATE_LIMITER` reporting exceeded for a user, **When** that user calls `POST /api/transactions`, **Then** the response is 429.
- **Given** the same exceeded state, **When** that user calls `GET /api/transactions`, **Then** the response is unaffected (200, not 429).

---

### 9. [us004-03] Rate-limit category write routes

**Status:** Done | **Depends on:** us004-01 | **Complexity:** S | **Story:** US-004

In `src/routes/api/categories/index.ts` (`POST`) and `src/routes/api/categories/$id.ts` (`PATCH`, `DELETE`), pass `{ rateLimit: true }` to their `apiHandler(...)` registration. Leave `GET` handlers unchanged.

**Acceptance Criteria:**

- [ ] `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` are rate-limited at 30/60s per user.
- [ ] `GET` handlers on the same routes are unaffected.

**Tests:**

- **Given** a mocked `MUTATION_RATE_LIMITER` reporting exceeded for a user, **When** that user calls `POST /api/categories`, **Then** the response is 429.

---

### 10. [us004-04] Rate-limit recurring template write routes

**Status:** Done | **Depends on:** us004-01 | **Complexity:** M | **Story:** US-004

Pass `{ rateLimit: true }` to the `apiHandler(...)` registration for `POST /api/recurring-templates` (`index.ts`), `PATCH`/`DELETE /api/recurring-templates/:id` (`$id/index.ts`), `POST /api/recurring-templates/:id/activate`, and `POST /api/recurring-templates/:id/pause`. Leave `GET` handlers unchanged.

**Acceptance Criteria:**

- [ ] All five write handlers across the four recurring-template route files are rate-limited at 30/60s per user.
- [ ] `GET` handlers on the same resource are unaffected.

**Tests:**

- **Given** a mocked `MUTATION_RATE_LIMITER` reporting exceeded for a user, **When** that user calls `POST /api/recurring-templates/:id/activate`, **Then** the response is 429.

---

### 11. [us005-01] Bridge query/mutation errors to toasts

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** US-005

In `src/integrations/tanstack-query/root-provider.tsx`, configure the `QueryClient` with a `QueryCache`/`MutationCache` `onError` that calls `toastManager.add({ title: error.message, data: { variant: "error" } })` (matching the existing manual usage in `login-page.tsx`). This is the first central error-to-toast bridge in the app — it will surface errors from all existing and future React-Query-driven calls, not only the new rate-limited ones.

> **Discovery during implementation:** grepping the codebase found zero call sites currently using `useQuery`/`useMutation` — no UI form calls the mutating API routes (transactions/categories/recurring-templates) directly today. Those routes are only invoked via LLM chat tool-calls (`src/lib/ai/tools/client.ts`, using a plain `fetch` wrapper, not React Query), whose errors already surface inline per-tool-call in the chat UI (`tool-call-display-state.ts`'s existing "error" state) rather than through this bridge. This bridge is correctly built per plan and will apply automatically once any future component adopts `useQuery`/`useMutation`, but as of this task it has no exercised production call site for the mutation surface specifically. Flagging for `/validate` and for spec.md's Open Questions — the mutation-route 429 (US-004) currently reaches the user via the pre-existing inline tool-call error UI, not a toast, which is a narrower reading of US-005's acceptance criterion than "the app's existing global toast error handling" implies.

**Acceptance Criteria:**

- [ ] Any query or mutation that throws (including the new `RateLimitedError`/`UnauthorizedError` cases from tasks 5–10) results in a `toastManager.add` call with an error-variant toast showing the thrown error's message.
- [ ] No duplicate/double toasts are introduced for errors already handled locally (e.g. `login-page.tsx`'s existing manual toast) — verify no regression there.

**Tests:**

- **Given** a `QueryClient` configured with the new `onError`, **When** a mutation throws an `Error` with message "You're doing that too fast", **Then** `toastManager.add` is called with that message and an error variant.

---

### 12. [us005-02] Surface chat errors as toasts

**Status:** Done | **Depends on:** us005-01, us002-01 | **Complexity:** S | **Story:** US-005

In `src/routes/_protected/index.tsx`, where `usePlataChat()`'s `error` state is currently rendered as a generic inline message, add a `toastManager.add(...)` call (e.g. via a `useEffect` watching `error`) so chat errors (401 from us001-01, 429 from us002-01, or other failures) reach the user the same way as other errors post-us005-01. Keep or remove the existing inline message per whichever reads better with a toast also present — no dedicated behavior is specified beyond "the error reaches the user via toast."

**Acceptance Criteria:**

- [ ] When `usePlataChat()`'s `error` becomes truthy, a `toastManager.add` call fires with an error-variant toast.
- [ ] The toast fires once per distinct error occurrence (no duplicate firing on unrelated re-renders).

**Tests:**

- **Given** `usePlataChat()` returns a truthy `error`, **When** the component using it renders/updates, **Then** `toastManager.add` is called exactly once for that error.

---

## Story Coverage

| Story  | Priority    | Tasks                                                                   | Coverage |
| ------ | ----------- | ----------------------------------------------------------------------- | -------- |
| US-001 | Must Have   | us001-01                                                                | ✓ Full   |
| US-002 | Must Have   | us002-01 (+ infra-01, infra-02, infra-03)                               | ✓ Full   |
| US-003 | Must Have   | us003-01 (+ infra-01, infra-02, infra-03)                               | ✓ Full   |
| US-004 | Should Have | us004-01, us004-02, us004-03, us004-04 (+ infra-01, infra-02, infra-03) | ✓ Full   |
| US-005 | Should Have | us005-01, us005-02                                                      | ✓ Full   |
| US-006 | Must Have   | infra-03 (fail-closed behavior), consumed by us002-01/us003-01/us004-01 | ✓ Full   |
