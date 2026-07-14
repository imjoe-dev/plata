# Spec: Rate Limiting & Chat Endpoint Auth Gap

**Status:** Implemented
**Created:** 2026-07-13
**Version:** 1.0

---

## 1. Overview

Plata's Cloudflare Worker has no rate limiting anywhere, and its LLM chat endpoint (`/api/chat`) has no authentication check at all — unlike every other API route in the app. Together this means an unauthenticated visitor who finds the URL can send unlimited requests to the OpenAI-billed chat endpoint at no cost to themselves but real cost to the app owner, and any endpoint (including login) can be hammered without consequence. This spec covers closing the chat auth gap and adding per-surface rate limits to bound abuse and cost exposure, using Cloudflare's native Workers Rate Limiting capability.

## 2. Goals

- The chat endpoint requires a valid session, like every other API route.
- Chat usage is capped per user to bound OpenAI cost exposure from any single account.
- Login/OAuth attempts are throttled per IP to blunt credential-stuffing/brute-force attempts.
- Write operations (create/update/delete) on core data are capped per user to blunt scripted abuse or runaway client retries.
- Users who are rate-limited see a clear, friendly explanation rather than a generic error.
- The app remains available even if the rate-limiting mechanism itself has a transient failure — but conservatively, not permissively (see Constraints).

## 3. Non-Goals

Things explicitly out of scope for this spec:

- Rate limiting read-only (GET) routes.
- Rate limiting or otherwise gating the hourly cron job (`materializeRecurring`) — it is not HTTP-reachable and cannot be abused externally.
- Zone-level Cloudflare protections (WAF rules, bot management, security level) — these are dashboard/Terraform-managed, not part of the Worker's own deployment config, and are a separate initiative.
- CSV import — the feature doesn't exist in the codebase yet (only a reserved `source` enum value). Its interaction with the mutation rate limit is deferred until it's actually built.
- Per-plan/tiered rate limits (e.g., different limits for different user types) — a single flat threshold per surface for all users.

## 4. Roles & Actors

| Role                    | Description                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated User      | A logged-in Plata user who chats with the LLM and creates/edits/deletes transactions, categories, and recurring templates.                  |
| Unauthenticated Visitor | Anyone hitting a public endpoint without a session — today this includes the chat endpoint, which should not be possible after this change. |
| App Owner/Operator      | Bears the cost and security consequences of unbounded usage — OpenAI billing exposure from chat, brute-force risk on login.                 |

## 5. Domain Model

This feature is cross-cutting request-handling behavior; it does not introduce new persisted business entities. The one conceptual entity worth naming:

### Rate Limit Policy

A rule describing how many requests a given key may make within a time window before being rejected. Not persisted as data — expressed as configuration (Cloudflare Rate Limiting bindings) and enforced in request-handling code.

- **Key fields:** `surface` (which endpoint(s) it covers), `keyStrategy` (Enum<by-user | by-ip>), `limit` (max requests), `period` (window in seconds)
- **Relationships:** applies to one or more HTTP route(s)
- **Business rules:** a request that would exceed the policy's limit within the current window is rejected (HTTP 429) rather than processed

## 6. User Stories

### [US-001] Chat endpoint requires login

**Priority:** Must Have
**Actor:** App Owner

> As the app owner, I want the chat endpoint to require a valid session, so that unauthenticated visitors cannot consume OpenAI-billed requests.

**Acceptance Criteria:**

- [ ] `POST /api/chat` without a valid session returns 401 Unauthorized and never calls the LLM.
- [ ] `POST /api/chat` with a valid session behaves exactly as it does today (no change for legitimate authenticated use, aside from the limit in US-002).

---

### [US-002] Chat usage is capped per user

**Priority:** Must Have
**Actor:** App Owner

> As the app owner, I want chat requests capped per user, so that no single account can run up unbounded OpenAI cost.

**Acceptance Criteria:**

- [ ] A user issuing more than 5 chat requests within a rolling 60-second window receives a 429 response instead of reaching the LLM.
- [ ] Requests within the 5/60s threshold are unaffected.
- [ ] The limit is keyed per authenticated user (not shared globally across all users).

> **Note:** Cloudflare's native Rate Limiting binding only supports 10s/60s fixed windows, not arbitrary long windows — see plan.md § Technical Decisions for the tradeoff accepted here (burst protection, not a precise hourly budget).

---

### [US-003] Login/OAuth attempts are throttled per IP

**Priority:** Must Have
**Actor:** App Owner

