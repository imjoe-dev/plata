# Research: TanStack AI tool-result flow — client rendering and persistence

Ticket: [#41](https://github.com/imjoe-dev/plata/issues/41) · Date: 2026-07-18

**Pinned versions** (resolved in `pnpm-lock.yaml`): `@tanstack/ai@0.28.0`, `@tanstack/ai-client@0.16.3`, `@tanstack/ai-react@0.15.4`, `@tanstack/ai-openai@0.14.1`. All four were published together from TanStack/ai monorepo commit [`16f661cceb`](https://github.com/TanStack/ai/tree/16f661cceb) (verified against each package's `package.json` at that commit); every library citation below is to that commit. Local claims are against this repo at `main` (`4470b8c`).

## TL;DR

1. **Yes — custom per-tool UI is idiomatic.** Assistant `UIMessage.parts` carry a `tool-call` part with `name`, `state`, and a parsed `output` object; the branch point already exists in `src/components/chat-conversation.tsx:61`, and the library-documented pattern is to narrow further on `part.name`.
2. **The model sees the full tool result — there is no built-in model/client payload split.** The same value returned by `execute` is streamed to the client and serialized verbatim into the model's context on every subsequent turn. Capping requires either returning a summary + `context.emitCustomEvent` for the bulk, or a `ChatMiddleware.onConfig` transform of `role:"tool"` messages.
3. **No — tool-call parts do NOT survive persistence today.** The writer rebuilds the assistant message from `FinishInfo.content`, which in 0.28.0 is _final-iteration accumulated text only_. A chart rendered from `part.output` disappears on session reload. Fix: persist from `ctx.messages` via `modelMessagesToUIMessages` instead.

---

## 1. Rendering a specific tool's result as custom UI

### The part shape (library)

A server-side tool execution materializes on the client as **two sibling parts** inside the assistant `UIMessage.parts` array ([`packages/ai-client/src/types.ts`](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai-client/src/types.ts)):

```ts
// tool-call part (typed variant, lines 158–175; untyped fallback is identical with any)
{
  type: 'tool-call'
  id: string
  name: T['name']            // discriminant for per-tool narrowing
  arguments: string          // JSON string (may be incomplete mid-stream)
  input?: InferToolInput<T>  // parsed, typed input (client-layer enrichment)
  state: ToolCallState       // 'awaiting-input' | 'input-streaming' | 'input-complete'
                             //   | 'approval-requested' | 'approval-responded' | 'complete'
  approval?: { id: string; needsApproval: boolean; approved?: boolean }
  output?: InferToolOutput<T> // parsed result object — set when the tool finishes
}

// tool-result part (lines 220–226)
{ type: 'tool-result'; toolCallId: string; content: string | ContentPart[];
  state: 'streaming' | 'complete' | 'error'; error?: string }
```

Result delivery: the server emits `TOOL_CALL_END` / `TOOL_CALL_RESULT` with a **string** payload (`JSON.stringify` of the execute return — AG-UI spec, [`chat/index.ts` lines 1663–1763](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/activities/chat/index.ts)); the client `StreamProcessor` `JSON.parse`s it back, so **`part.output` is a parsed object**, and sets the tool-call part to `state: 'complete'` ([`stream/processor.ts` lines 1170–1257](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/activities/chat/stream/processor.ts)).

Caveat: `'error'` is **not** a `ToolCallState` — errors live on the tool-result part (`ToolResultState: 'error'`); the tool-call part is set to `state: 'input-complete'` with `output: { error }` (`updateToolCallWithOutput`, [`stream/message-updaters.ts` lines 211–235](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/activities/chat/stream/message-updaters.ts)). Our `getToolCallDisplayState` (`src/lib/ai/tool-call-display-state.ts`) branches on `state === "error"`, which per 0.28.0 never fires on the tool-call part; its `part.output !== undefined → "complete"` fallback is what actually catches finished calls.

### The branch point (this repo)

`src/components/chat-conversation.tsx` already iterates assistant `message.parts` with a `part.type === "text"` arm (line 54, note text parts use `content`, not `text`) and a `part.type === "tool-call"` arm (line 61) that renders the generic `ToolCall.*` composition from `part.name` / `part.arguments` / `part.output` / `part.state` / `part.approval`. Messages arrive via `useChat` (`@tanstack/ai-react`) → `usePlataChat` (`src/hooks/use-plata-chat.ts`) → `ChatProvider` (`src/contexts/chat-context.tsx`).

The library-documented pattern ([`docs/tools/tools.md`](https://github.com/TanStack/ai/blob/16f661cceb/docs/tools/tools.md), [`docs/tools/client-tools.md`](https://github.com/TanStack/ai/blob/16f661cceb/docs/tools/client-tools.md)) is discriminated-union narrowing on `part.name`:

```ts
if (part.type === "tool-call" && part.name === "list_transactions") {
  // part.output typed as the tool's outputSchema | undefined
  if (part.output) return <TransactionsChart data={part.output.transactions} />;
}
```

So a chart for e.g. `list_transactions` is an additional `part.name` branch inside the existing `tool-call` arm, rendering from `part.output` once `displayState === "complete"`, with the generic `ToolCall.*` UI as the fallback for other tools. Full typing of `part.output` comes via `clientTools(...)` / the `TTools` generic on `createChatClientOptions` (`packages/ai-client/src/types.ts` lines 558–606); today `plataChatOptions` doesn't declare client-side tool types, so `output` is `any` until that's wired.

**Answer 1: Yes.** Part shape: `{ type: "tool-call", name, arguments, state, approval?, output? }` with `output` a parsed object; branch point is the `part.type === "tool-call"` arm at `chat-conversation.tsx:61`, narrowed by `part.name`.

## 2. What the model sees vs. the client

One value serves both destinations. Server-side, `buildToolResultChunks` takes the `execute` return, appends it to the model conversation as `{ role: 'tool', content, toolCallId }` **and** emits the same string on the wire to the client ([`chat/index.ts` lines 1670–1759](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/activities/chat/index.ts)).

On subsequent turns the client posts the **full `UIMessage[]` history** back (`ChatFetcherInput.messages` — "full UIMessage history (not a delta)", `packages/ai-client/src/types.ts` line 28). Our route (`src/routes/api/chat.ts`) passes it through `convertMessagesToModelMessages` → `uiMessageToModelMessages` ([`chat/messages.ts`](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/activities/chat/messages.ts)): tool-call parts become assistant `toolCalls` (name + arguments), and tool outputs become `role: 'tool'` messages — a tool-call part with `output` and no sibling tool-result part yields `{ role: 'tool', content: normalizeToolResult(part.output) }` (lines 340–347), i.e. `JSON.stringify` of the whole object. The OpenAI adapter then forwards that string **verbatim** as a Responses API `{ type: 'function_call_output', call_id, output }` item ([`packages/openai-base/src/adapters/responses-text.ts` lines 1690–1777](https://github.com/TanStack/ai/blob/16f661cceb/packages/openai-base/src/adapters/responses-text.ts)).

**There is no built-in split.** The `Tool` interface in 0.28.0 is exactly `{ name, description, inputSchema?, outputSchema?, execute?, needsApproval?, lazy?, metadata? }` ([`packages/ai/src/types.ts` lines 547–661](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/types.ts)) — no `toModelOutput`, no `clientOutput`, no artifact/data parts, no result-transform hook. Our `list_transactions` (`src/lib/ai/tools/transactions.ts:154`) returns up to 100 full `TransactionRow` objects, so that entire rows payload re-enters the model context on every later turn.

Mechanisms that do exist in 0.28.0 for capping:

- **Summary + custom events**: `execute` receives `context.emitCustomEvent(name, value)` (`ToolExecutionContext`, `packages/ai/src/types.ts` lines 489–518), streamed to the client as AG-UI CUSTOM events and received via the `onCustomEvent` client/useChat option. Custom events are **not** part of the message history, so they never reach the model — return a compact summary from `execute` (model + transcript) and emit the bulk rows for the chart. Trade-off: the bulk payload is also not in `parts`, so it won't persist/rehydrate by itself.
- **`ChatMiddleware.onConfig`**: runs before _every_ model iteration and may transform `config.messages` ([`middleware/types.ts` lines 354–361](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/activities/chat/middleware/types.ts)) — the seam to truncate/summarize bulky `role: 'tool'` contents server-side while the client keeps the full `part.output`. This caps the _model_ context without touching what the client renders.
- `ChatMiddleware.onBeforeToolCall` can return `{ type: 'skip', result }` to substitute a result entirely.

**Answer 2:** The model sees the full stringified tool result, identical to the client's `part.output`, on every subsequent turn. No first-class model/client split exists in 0.28.0; capping is achievable via summary-return + `emitCustomEvent`, or by rewriting `role:"tool"` message content in `onConfig` middleware (which keeps the client payload intact — the better fit for a chart tool).

## 3. Do tool-call parts survive persistence? **No.**

### The writer

`src/routes/api/chat.ts:51–60` — the `persist-assistant-message` middleware:

```ts
onFinish: async (_ctx, info) => {
  const assistantMessage = modelMessageToUIMessage({ role: "assistant", content: info.content });
  await appendMessage(userId, session_id, "assistant", assistantMessage.parts);
},
```

`appendMessage` (`src/lib/services/chat.ts:62`) stores `JSON.stringify(parts)` in `chat_messages.content` (role enum `["user","assistant"]`, `src/db/schema.ts:220`). Reload path: `GET /api/chat/sessions/$sessionId/messages` → `listMessages` (`chat.ts:129`, `JSON.parse` back to `MessagePart[]`) → `chat.setMessages(data)` in `ChatProvider` (`src/contexts/chat-context.tsx:39–51`).

### Why tool parts are dropped

In 0.28.0, `FinishInfo.content` is **"Final accumulated text content"** — a `string` ([`middleware/types.ts` lines 279–288](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/activities/chat/middleware/types.ts)). The engine builds it exclusively from `TEXT_MESSAGE_CONTENT` events and **resets it to `''` at the start of every agent-loop iteration** (`beginIteration()`, [`chat/index.ts` line 910](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai/src/activities/chat/index.ts); accumulation at lines 1123–1130; `onFinish` call at line 828). So `info.content` is the final iteration's prose only. `modelMessageToUIMessage` over that yields a single text part: **every tool-call, every tool result, and any pre-tool-call text is silently dropped from the persisted assistant message.**

Consequence: a chart rendered from `part.output` during the live stream **does not re-render after a session reload** — the rehydrated assistant message has no `tool-call` part at all (today even the generic `ToolCall` box vanishes). Note this contradicts ADR-0003's description of the `content` column holding "the full `UIMessage.parts` array (text, tool-call, tool-result, in order)" — that is the intent, not the current behavior. (The route test `src/routes/api/__tests__/chat.test.ts:213` only exercises a text part, so the gap is untested.)

### What has to change, precisely

The full turn is available in the middleware's **first** argument: `ChatMiddlewareContext.messages: ReadonlyArray<ModelMessage>` (`middleware/types.ts` line 115), which by `onFinish` time includes the assistant tool-call messages and the appended `role: 'tool'` result messages (`chat/index.ts` lines 1513, 1745). The library converter that reassembles them is `modelMessagesToUIMessages` (plural — exported from `@tanstack/ai`): it merges each `role:'tool'` message into the preceding assistant UIMessage, setting `toolCallPart.output = JSON.parse(content)` and `state: 'complete'`, plus the sibling `tool-result` part (`chat/messages.ts` lines 472–496).

Concretely, in `src/routes/api/chat.ts`:

```ts
onFinish: async (ctx, _info) => {
  const newModelMessages = ctx.messages.slice(requestMessageCount); // everything after this turn's input
  const [assistantMessage] = modelMessagesToUIMessages(newModelMessages);
  await appendMessage(userId, session_id, "assistant", assistantMessage.parts);
},
```

(`requestMessageCount` = length of the converted request history, captured before `chat()`; multi-iteration turns collapse into one assistant UIMessage because the converter merges consecutive assistant/tool messages.)

Rehydration fidelity after that change: `output` survives (JSON round-trip), `state` is recomputed to `'complete'` (fine — `getToolCallDisplayState` maps it to `"complete"`), but **`approval` is lost** in ModelMessage conversion — the engine's own comment says the parts array "which contains approval state) is lost during conversion" (`chat/index.ts` ~line 1531). So a _denied_ call won't rehydrate as "denied" (it leaves no `role:'tool'` message, so it surfaces as a resultless tool-call part). If denied-state fidelity matters, the writer must capture the UIMessage-level parts (e.g. persist from the client snapshot or extend the middleware data) rather than the ModelMessage view. For the chart use case, `output` + `state:'complete'` round-tripping is sufficient.

For contrast, the library's own persistence surfaces (`initialMessages` option; `ChatClientPersistence` adapter + `ChatPersistor`, [`docs/chat/persistence.md`](https://github.com/TanStack/ai/blob/16f661cceb/docs/chat/persistence.md), [`client-persistor.ts`](https://github.com/TanStack/ai/blob/16f661cceb/packages/ai-client/src/client-persistor.ts)) store the `UIMessage[]` verbatim — tool parts, `output`, `approval` and all — and nothing re-executes on hydration. We deliberately bypassed that adapter (ADR-0003, blob-per-conversation contract); the fix above keeps the ADR's architecture and only corrects what the writer serializes. The only library-documented serialization caveat is `UIMessage.createdAt` being a `Date` (revive on read); our rows don't persist it.

**Answer 3: No** — tool-call parts do not survive persistence today; a tool-result chart would not re-render after reload. The precise change: build the persisted assistant parts from `ctx.messages` (post-request slice) via `modelMessagesToUIMessages`, instead of from `info.content` via `modelMessageToUIMessage`. Approval state additionally requires a UIMessage-level capture if needed.

## Confidence

- **Q1 — High.** Types and rendering pattern read directly from `@tanstack/ai-client` source and docs at the pinned release commit; local branch point verified in current code.
- **Q2 — High** on "no built-in split" (the `Tool` interface and `buildToolResultChunks` are explicit) and on the conversion path; **Medium-high** on the escape hatches as _recipes_ — `emitCustomEvent` and `onConfig` are verified APIs, but no official doc spells out the "summary + big payload" pattern.
- **Q3 — High.** `FinishInfo.content`'s text-only, per-iteration-reset semantics are explicit in engine source; the local writer path is fully traced. The proposed fix uses verified exports, though `requestMessageCount` slicing should be validated with an integration test (multi-tool and approval flows).

## Sources

Library — all at [TanStack/ai@`16f661cceb`](https://github.com/TanStack/ai/tree/16f661cceb) (release commit of the four pinned versions):

- `packages/ai-client/src/types.ts` — `ToolCallPart`, `ToolResultPart`, `ToolCallState`, `UIMessage`, `ChatClientPersistence`, `ChatFetcherInput`
- `packages/ai/src/types.ts` — `Tool`, `ToolExecutionContext` (`emitCustomEvent`), `ModelMessage`, `ToolCall`
- `packages/ai/src/activities/chat/index.ts` — `chat()` / `TextEngine`, `buildToolResultChunks`, `accumulatedContent` reset, `onFinish` invocation
- `packages/ai/src/activities/chat/messages.ts` — `convertMessagesToModelMessages`, `uiMessageToModelMessages`, `modelMessageToUIMessage`, `modelMessagesToUIMessages`
- `packages/ai/src/activities/chat/middleware/types.ts` — `ChatMiddleware`, `FinishInfo`, `ChatMiddlewareContext`
- `packages/ai/src/activities/chat/stream/processor.ts`, `stream/message-updaters.ts` — client event → part application
- `packages/ai/src/utilities/tool-result.ts`, `utilities/ag-ui-wire.ts`, `stream-to-response.ts`
- `packages/openai-base/src/adapters/responses-text.ts`, `packages/ai-openai/src/adapters/text.ts` — provider serialization (`function_call_output`)
- `packages/ai-react/src/use-chat.ts`, `packages/ai-client/src/client-persistor.ts`
- Docs: `docs/tools/tools.md`, `docs/tools/client-tools.md`, `docs/chat/persistence.md`

Repo (`main` @ `4470b8c`): `src/components/chat-conversation.tsx`, `src/lib/ai/tool-call-display-state.ts`, `src/hooks/use-plata-chat.ts`, `src/contexts/chat-context.tsx`, `src/routes/api/chat.ts`, `src/lib/services/chat.ts`, `src/lib/repositories/chat-messages.ts`, `src/db/schema.ts`, `src/lib/ai/tools/{transactions,index}.ts`, `docs/adr/0003-chat-persistence-bypasses-tanstack-ai-adapter.md`, `src/routes/api/__tests__/chat.test.ts`.
