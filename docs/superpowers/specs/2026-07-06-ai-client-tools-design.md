# AI Client Tools for Categories / Transactions / Recurring Templates — Design

**Date:** 2026-07-06
**Status:** Approved
**Goal:** Give the chat model type-safe, auto-executing client tools (TanStack AI) that call the existing REST endpoints under `src/routes/api/categories`, `src/routes/api/transactions`, and `src/routes/api/recurring-templates` via `fetch`, so the assistant can read and mutate the user's financial data on the user's behalf during a conversation.

## Context

Plata already has:

- **REST endpoints** (`src/routes/api/*`) exposing full CRUD for categories, transactions, and recurring templates, plus `activate`/`pause` for recurring templates. All routes are user-scoped via `requireUser` (better-auth session cookie) and envelope responses as `{ data }` (single) or `{ data, meta: { count } }` (list). Errors come back as `{ error, message }`.
- **Input schemas** in `src/lib/schemas/*.ts` (zod). The `Transaction` and `RecurringTemplate` schemas transform `amount` via `.transform((v) => Math.round(v * 100))` (major units → cents) before the service persists.
- **A TanStack AI chat pipeline**: server route `src/routes/api/chat.ts` streams a `chat()` completion over SSE using `@tanstack/ai-openai`; client hook `src/hooks/use-plata-chat.ts` consumes it with `useChat` from `@tanstack/ai-react`. No tools are wired today.
- Installed versions: `@tanstack/ai@0.28.0`, `@tanstack/ai-react@0.15.4`, and a transitive `@tanstack/ai-client@0.16.3`. `@tanstack/ai-react` re-exports `createChatClientOptions` and `InferChatMessages` but **not** `clientTools`, which lives in `@tanstack/ai-client`.

TanStack AI's isomorphic tool model fits this perfectly: define a tool once with `toolDefinition({ name, description, inputSchema, outputSchema })`, implement it on the client with `def.client(fn)`, and let the browser execute it (cookies ride along same-origin, so auth is automatic). The server passes the bare **definitions** to `chat({ tools })` so the model can call them; the client passes the **implementations** to `useChat` so the browser runs `fetch`.

## Decisions

- **One tool per endpoint** (17 tools total), each its own `toolDefinition`. Chosen over grouped `action`-enum tools for better model accuracy and full per-tool zod type inference, and because it maps 1:1 to the declared endpoints.
- **All operations exposed, auto-executed** (no approval gates): reads, creates, updates, deletes, and `activate`/`pause`. The model can act on financial data immediately during a conversation.
- **Client-executed tools**: definitions live in pure (server-safe) modules; `.client()` implementations that `fetch` the endpoints live in a client-only module. The server bundle imports only the definitions, so `fetch` is never shipped to the server.
- **Amount handling**: tool `inputSchema`s use a **plain `z.number().positive()`** for `amount` (major units, e.g. `9.99`), not the existing transformed schema, to avoid double cents-conversion (the API schema converts once). Tool outputs **convert `amount` from cents → dollars** (÷100) before returning, so the model reasons in major units end-to-end. Every other field is reused from the existing schemas unchanged.
- **Output schemas** match the JSON response shape (snake_case rows, ISO-string timestamps), since `fetch().json()` returns plain JSON.
- **Errors surface to the model**: the fetch wrapper throws on non-2xx with the API's `message`; the framework reports it as a tool-result error so the model can correct and retry (e.g. fix a validation error).
- **Add `@tanstack/ai-client`** (`^0.16.3`) as a direct dependency for `clientTools` / `createChatClientOptions` / `InferChatMessages`.

## File layout

```
src/lib/ai/
  fetch.ts                       # shared apiGet/apiPost/apiPatch/apiDelete (client-only)
  tools/
    categories.ts                # 5 toolDefinitions + input/output schemas (pure, no fetch)
    transactions.ts             # 5 toolDefinitions (pure)
    recurring-templates.ts      # 7 toolDefinitions (pure)
    index.ts                    # allToolDefinitions[] (imported by chat.ts)
    client.ts                   # imports defs + fetch, builds .client() impls + allClientTools (imported by use-plata-chat)
```

