# Chat persistence via REST, not @tanstack/ai's `persistence` adapter

Status: accepted

`@tanstack/ai` ships a built-in client persistence mechanism (`ChatClientPersistence`: `getItem`/`setItem`/`removeItem`, keyed by conversation id, wired via `useChat`'s `persistence` option). We are **not** using it for message hydration or writes.

That adapter's contract is blob-per-conversation: `setItem` replaces the _entire_ `UIMessage[]` array on every change to the message list, which is built for KV/localStorage-style storage. `chat_messages` is a normalized, row-per-message table (`session_id` FK, `created_at` index) — wiring the adapter up would mean diffing/upserting the whole array on every streamed update, or reimplementing that diffing ourselves, for no benefit over writing at explicit boundaries.

Instead: reads go through a new `GET /api/chat/sessions/:sessionId/messages` REST endpoint (same repository → service → route shape as transactions/categories), fetched client-side with TanStack Query and passed into `useChat`'s separate `initialMessages` option. Writes are explicit, not driven by the library's change-detection: the user's message is persisted as part of the same `POST /api/chat` call that creates the session (see ADR-0002), and the assistant's message is persisted once as a whole, only on full stream completion — never per-chunk.

A message row's `content` column stores `JSON.stringify(parts)` — the full `UIMessage.parts` array (text, tool-call, tool-result, in order) — for both roles uniformly. There is deliberately no `role: "tool"` in `chat_messages.role`: that role only exists at the `ModelMessage` (LLM wire-protocol) layer, synthesized on demand by `@tanstack/ai`'s `uiMessageToModelMessages()` from a stored assistant message's parts array whenever `chat()` needs full LLM-facing history. It is derived, not persisted state.

**Revisit if:** the library's `persistence` adapter contract changes to support incremental/append-only writes, or if `chat_messages` ever needs to move to blob-per-conversation storage for an unrelated reason.
