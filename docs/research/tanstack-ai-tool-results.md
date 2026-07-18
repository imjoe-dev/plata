# Research: TanStack AI tool-result handling — client vs model payloads, custom part rendering

Resolves #35 (part of #32).

Pinned versions examined: `@tanstack/ai` ^0.28.0, `@tanstack/ai-client` ^0.16.3, `@tanstack/ai-react` ^0.15.4, `@tanstack/ai-openai` ^0.14.1.

Sources: TanStack AI official docs (via context7, `/tanstack/ai`, which indexes `github.com/tanstack/ai/docs`), plus the local usage in `src/routes/api/chat.ts`, `src/hooks/use-plata-chat.ts`, `src/contexts/chat-context.tsx`, `src/components/chat-conversation.tsx`, `src/lib/services/chat.ts`, `src/lib/ai/tools/*`.

---

## Question 1 — Payload split (client payload vs model payload)

### Answer: not supported natively for first-party tools; the recommended mitigation is an `onConfig` middleware that rewrites the tool-result message before each model call.

**What the library does.** A `toolDefinition(...).server(fn)` tool returns a single
payload. The agent loop "automatically calls your tool and feeds the result back to
the model" ([quick-start-server](https://github.com/tanstack/ai/blob/main/docs/getting-started/quick-start-server.md)),
and the same result is streamed to the client as the tool-result chunk that
reconciles into the `tool-call` part's `output`
([tools guide](https://github.com/tanstack/ai/blob/main/docs/tools/tools.md)).
There is no per-tool hook equivalent to Vercel AI SDK's `toModelOutput` (that
feature is Vercel's — see
[ai-sdk.dev subagents](https://ai-sdk.dev/docs/agents/subagents) — and has no
TanStack AI counterpart in 0.28).

**The one native split that exists is MCP-only.** `UIResourcePart` (`ui://`
resources from MCP tools) is "purely presentational and does not enter model
input" ([MCP apps](https://github.com/tanstack/ai/blob/main/docs/mcp/apps.md),
`UIResourcePart` reference). It applies only to MCP servers wired through
`@tanstack/ai-mcp`, not to first-party `toolDefinition` tools, so it is not a fit
for Plata's `render_chart`.

### Recommended mechanism: `onConfig` middleware rewrite

`ChatMiddleware.onConfig` fires before **every** model call
(`ctx.phase === "beforeModel"`, once per agent-loop iteration) and may return a
partial config whose configurable fields explicitly include
`messages: ModelMessage[]`
([middleware guide](https://github.com/tanstack/ai/blob/main/docs/advanced/middleware.md)).
Rewriting there shrinks only the model's view; the SSE stream, the client
transcript, and persistence all keep the full payload, because `onConfig` never
touches output chunks.

```ts
const compactChartResults: ChatMiddleware = {
  name: "compact-chart-results",
  onConfig(ctx, config) {
    if (ctx.phase !== "beforeModel") return;
    return {
      messages: config.messages.map((m) =>
        isToolResultFor(m, "render_chart")
          ? withContent(m, summarizeChartResult(m)) // { rowCount, columns, sampleRows: rows.slice(0, 5) }
          : m,
      ),
    };
  },
};
```

Why this shape wins:

- **Uniform across turns.** It compacts the result both inside the same run
  (agent loop iteration N+1 after the tool executes) and on every later request —
  the client resends full history, `src/routes/api/chat.ts` passes it to `chat()`,
  and the rewrite reapplies per model call. No stored data is ever mutated.
- **Composable.** `onConfig` is piped through middleware in array order, so it
  coexists with the existing `persist-assistant-message` middleware in
  `src/routes/api/chat.ts`.
- **Reversible.** Token budget heuristics (how many sample rows, whether to
  include min/max) live in one server-side function.

### Alternatives considered

1. **Row caps inside the tool** (e.g. `rows.length <= 200`, enforced by the
   tool's `outputSchema`/implementation). Not a substitute — the model would
   still see all 200 rows — but a sane belt-and-braces companion: full rows cross
   the SSE wire, the D1 `chat_messages.content` JSON blob, and the reload fetch,
   so an uncapped query result is a payload problem everywhere, not just in
   model context. Recommended alongside the middleware.
2. **Inverse split via `onChunk`**: have the tool return the compact summary
   (model sees it natively) and side-channel the full rows to the client by
   expanding/replacing the tool-result chunk in `onChunk` (its contract allows
   replace/expand/drop —
   [ChatMiddleware reference](https://github.com/tanstack/ai/blob/main/docs/reference/interfaces/ChatMiddleware.md)),
   with the tool stashing rows keyed by `toolCallId`. Works, but adds a
   cross-request stash, and persistence built from the model-side content would
   store the compact payload — breaking chart re-render on reload. Not
   recommended.
3. **Do nothing** (model sees full rows). Practical limit is model context and
   cost, not a library cap — the docs document no result-size limit. For a
   monthly expense chart (~30–500 rows of JSON) this is survivable but wasteful
   and grows with history since every turn resends every prior tool result.

---

## Question 2 — Custom part rendering for `render_chart`

### How tool parts flow today

1. **Server** (`src/routes/api/chat.ts`): `chat({ adapter, messages, tools, middleware })`
   → `toServerSentEventsResponse(stream)`. Tool execution happens server-side via
   `def.server<ToolContext>(fn)` (`src/lib/ai/tools/transactions.ts`).
2. **Client** (`src/hooks/use-plata-chat.ts`): `useChat` +
   `fetchServerSentEvents("/api/chat")` reconciles the SSE chunks into
   `UIMessage.parts`. A tool call is a single `ToolCallPart` that progresses
   `awaiting-input → input-streaming → input-complete → (approval-requested) → complete`,
   gaining `output` when the result arrives
   ([tool architecture](https://github.com/tanstack/ai/blob/main/docs/tools/tool-architecture.md),
   `ToolCallPart` in the [ai-client API](https://github.com/tanstack/ai/blob/main/docs/api/ai-client.md)):

   ```ts
   interface ToolCallPart {
     type: "tool-call";
     id: string;
     name: string;
     arguments: string; // JSON string, may be partial while streaming
     input?: unknown; // typed from inputSchema when tools are wired client-side
     state: ToolCallState;
     approval?: ApprovalRequest;
     output?: unknown; // typed from outputSchema when tools are wired client-side
   }
   ```

3. **Renderer** (`src/components/chat-conversation.tsx`): assistant messages map
   over `message.parts`; `part.type === "text"` → `ChatMessages.AssistantMessage`,
   `part.type === "tool-call"` → the `ToolCall.*` design-system compound
   (`src/components/ui/tool-call.tsx`), with display state derived by
   `src/lib/ai/tool-call-display-state.ts`.

### What a chart part should be

**Not a new custom part type.** The `MessagePart` union is closed
(`text | image | audio | video | document | tool-call | tool-result | thinking | structured-output | ui-resource` —
[MessagePart reference](https://github.com/tanstack/ai/blob/main/docs/reference/type-aliases/MessagePart.md));
there is no user-extensible "data part" for first-party tools in 0.28. The
idiomatic pattern — shown in the docs' typed-`useChat` example
([tools guide](https://github.com/tanstack/ai/blob/main/docs/tools/tools.md)) —
is to branch on the existing `tool-call` part by `name` and render from its typed
`output`. The chart part is simply:

```ts
// the part the transcript sees (and persists)
{
  type: "tool-call",
  id: "call_abc",
  name: "render_chart",
  arguments: "{...}",            // model-authored chart request
  state: "complete",
  output: {                       // render_chart outputSchema
    spec: { kind: "bar" | "line" | "pie", x: string, y: string, title?: string },
    rows: Array<Record<string, string | number | null>>,
  },
}
```

**Hook-in point**: in the assistant-parts map in
`src/components/chat-conversation.tsx`, a branch _before_ the generic tool-call
branch:

```tsx
if (part.type === "tool-call" && part.name === "render_chart") {
  if (part.output !== undefined) {
    const { spec, rows } = part.output as RenderChartOutput;
    return <ChartMessage key={`${message.id}-${i}`} spec={spec} rows={rows} />;
  }
  // fall through to the generic ToolCall UI for running/approval/error states
}
```

Typing note: `part.output` narrows automatically only when the tool definitions
are wired into the client options
(`createChatClientOptions({ tools: clientTools(...) })` — tool-architecture
docs). `plataChatOptions` currently passes no `tools`, so `output` is untyped;
to wire them, the `toolDefinition` objects must live in a client-safe module
(today `src/lib/ai/tools/transactions.ts` imports `cloudflare:workers`, so the
defs would need to split from the `.server(...)` bindings). Casting through the
tool's `outputSchema` type is an acceptable interim.

### Persistence round-trip — one real gap found

The storage layer itself is lossless: `appendMessage` stringifies the parts array
into `chat_messages.content`, `listMessages` parses it back
(`src/lib/services/chat.ts`), and `chat-context.tsx` feeds it into
`chat.setMessages(...)`. Plain JSON in, plain JSON out — a persisted
`render_chart` part with `output.rows` would re-render fine, and
`getToolCallDisplayState` already tolerates rehydrated parts (missing live
`state` + defined `output` → `"complete"`).

**But the current writer never persists tool parts.** The
`persist-assistant-message` middleware builds the assistant message from
`onFinish`'s `info.content`, and `FinishInfo.content` is documented as
`content: string` — "final accumulated **text** content"
([FinishInfo reference](https://github.com/tanstack/ai/blob/main/docs/reference/interfaces/FinishInfo.md)).
`modelMessageToUIMessage({ role: "assistant", content: string })` therefore
yields a single `TextPart`. Today a reloaded session shows only the assistant's
text — every ToolCall block (and thus any chart) is silently dropped on reload.
This predates charts but becomes user-visible the moment charts exist.

Fix options, in preference order:

1. **Accumulate parts server-side from the stream.** The middleware already sees
   everything: `onChunk` receives every chunk (tool-call start/args, tool
   results, text deltas) and `onAfterToolCall` receives each tool's name/result
   ([ChatMiddleware reference](https://github.com/tanstack/ai/blob/main/docs/reference/interfaces/ChatMiddleware.md)).
   Replace the `info.content`-based write with a middleware that reconciles
   chunks into an ordered parts array (text → tool-call(+output) → text …) and
   persists that in `onFinish`. This preserves the interleaving that
   `uiMessageToModelMessages` needs on the next turn
   ([uiMessageToModelMessages reference](https://github.com/tanstack/ai/blob/main/docs/reference/functions/uiMessageToModelMessages.md)).
2. **Client persistence adapter.** `ChatClient` accepts a `persistence` adapter
   that stores the client's fully reconciled `UIMessage`s
   ([persistence guide](https://github.com/tanstack/ai/blob/main/docs/chat/persistence.md)).
   Faithful by construction, but it inverts Plata's server-authoritative
   persistence (auth, rate limiting, and session rows all live server-side), so
   it would be an architectural change, not a patch.

Note the interaction with Question 1: under the `onConfig` rewrite, the stream —
and therefore option 1's accumulated parts — carry the **full** rows, which is
exactly what reload needs; the compact summary exists only transiently in each
model call's config. The two recommendations compose cleanly.

---

## Summary of recommendations

1. `render_chart` returns `{ spec, rows }` once (full rows, with a hard row cap
   in the tool), and a `compact-chart-results` `onConfig` middleware in
   `src/routes/api/chat.ts` rewrites that tool result to
   `{ rowCount, columns, sampleRows }` before every model call.
2. Render charts by branching on `part.type === "tool-call" && part.name === "render_chart"`
   in `chat-conversation.tsx`, falling back to the generic `ToolCall` UI for
   in-flight/error states. No new part type.
3. Before shipping charts, fix assistant-message persistence: stop deriving parts
   from `FinishInfo.content` (text-only) and accumulate full parts from the
   stream via middleware, so reloaded sessions re-render ToolCall blocks and
   charts losslessly.