Server route `chat.ts` imports `allToolDefinitions` from `src/lib/ai/tools/index` — pure definitions, no `fetch` pulled into the server bundle. Client hook imports `allClientTools` from `src/lib/ai/tools/client`.

## Tool inventory (17 tools)

### Categories (`src/lib/ai/tools/categories.ts`)

| Tool name         | Method + path                | Input                                 | Output          |
| ----------------- | ---------------------------- | ------------------------------------- | --------------- |
| `list_categories` | GET `/api/categories`        | `{}`                                  | `CategoryRow[]` |
| `create_category` | POST `/api/categories`       | `{ name, type, color?, icon? }`       | `CategoryRow`   |
| `get_category`    | GET `/api/categories/$id`    | `{ id }`                              | `CategoryRow`   |
| `update_category` | PATCH `/api/categories/$id`  | `{ id, name?, type?, color?, icon? }` | `CategoryRow`   |
| `delete_category` | DELETE `/api/categories/$id` | `{ id }`                              | `CategoryRow`   |

### Transactions (`src/lib/ai/tools/transactions.ts`)

| Tool name            | Method + path                  | Input                                                                                              | Output             |
| -------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------ |
| `list_transactions`  | GET `/api/transactions`        | `{ from?, to?, type?, categoryId? }`                                                               | `TransactionRow[]` |
| `create_transaction` | POST `/api/transactions`       | `{ amount, currency, type, description, date, categoryId?, recurringTemplateId?, source, notes? }` | `TransactionRow`   |
| `get_transaction`    | GET `/api/transactions/$id`    | `{ id }`                                                                                           | `TransactionRow`   |
| `update_transaction` | PATCH `/api/transactions/$id`  | `{ id, …patch }`                                                                                   | `TransactionRow`   |
| `delete_transaction` | DELETE `/api/transactions/$id` | `{ id }`                                                                                           | `TransactionRow`   |

### Recurring templates (`src/lib/ai/tools/recurring-templates.ts`)

| Tool name                     | Method + path                                | Input                                                                                                       | Output                   |
| ----------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------ |
| `list_recurring_templates`    | GET `/api/recurring-templates`               | `{ status? }`                                                                                               | `RecurringTemplateRow[]` |
| `create_recurring_template`   | POST `/api/recurring-templates`              | `{ amount, currency, type, description, categoryId?, cadence, nextDueDate?, status, startDate?, endDate? }` | `RecurringTemplateRow`   |
| `get_recurring_template`      | GET `/api/recurring-templates/$id`           | `{ id }`                                                                                                    | `RecurringTemplateRow`   |
| `update_recurring_template`   | PATCH `/api/recurring-templates/$id`         | `{ id, …patch }`                                                                                            | `RecurringTemplateRow`   |
| `delete_recurring_template`   | DELETE `/api/recurring-templates/$id`        | `{ id }`                                                                                                    | `RecurringTemplateRow`   |
| `activate_recurring_template` | POST `/api/recurring-templates/$id/activate` | `{ id }`                                                                                                    | `RecurringTemplateRow`   |
| `pause_recurring_template`    | POST `/api/recurring-templates/$id/pause`    | `{ id }`                                                                                                    | `RecurringTemplateRow`   |

## Schema strategy

### Inputs (avoid double cents-conversion)

Tool `inputSchema`s are derived from the existing `src/lib/schemas/*` to prevent drift, with `amount` replaced:

```ts
// transactions.ts
const TransactionCreateInput = Transaction.omit({ amount: true }).extend({
  amount: z
    .number()
    .positive()
    .meta({ description: "Amount in major currency units, e.g. 9.99 for $9.99" }),
});
```

All other fields are reused as-is, including `currency` (default `"USD"`), `type` and `source` enums, `date: z.coerce.date()` (LLM sends an ISO string; the client forwards it; the API coerces it again — round-trips fine), `categoryId`/`recurringTemplateId`/`notes` nullables, and `cadence`/`status` enums. Patch inputs add an `id: z.string()` and make the remaining fields optional (mirroring the existing `*Patch` schemas, again with `amount` as plain `z.number().positive().optional()`).

