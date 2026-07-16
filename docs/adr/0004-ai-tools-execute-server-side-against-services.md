# AI tool execution calls services directly; no REST CRUD layer for categories/transactions/recurring-templates

Status: accepted

The `list/create/get/update/delete` tools for categories, transactions, and recurring templates (`src/lib/ai/tools/*.ts`) previously executed client-side via `@tanstack/ai`'s `.client()` binding (`src/lib/ai/tools/client.ts`), calling dedicated REST routes (`/api/categories`, `/api/transactions`, `/api/recurring-templates`) which in turn called `src/lib/services/*`. Those REST routes have no consumer besides these tool handlers — there is no UI, and none is planned, that would call them directly. The REST hop existed solely to let a browser-executed tool reach D1 through an HTTP round-trip.

We're removing that REST layer and executing these tools via `.server()` instead, calling the service layer directly within the `/api/chat` request. `@tanstack/ai` supports `.server()` with the same `needsApproval` semantics as `.client()` (confirmed via its docs: "Works with both server and client tools"), and thrown service errors (`NotFoundError`, `ConflictError`, etc.) surface as per-tool-call error states without any bespoke translation. The client's approval UI (`addToolApprovalResponse`, rendering off `part.state === "approval-requested"`) needs no tool definitions registered client-side to keep working — confirmed against `@tanstack/ai`'s docs, where the approval flow renders purely off streamed message parts.

`userId` is threaded into server tool handlers via `chat()`'s `context` option (`context: { userId }`), populated from the same `requireUser(request)` call the route already makes — tools stay defined once at module scope, no per-request construction needed.

Mutation-specific rate limiting (`env.MUTATION_RATE_LIMITER`), previously applied by the REST layer's `apiHandler({ rateLimit: true })`, is preserved by calling `checkRateLimit` directly inside each mutating `.server()` handler — this guards against a different failure mode than `needsApproval` (burst mutation volume vs. an unreviewed action) and isn't a natural casualty of removing the REST layer.

**Revisit when:** a UI or external API consumer needs direct CRUD access to categories, transactions, or recurring templates outside the chat flow — at that point, add REST routes back deliberately for that consumer, rather than assuming the chat tool path can serve it.
