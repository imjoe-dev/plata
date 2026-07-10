# Spec: Inline Assistant Message Part Rendering

**Status:** Approved
**Created:** 2026-07-09
**Version:** 1.0
**Profile:** mini

---

## 1. Overview

The chat transcript renders assistant messages through `AssistantMessageParts` in `src/components/ui/chat-message-parts.tsx` — a non-composable component backed by helper functions (`getToolCallStatus`, `findToolResult`, `prettyJsonString`/`prettyJsonValue`, `ToolCallView`). These helpers re-derive information TanStack AI already exposes on the message parts: they pair a `tool-call` with a separate `tool-result` part, remap the part's existing `state` into a custom `pending | complete | error` status, and pretty-print JSON with indentation. In this app every tool is client-executed (`.client()`), so the paired `tool-result` branch is effectively dead code and the tool-call part alone carries `state`, `arguments`, and `output`. This refactor removes the abstraction and renders parts inline in the page, reading directly off the parts.

## 2. Acceptance Criteria

- [ ] `src/components/ui/chat-message-parts.tsx` is deleted, along with its test `src/components/ui/__tests__/chat-message-parts.test.tsx`.
- [ ] `src/routes/_protected/index.tsx` renders assistant message parts inline by mapping over `message.parts` in part order — no imported `AssistantMessageParts`/`ToolCallView`, no helper functions, no prop drilling.
- [ ] Each `text` part renders as its own `ChatMessages.AssistantMessage` bubble (no consecutive-text merging / text buffer).
- [ ] Each `tool-call` part renders a `ChatMessages.ToolCall` row reading straight off the part: `part.name`, raw `part.arguments` (no JSON re-parse/re-indent), and `part.output` for the response body.
- [ ] Tool-call status is driven directly by `part.state` — no custom status enum or remapping. The row shows the pending/running indicator until `part.state === "complete"`.
- [ ] Error rendering is **dropped**: in the installed TanStack AI version `ToolCallState` has no `"error"` member (error lives only on a separate `tool-result` part, which is out of scope and which client tools don't emit), so an error branch would be an unrepresentable/dead state. `ChatMessages.ToolCallError` is left unused.
- [ ] The remaining `ChatMessages.*` compound primitives (`ToolCall`, `ToolCallName`, `ToolCallContent`, `ToolCallArgs`, `ToolCallResponse`) are reused unchanged; only the orchestration moves into the page.
- [ ] The composition follows the vercel-composition-patterns skill: no boolean-mode wrapper component, uses `<></>`/inner keys rather than importing `Fragment`.
- [ ] `vp check` and `vp test` pass.

## 3. Out of Scope

- Any change to the `ChatMessages.*` primitives in `src/components/ui/chat-messages.tsx` or their styling/visual design.
- Any change to tool definitions, the chat hook (`use-plata-chat`), or the `/api/chat` server route.
- Introducing new tests for the inlined rendering (the deleted tests covered helpers that no longer exist; page-level test coverage is not added here).
- Supporting server-executed tools / standalone `tool-result` part rendering.

---

_Mini-spec — skips `/plan` and `/task`; proceed to `/implement` on approval._