> As the app owner, I want login and OAuth requests capped per IP, so that credential-stuffing or brute-force attempts against authentication are throttled.

**Acceptance Criteria:**

- [ ] More than 5 requests to any `/api/auth/*` path from the same IP within a rolling 60-second window receive a 429.
- [ ] Legitimate login/OAuth flows under that threshold are unaffected.
- [ ] The limit is keyed per source IP, since no session exists yet at this point in the flow.

> **Note:** retuned from the originally elicited 10/10min to fit Cloudflare's 10s/60s window constraint — see plan.md § Technical Decisions.

---

### [US-004] Write operations are capped per user

**Priority:** Should Have
**Actor:** App Owner

> As the app owner, I want create/update/delete operations on transactions, categories, and recurring templates capped per user, so that scripted abuse or runaway client retries can't hammer the database.

**Acceptance Criteria:**

- [ ] More than 30 write requests (POST/PATCH/DELETE) to these routes from the same authenticated user within a rolling 1-minute window receive a 429.
- [ ] Read (GET) requests on the same routes are unaffected by this limit.
- [ ] The limit is keyed per authenticated user.

---

### [US-005] Rate-limited users see a clear message

**Priority:** Should Have
**Actor:** Authenticated User

> As a user who gets rate-limited, I want a clear, friendly message rather than a generic error, so that I understand what happened and that it's temporary.

> **Note:** investigation during planning found no actual global toast-error wiring exists today, despite CLAUDE.md describing one — `toastManager` is currently only invoked manually from the login page, and chat errors render as a generic inline message, not a toast. Delivering this story requires adding a small central bridge (see plan.md § Technical Decisions) rather than hooking into pre-existing plumbing.

**Acceptance Criteria:**

- [ ] 429 responses across all three limited surfaces (chat, auth, writes) produce a distinguishable, friendly message via the app's existing global toast error handling — not the generic "Something went wrong."

---

### [US-006] The app stays safe if the limiter itself fails

**Priority:** Must Have
**Actor:** App Owner

> As the app owner, I want the app to reject requests it can't confirm are within limits, so that a Cloudflare-side rate-limiter issue doesn't silently disable abuse protection.

**Acceptance Criteria:**

- [ ] If a rate-limit check errors unexpectedly (e.g. the binding is unavailable), the request is rejected rather than allowed through (fail closed).

---

## 7. Constraints

- Must use Cloudflare's native Workers Rate Limiting binding (`ratelimits` in the Worker's deployment config), not a third-party or hand-rolled limiter — this capability is already available on this Workers deployment.
- No client IP has ever been read anywhere in this codebase; supporting US-003 requires introducing IP extraction for the first time.
- Must not affect read-only (GET) traffic in this iteration (Non-Goals).
- Must not affect or require changes to the existing hourly cron job — it is a separate, non-HTTP invocation path.
- On limiter failure, the system must fail closed (US-006) — this is a deliberate, stricter-than-default choice given the app owner's preference, accepted with the tradeoff that a rate-limiter outage could temporarily block legitimate traffic on the affected surface.

## 8. Non-Functional Requirements

| Category    | Requirement                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security    | The chat endpoint must require authentication (closes an existing gap); auth endpoints must be throttled against brute-force/credential-stuffing. |
| Reliability | Rate-limit checks fail closed — a limiter error results in the request being rejected, not silently allowed.                                      |
| Performance | Rate-limit checks must not perceptibly slow down requests that are within their threshold.                                                        |

## 9. Open Questions

- [ ] CSV import doesn't exist yet; once built, it will need either a dedicated bulk-create endpoint or an explicit exemption from the write rate limit (US-004), since a loop of single-row creates would otherwise exceed 30/min quickly. Deferred — not decided here.
- [ ] Whether zone-level WAF/bot-management configuration should be pursued as a follow-up is explicitly out of scope for this spec (see Non-Goals) but may be worth a separate conversation.
- [ ] **Found during implementation (us005-01):** the mutating routes (US-004) are currently only ever called via LLM chat tool-calls, not through any UI form using `useQuery`/`useMutation` — so the new central toast bridge never actually fires for a mutation-route 429 today. Those errors instead surface through the pre-existing inline tool-call error UI. This satisfies "the user sees a distinguishable error," just not literally via toast for this one surface. Acceptable as-is, or worth an explicit decision — flagged for `/validate` rather than silently treated as fully satisfying US-005's literal wording.

---

_Next step: Run `/plan specs/rate-limiting/spec.md` to generate the technical plan._
