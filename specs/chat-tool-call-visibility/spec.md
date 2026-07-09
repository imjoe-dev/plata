# Spec: Chat Tool-Call Visibility

**Status:** Implemented
**Created:** 2026-07-08
**Version:** 1.0
**Profile:** mini

---

## 1. Overview

The chat assistant already calls 17 tools (CRUD over categories, transactions, and recurring templates) and the tool-call/tool-result parts are streamed to the browser, but the chat page renders only text parts — so users never see what the assistant actually did to their data. This feature surfaces each tool call inside the conversation transcript as a collapsible row (tool name, expandable Arguments/Response detail), with a live pending state while a call runs and a distinct error visual when one fails. It is a user-facing trust and transparency feature, not a debugging aid.

## 2. Acceptance Criteria

- [ ] When an assistant message contains `tool-call` parts, each renders in the transcript using the existing `ChatMessages.ToolCall` kit (collapsible row, wrench icon, raw mono snake_case tool name), interleaved with text parts in part order.
- [ ] Expanding a tool-call row reveals its Arguments (tool input JSON) and Response (result JSON) via the existing `ToolCallArgs`/`ToolCallResponse` blocks.
- [ ] Each `tool-call` part is paired with its result: the matching `tool-result` part by `toolCallId`, falling back to the `ToolCallPart.output` field for client-executed tools.
- [ ] While a call is in flight (state `awaiting-input`, `input-streaming`, or `input-complete`, or result still `streaming`), the row shows a visible pending indicator; it settles to the normal appearance once complete.
- [ ] When a call fails (`ToolResultPart.state === 'error'`), the row gets a distinct error visual using the design system's negative/error tokens (new kit variant), and expanding it shows the error detail.
- [ ] Rows follow the design system: zero radius, hairline borders, dark theme tokens, mono meta labels (per `components.md`).
- [ ] Component/rendering behavior is covered by tests (pending, complete, and error states; pairing by `toolCallId`), runnable via `vp test`.
- [ ] Storybook stories for any new visual states (pending, error) accompany the existing ToolCall stories.

## 3. Out of Scope

- Persisting chat or tool-call history to D1 — the dormant `chat_sessions`/`chat_messages` schema stays unused; display is live-session only.
- Approve/deny UI for the `approval-requested` tool state — the LLM continues confirming destructive actions conversationally per the system prompt.
- Humanized tool-name labels — raw snake_case names stay.
- Any server or streaming-protocol changes — the data already reaches the client.

---

_Next step: mini profile — run `/implement specs/chat-tool-call-visibility/spec.md` directly (skips `/plan` and `/task`)._
