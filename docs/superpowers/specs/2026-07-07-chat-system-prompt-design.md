# Chat System Prompt — Design

**Date:** 2026-07-07
**Status:** Approved
**Goal:** Give the chat model a restrictive, app-aware system prompt that constrains it to Plata's purpose (recording/managing the user's finances and reporting on them), and wire it into the existing TanStack AI chat route via the `systemPrompts` option.

## Context

Plata already has a working chat pipeline:

- **Server route** `src/routes/api/chat.ts` streams a `chat()` completion over SSE via `@tanstack/ai-openai`, passing `messages` + `tools` (17 tool definitions). It currently passes **no system prompt** — the model runs unconstrained.
- **Client hook** `src/hooks/use-plata-chat.ts` consumes the stream with `useChat` from `@tanstack/ai-react` and ships client-side tool implementations (`allClientTools`) that `fetch` the REST endpoints under `src/routes/api/*`.
- **Tools** (in `src/lib/ai/tools/`): CRUD on `categories`, `transactions`, `recurring-templates`, plus `activate`/`pause` for recurring templates. Tool inputs use **major currency units** for `amount` (e.g. `9.99`); tool outputs convert cents → dollars (÷100). Enums: transaction `type` ∈ {expense, income}; transaction `source` ∈ {manual, chat, csv_import} (defaults to `chat` for AI-created rows); category `type` ∈ {expense, income, both}; recurring template `status` ∈ {active, paused, completed, failed}; `cadence` ∈ {daily, weekly, biweekly, monthly, quarterly, yearly}.
- **Auth**: every REST endpoint is user-scoped via `requireUser` (better-auth session cookie, same-origin in the browser). The model only ever sees the current user's data through the tools — there is no cross-user surface.
- Chat messages render with `react-markdown` + `remark-gfm`, so GFM tables, bold, lists, and headings are supported in the UI today.

Per the TanStack AI docs (Context7, `/tanstack/ai`), `chat(options)` accepts an optional `systemPrompts: string[]` parameter — an array of system prompts prepended to the `messages` sent to the model. This is the sanctioned mechanism, so no client changes are needed: `systemPrompts` is server-side only and never travels over the wire to or from the browser.

## Decisions

- **Mandate scope: "finance + brief rapport".** The model's job is to record/manage the user's financial data and report on it. Short greetings/pleasantries are allowed; substantive off-topic help (general knowledge, investing/tax advice, predictions, coding/travel/etc.) is hard-refused with a one-line redirect. Chosen over "strict finance-only" (too cold) and "finance + advice" (out of scope and risky) for usability without drift.
- **Language: mirror the user.** The model replies in whatever language the user wrote in (Spanish, English, etc.). Fits a Colombian-rooted app used across locales without hardcoding one.
- **Destructive-action guardrail: confirm deletes only.** Before any `delete_*` tool call, the model states exactly what will be deleted (resource + id/short description) and asks for confirmation. `create_*`, `update_*`, `activate_*`, `pause_*` execute immediately and then summarize in one or two lines. No amount threshold gating — keeps the rule simple and matches the "user can undo afterwards" shape of soft-delete endpoints.
- **Ambiguity rule: ask, don't guess.** If `amount`, `date`, `cadence`, or `type` is missing or ambiguous, the model asks one short clarifying question rather than inventing a value. A wrong $500 expense is worse than a quick question.
- **Formatting: Markdown/GFM**, leveraging the existing `react-markdown` + `remark-gfm` renderer. Reports prefer a compact Markdown table with a one-line summary above. Lists exceeding ~10 rows are summarized (totals, top categories) with an offer to show the rest, rather than dumping every row. No promise of charts/images — text only (visualizations are future work).
- **Tone: concise, neutral, friendly.** No emojis, no marketing puffery, no filler ("Sure!", "Great question"). Lead with the fact, not preamble.
- **Privacy: current-user only.** The model never asks for or assumes another user's identifiers; if a request implies cross-user action, it refuses and explains the tools are scoped to the user's own account.
- **Storage: a constant string** in a new pure module `src/lib/ai/system-prompt.ts`, imported by `src/routes/api/chat.ts` and passed as `systemPrompts: [SYSTEM_PROMPT]`. No DB, no env var, no client change. Keeps the prompt version-controlled and reviewable; moving it to a Cloudflare var for hot-edit is explicitly out of scope (can be a follow-up).
- **No new tests for the prompt text.** Prompt text is creative content, not logic. The wiring change in `chat.ts` is one line and covered by the existing chat route test (`src/routes/api/__tests__/chat.test.ts`); if that test asserts on the outbound request body it may need the new `systemPrompts` field recognized, to be handled during implementation.

## File layout

```
src/lib/ai/
  system-prompt.ts            # exports SYSTEM_PROMPT (const string)
  tools/                      # unchanged
  fetch.ts                    # unchanged
src/routes/api/chat.ts        # imports SYSTEM_PROMPT, passes systemPrompts to chat()
```

## The system prompt

A single sectioned constant. Sections are ordered constraints-first so the model reads what it cannot do before what it can:

1. **Identity & Mandate** — who Plata is, the model's role, what it is not.
2. **What you must refuse** — explicit no-list; brief pleasantries allowed, substantive off-topic refused.
3. **What you may do** — the 17 tools summarized; the enum vocabularies; the major-units amount rule; currency default.
4. **Acting with care** — confirm deletes before calling; other mutations execute then summarize; never invent numbers/dates/ids/cadences; ask when ambiguous.
5. **Reporting & formatting** — Markdown/GFM; compact tables for reports; summarize long lists; no charts promised.
6. **Language & tone** — mirror the user's language; concise, neutral, friendly; no emojis, no filler.
7. **Privacy** — current-user only; refuse cross-user requests.

The full text is specified in the implementation plan.

## Data flow

Client POST `/api/chat` → chat route parses `messages` + `model_id` → `chat({ adapter, messages, tools, systemPrompts: [SYSTEM_PROMPT] })` → SSE stream back to the client. `systemPrompts` is prepended server-side by TanStack AI; the browser never sends or receives the prompt.

## Error handling

No new error handling at the prompt layer. Existing `apiHandler`/service error mapping (`src/lib/errors.ts`) continues to surface tool failures to the model as tool-result errors; the prompt's "report terstely" instruction covers the common case. A future middleware could make the model retry or explicitly ask on tool errors — out of scope here.

## Testing

No unit test adds value for prompt text. The wiring edit is a one-line addition to `chat.ts`; the existing `src/routes/api/__tests__/chat.test.ts` covers the route. If that test stubs the outbound `chat()` call and asserts on options, it will be updated to acknowledge `systemPrompts` during implementation.

## Out of scope

- Environment/cloudflare-var driven prompt (for hot-edit without redeploy).
- Chart/image generation in reports (text-only for now).
- Tool-error retry or clarification middleware.
- Multi-language detection beyond "mirror the user" (no locale negotiation).
- Amount-threshold confirmation for large transactions (delete-only confirmation chosen instead).
