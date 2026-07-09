# Validation: Chat Tool-Call Visibility

**Spec:** [./spec.md](./spec.md) (v1.0) | **Plan:** — (mini)
**Date:** 2026-07-08
**Verdict:** PASS WITH FINDINGS

## Test Run

- Command: `vp test`
- Result: 29 test files passed, 188 tests passed, 0 failed (includes the 20 new tests in `src/components/ui/__tests__/chat-message-parts.test.tsx`)
- Command: `vp check`
- Result: pass — all 166 files correctly formatted; no lint or type errors in 121 files

## Traceability Matrix

| Story | Criterion                                                                                                                         | Evidence                                                                                                                                                                                                                                                                                       | Test                                                                                                                                                                                                                                                                                                                   | Status |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| mini  | Tool-call parts render via existing `ChatMessages.ToolCall` kit, interleaved with text in part order                              | `src/components/ui/chat-message-parts.tsx:95-122` (`AssistantMessageParts`), wired in `src/routes/_protected/index.tsx:59`; raw mono name via `src/components/ui/chat-messages.tsx:202-210`                                                                                                    | `chat-message-parts.test.tsx › AssistantMessageParts › interleaves text and tool-call parts in part order`; `› renders the raw tool name in the row`                                                                                                                                                                   | ✓      |
| mini  | Expanding reveals Arguments/Response via `ToolCallArgs`/`ToolCallResponse`                                                        | `src/components/ui/chat-message-parts.tsx:74-85`; `src/components/ui/chat-messages.tsx:264-284`                                                                                                                                                                                                | `chat-message-parts.test.tsx › ToolCallView › reveals pretty-printed arguments and response when expanded`; `› expands on click to reveal the detail panel`                                                                                                                                                            | ✓      |
| mini  | Pairing by `toolCallId`, fallback to `ToolCallPart.output` for client tools                                                       | `src/components/ui/chat-message-parts.tsx:21-28` (`findToolResult`), `:45-49` (`responseText` output fallback)                                                                                                                                                                                 | `chat-message-parts.test.tsx › findToolResult › pairs a tool-call with its tool-result by toolCallId`; `› ToolCallView › falls back to ToolCallPart.output when no tool-result part exists`; `› AssistantMessageParts › pairs each tool-call row with its own result by toolCallId`                                    | ✓      |
| mini  | Pending indicator for `awaiting-input`/`input-streaming`/`input-complete` or result `streaming`; settles when complete            | `src/components/ui/chat-message-parts.tsx:13-18` (`getToolCallStatus`); spinner + `running` label in `src/components/ui/chat-messages.tsx:211-219`                                                                                                                                             | `chat-message-parts.test.tsx › getToolCallStatus › is pending while tool input is streaming` (covers all three call states); `› ToolCallView › shows a pending indicator while the call is in flight`; `› shows a pending indicator while the result is streaming`; `› settles to the normal appearance once complete` | ✓      |
| mini  | Error state (`ToolResultPart.state === 'error'`) gets distinct negative-token visual (new kit variant) and error detail on expand | `variant="error"` on `ToolCall`/`ToolCallName` (`src/components/ui/chat-messages.tsx:238-253`, `:185-235`), new `ToolCallError` block (`:286-295`); selected in `src/components/ui/chat-message-parts.tsx:65-79`                                                                               | `chat-message-parts.test.tsx › ToolCallView › marks the row as error and reveals the error detail on expand`; `› getToolCallStatus › is error when the paired result errored`                                                                                                                                          | ✓      |
| mini  | Design system conformance: zero radius, hairline borders, dark tokens, mono meta labels                                           | No `rounded-*` classes introduced; `border-hairline`/`border-negative/40` (`chat-messages.tsx:247`), mono `text-[10px]` meta labels for `running`/`error`/`Arguments`/`Response`/`Error` (`chat-messages.tsx:212, 221, 267, 278, 289`); square (zero-radius) spinner (`chat-messages.tsx:215`) | Visual criterion — verified by inspection against `components.md`; eyeball via Storybook `ToolCallPending`/`ToolCallError` stories                                                                                                                                                                                     | ✓      |
| mini  | Rendering behavior covered by tests (pending, complete, error, pairing), runnable via `vp test`                                   | `src/components/ui/__tests__/chat-message-parts.test.tsx` (20 cases); `vitest.config.ts:16` widened to include `.tsx`                                                                                                                                                                          | Entire file passes under `vp test` (20/20)                                                                                                                                                                                                                                                                             | ✓      |
| mini  | Storybook stories for new visual states (pending, error) alongside existing ToolCall stories                                      | `src/components/ui/chat-messages.stories.tsx:145-181` (`ToolCallPending`, `ToolCallError`)                                                                                                                                                                                                     | Stories typecheck under `vp check`; not executed (Storybook not run as part of validation)                                                                                                                                                                                                                             | ✓      |

## Drift Findings

### Unmet requirements (spec → code)

- None. All eight acceptance criteria have evidence and (where testable) passing tests.

### Scope creep (code → spec)

- `vite.config.ts:16` — added `fmt.ignorePatterns: ["src/routeTree.gen.ts"]`, plus the accompanying regeneration churn in `src/routeTree.gen.ts` (~510 lines of quote-style churn, no route changes). Not mentioned in the spec. Implementer flagged it as a fix for pre-existing `vp check` breakage (the generator emits single quotes per `tanstackStart.router.quoteStyle: 'single'` while oxfmt reformatted the file to double quotes, so the two tools fought). Justified and small, but it is a repo-wide toolchain change riding on a UI feature — worth a note in the commit message or a `/revise` acknowledgment.
- `vitest.config.ts:16` — test include widened from `src/**/*.test.ts` to `src/**/*.test.{ts,tsx}`. Required to satisfy the spec's own "runnable via `vp test`" criterion for a `.tsx` test file; effectively implied scope, not creep in substance.
- `src/components/ui/chat-message-parts.tsx:96-119` — consecutive text parts merge into a single assistant bubble. The spec only says "interleaved with text parts in part order"; merging is a reasonable rendering choice and order is preserved. Informational only.

### Plan deviations

- Not applicable (mini profile — no plan.md).

### Convention drift

- None found. New code uses the documented tokens (`text-negative`, `border-hairline`, `bg-raised`, `bg-sunken`), mono `text-[10px]` meta labels, and introduces no border radius, matching `components.md` and the surrounding kit.

### Observations (non-blocking)

- `getToolCallStatus` (`src/components/ui/chat-message-parts.tsx:13-18`) maps the `approval-requested`/`approval-responded` call states to `pending`, so such a call would show a `running` spinner indefinitely. The spec explicitly puts approval UI out of scope and the system prompt confirms destructive actions conversationally, so these states should not occur in practice — recording for completeness.

## Recommended Actions

- No ✗ criteria; nothing to re-open with `/implement`.
- Take the `vite.config.ts` fmt ignore + `routeTree.gen.ts` regeneration to `/revise` (or a standalone chore commit) to legitimize the toolchain fix outside this feature's spec.
- Mark `spec.md` `**Status:** Implemented` once the findings are acknowledged.
- Optional: eyeball the new `ToolCallPending`/`ToolCallError` Storybook stories in a running Storybook, since design-system conformance was verified by inspection only.
