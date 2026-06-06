# TanStack AI Chat API — Design

**Date:** 2026-06-06
**Status:** Approved

## Goal

Integrate TanStack AI into the app. First step: a single streaming chat API endpoint with Zod validation, using OpenAI as the provider.

## Packages

| Package               | Purpose                        |
| --------------------- | ------------------------------ |
| `@tanstack/ai`        | Core chat/streaming primitives |
| `@tanstack/ai-openai` | OpenAI adapter                 |
| `zod`                 | Request body validation        |

Installed via `vp add`.

## API Route

**File:** `src/routes/api/chat.ts`

**Method:** `POST`

**Request body:**

```ts
{
  modelId: "gpt-4o" | "gpt-4o-mini" | "gpt-5.2",
  messages: Array<{
    role: "user" | "assistant" | "tool",
    content: string | Array<TextPart | ImagePart>
  }>
}
```

**Response:** Server-Sent Events (SSE) stream via `toServerSentEventsResponse()`.

**Pattern:** Follows existing `src/routes/api/auth/$.ts` — `createFileRoute` with `server.handlers.POST`.

## Validation (Zod)

Custom schemas (TanStack AI does not export built-in Zod schemas):

- `ContentPartSchema` — discriminated union for text and image parts
- `MessageSchema` — `{ role, content }` matching `ModelMessage` type
- `BodySchema` — `{ modelId, messages }`

The `modelId` enum is built from a const array, making it trivial to add models/providers later.

## Provider Abstraction

An adapter lookup map keyed by model ID. Today: OpenAI models only. To add Anthropic later: install `@tanstack/ai-anthropic`, add its models to the map and the Zod enum.

```
adapters: Record<ModelId, () => TextModelAdapter> = {
  "gpt-4o": () => openaiText("gpt-4o"),
  "gpt-4o-mini": () => openaiText("gpt-4o-mini"),
  "gpt-5.2": () => openaiText("gpt-5.2"),
}
```

## Environment

Requires `OPENAI_API_KEY` in `.env.local` (already exists, just add the key).

## Out of Scope

- No database writes (chat history persistence)
- No `useChat` frontend hook
- No tools, system prompts, or structured output
- No multi-provider routing (pattern exists, not wired)

## Error Handling

- Zod parse errors → 400 with validation details
- Missing `OPENAI_API_KEY` → 500 (caught at adapter init)
- Stream errors → propagate via SSE error event or status