**`source` default for `create_transaction`:** transactions created through the chat assistant should be attributed to the assistant. The `create_transaction` tool input overrides `source` to `z.enum(["manual", "chat", "csv_import"]).default("chat")` so the model doesn't have to supply it and AI-created transactions are tagged correctly. (`update_transaction` leaves `source` optional with no default — a patch only sets it if the model asks.)

Every field carries a `.meta({ description })` so the model gets per-argument guidance.

### Outputs (match JSON response; cents → dollars)

New zod output schemas model the JSON the API actually returns (snake_case rows, ISO-string timestamps), with `amount` as a major-units `z.number()` because the `.client()` divides by 100 before returning:

```ts
const CategoryRow = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["expense", "income", "both"]),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  user_id: z.string(),
  created_at: z.string(), // ISO
  updated_at: z.string(), // ISO
  deleted_at: z.string().nullable(),
});
```

`TransactionRow` and `RecurringTemplateRow` follow the same pattern, including `amount: z.number()` (major units), `date`/`next_due_date`/etc. as `z.string().nullable()` ISO, and the relevant enums.

## fetch wrapper (`src/lib/ai/fetch.ts`)

Client-only helpers shared by every `.client()` implementation:

- `apiGet(path, query?)`, `apiPost(path, body)`, `apiPatch(path, body)`, `apiDelete(path)`.
- Same-origin (cookies sent automatically → better-auth session applies), `content-type: application/json`, `JSON.stringify(body)` for writes (Date values in the body serialize to ISO strings automatically via `JSON.stringify`).
- `query` object serialized into the query string for list filters; Date values in `query` are stringified via `.toISOString()` before being added to the query string.
- On `!res.ok`: parse `{ message }` from the API error envelope and `throw new Error(message)`. The framework surfaces the thrown error to the model as a tool-result `error`, letting it correct and retry.
- On success: return `json.data` (unwrap the `{ data }` / `{ data, meta }` envelope).

## Server wiring (`src/routes/api/chat.ts`)

Add `tools: allToolDefinitions` to the existing `chat()` call:

```ts
const stream = chat({
  adapter: adapters[model_id],
  messages,
  tools: allToolDefinitions, // bare definitions → executed on the client
});
```

No other changes. `model_id` selection via `forwardedProps` is unchanged.

## Client wiring (`src/hooks/use-plata-chat.ts`)

Switch from the inline options object to `createChatClientOptions` so client tools are registered, preserving `forwardedProps` and the buffered-messages wrapper:

```ts
import { clientTools, createChatClientOptions } from "@tanstack/ai-client";
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { allClientTools } from "@/lib/ai/tools/client";

const chatOptions = createChatClientOptions({
  connection: fetchServerSentEvents("/api/chat"),
  forwardedProps: { model_id: "gpt-5.4-mini" },
  tools: allClientTools,
});

export function usePlataChat() {
  const chat = useChat(chatOptions);
  const messages = useBufferedMessages(chat.messages);
  return { ...chat, messages };
}
```

## Dependency

Add to `package.json` `dependencies`:

```json
"@tanstack/ai-client": "^0.16.3"
```

Version matches the transitive copy already pulled by `@tanstack/ai-react@0.15.4`, avoiding version skew.

## Testing

- `src/lib/ai/fetch.ts`: mock global `fetch`; assert URL/method/headers/body, query-string building, `{ data }` unwrapping, and that non-2xx throws with the API `message`.
- Each tool's `.client()` (categories, transactions, recurring-templates): mock `fetch`; assert the correct method, path (including `$id`), and request body; assert the cents→dollars `amount` transform on the returned row.
- A small aggregate test: `allToolDefinitions` has 17 entries and `allClientTools` covers the same 17 tool names.

## Out of scope

- Server-side tool implementations (the service layer is called only through the REST endpoints from the browser).
- Tool approval flow (all tools auto-execute).
- The `processDueRecurring` cron path (stays out of HTTP).
- Any UI changes beyond the `usePlataChat` wiring swap (tool-call rendering is a separate concern).
