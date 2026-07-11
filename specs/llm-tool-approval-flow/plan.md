# Plan: LLM Tool Approval Flow

**Spec:** [./spec.md](./spec.md)
**Mode:** brownfield
**Status:** Approved
**Created:** 2026-07-11
**Version:** 1.0

---

## 1. Overview

The installed tool-calling SDK, `@tanstack/ai@0.28.0` (with `@tanstack/ai-client@0.16.3` / `@tanstack/ai-react@0.15.4`), already ships a native human-in-the-loop mechanism — a `needsApproval` flag on `toolDefinition()` and an `addToolApprovalResponse()` client method — that does exactly what spec §5–§6 requires: pausing execution mid-stream, resuming on decision, and auto-feeding a denial back to the LLM as a tool result. This plan does **not** introduce any new pause/resume machinery, server route, or persistence. The work is three narrow, additive changes: (1) flag the 11 mutating tool definitions with `needsApproval: true`, (2) rebuild `ChatMessages.ToolCall` as a set of small, self-guarding compound children that each take the raw `ToolCallPart` as a plain prop — replacing the current `variant`/`pending` boolean-prop pair without reaching for React Context, since nothing here needs dependency injection or non-nested siblings (see §6 for why Context was considered and rejected), and (3) remove the now-redundant "narrate deletes in text" system-prompt instruction (spec §7). See spec.md §2 Goals for the full requirement list this satisfies.

## 2. Codebase Context

**Affected modules:**

- `src/lib/ai/tools/categories.ts`, `transactions.ts`, `recurring-templates.ts` — add `needsApproval: true` to the 11 mutating `toolDefinition()` calls (create/update/delete for each of the three entities, plus activate/pause for recurring templates). The 6 read-only definitions (`list_*`, `get_*`) are untouched.
- `src/lib/ai/system-prompt.ts` — rewrite the "Acting with care" section (lines 36–44) to drop the text-confirmation instruction for deletes and the "run immediately" framing for create/update/activate/pause, since none of those now run immediately.
- `src/components/ui/chat-messages.tsx` — rebuild the `ToolCall*` family as self-guarding children that each take the raw `part: ToolCallPart` as a plain prop (plus `onApprove`/`onDeny` where relevant) and derive their own rendering via a shared pure helper, `getToolCallDisplayState(part)`, replacing the current `variant`/`pending` prop pair. See §6 for the full component contract.
- `src/routes/_protected/index.tsx` — the `part.type === "tool-call"` branch (lines 66–81) collapses to one static composed tree, passing `part` (and `onApprove`/`onDeny`) directly to `ChatMessages.ToolCall` and each of its children, reused identically for every tool-call part; the route stops computing `pending`/variant values itself, and never computes `displayState` either — that's the children's job via the shared helper.

**Integration points:**

- `needsApproval` is a field on the shared `toolDefinition()` config in each `tools/*.ts` file — it applies identically whether the definition is later wrapped by `.server()` (used server-side in `src/routes/api/chat.ts`'s `allToolDefinitions`) or `.client()` (used in `src/lib/ai/tools/client.ts`'s `allClientTools`). One flag per tool covers both execution paths; no duplication.
- `usePlataChat()` (`src/hooks/use-plata-chat.ts:34-40`) already spreads the full `useChat()` return value, so `addToolApprovalResponse` is available to `HomePage` in `src/routes/_protected/index.tsx` with no hook changes.
- `isLoading` is already reset to `false` when the stream pauses at an approval request (library-internal), so the existing `handleSubmit` guard (`index.tsx:15-19`) already composes correctly with pending approvals — chat input stays usable (spec US-004) with no change needed there.

**Existing conventions to follow:**

- **Compound-component namespace with self-guarding children, not boolean-prop combinations** — this codebase has a related precedent in `PromptInput.Root` (`src/components/ui/prompt-input.tsx`), where children read shared state and render `null` if their condition isn't met, rather than the route computing what to show. This feature follows the same _self-guarding_ spirit, but deliberately skips `PromptInput`'s `createContext`/`useContext` machinery: `PromptInput.Toolbar`/`EditorSlot` share a genuinely expensive, stateful resource (a tiptap `editor` instance) they can't cheaply recompute, whereas `ToolCall`'s children all just need the same already-available `part` value, one level deep, from a single call site — passing it as a plain prop is simpler and sufficient. See §6 for the full reasoning on why Context was considered and rejected here.
- Compound-component namespace pattern (`ChatMessages.X`) for all chat UI pieces — new approval elements are added to the same `ChatMessages` object in `chat-messages.tsx`, not a new file.
- Design tokens are fixed in `src/styles.css`'s `@theme` block — no new colors are needed; `--color-caution` and `--color-info` already exist and are unused elsewhere in chat UI, making them available for the two new states.

**Reusable code and utilities:**

- `Button` (`src/components/ui/button.tsx`) — `variant="primary"` for Approve, `variant="destructive"` for Deny, `size="sm"` to fit the compact tool-call card.
- `Collapsible` from `@base-ui/react/collapsible`, already used by `ToolCall`/`ToolCallContent` — supports a controlled `open` prop; `ToolCall` now derives this itself from `getToolCallDisplayState(part)` rather than the route passing an `open`/force-expand decision in.

**Test setup:**

- Vitest via `vp test run`, imports from `vite-plus/test`. Tool-definition shape tests live in `src/lib/ai/tools/__tests__/{categories,transactions,recurring-templates}.test.ts`; the chat route test (`src/routes/api/__tests__/chat.test.ts`) asserts on the shape of the `chat()` call. Per explicit scope decision for this pass, no test coverage (unit, component, or Storybook) is added for the new UI — see §6.

## 3. Tech Stack

_Existing stack, listed as constraints — no new dependencies or version changes are introduced by this feature._

| Layer                  | Existing                                                    | Version                  | Constraint                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool-calling SDK       | `@tanstack/ai`, `@tanstack/ai-client`, `@tanstack/ai-react` | 0.28.0 / 0.16.3 / 0.15.4 | Native `needsApproval` + `addToolApprovalResponse` mechanism already present in the installed version — confirmed against shipped `.d.ts`/`.js` and Context7 docs (`/tanstack/ai`), not assumed from a newer API.                                                                                                                             |
| UI Primitives          | `@base-ui/react` (Collapsible, Button)                      | current                  | Approve/Deny controls and the forced-open pending-approval card reuse existing primitives; no new primitive needed.                                                                                                                                                                                                                           |
| Framework              | TanStack Start (React 19), file-based routing               | current                  | No new state/context APIs added — the route component shrinks (drops per-part `pending`/variant computation) by passing the already-available `part` straight through as a prop.                                                                                                                                                              |
| Component Architecture | Compound component, plain props, self-guarding children     | —                        | Related to the existing `PromptInput.Root` precedent (`src/components/ui/prompt-input.tsx`) but deliberately lighter-weight — no `createContext`/provider, since no dependency-injection or non-nested-sibling use case exists here (see §6). Replaces the current `ToolCallVariant`/`pending` boolean-prop pair on `ChatMessages.ToolCall*`. |
| Styling                | Tailwind CSS v4 `@theme` tokens + `cva`                     | current                  | New visual states map to existing `--color-caution` / `--color-info` tokens; no new tokens added. `cva` remains in use _inside_ leaf presentational children, not as an externally-passed variant prop.                                                                                                                                       |
| Testing                | Vitest via `vp test run`                                    | current                  | Existing tool-definition test files gain `needsApproval` assertions (see §6); no new component/interaction tests in this pass.                                                                                                                                                                                                                |

## 4. Data Models

Spec §5 defines two conceptual entities, `ToolCall` and `Approval`. Neither becomes a new persisted or hand-rolled type — both map directly onto the tool-calling library's existing `ToolCallPart` type, which this feature does not modify. The genuinely new contract this feature introduces is a **client-side derived display state**, computed from `ToolCallPart` at render time.

### ToolCallPart (existing library type, `@tanstack/ai` — unmodified)

| Field       | Type                                                                      | Notes                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`      | `'tool-call'`                                                             | Discriminant on `UIMessage.parts`.                                                                                                                                                                                        |
| `id`        | string                                                                    | Stable per proposed call.                                                                                                                                                                                                 |
| `name`      | string                                                                    | Tool name, e.g. `create_transaction`.                                                                                                                                                                                     |
| `arguments` | string (JSON)                                                             | Proposed input; finalized (`input-complete`) before an approval request ever fires — satisfies spec US-001's "proposed arguments visible before deciding."                                                                |
| `state`     | `ToolCallState`                                                           | `'awaiting-input' \| 'input-streaming' \| 'input-complete' \| 'approval-requested' \| 'approval-responded' \| 'complete' \| 'error'`                                                                                      |
| `approval`  | `{ id: string; needsApproval: boolean; approved?: boolean } \| undefined` | Present only for tools defined with `needsApproval: true`. `approved` is set by `addToolApprovalResponse` and is the durable record of the user's decision — it persists after the state moves past `approval-responded`. |
| `output`    | `any \| undefined`                                                        | Populated once a result exists (success or the library's auto-generated denial error).                                                                                                                                    |

**Business rules (from the library, load-bearing for this feature):**

- A `ToolCallPart` only ever reaches `state === 'approval-requested'` if its originating `toolDefinition()` was declared with `needsApproval: true`. Read-only tools (no such flag) never enter this state — satisfies spec US-001's "read-only calls unaffected."
- Once `addToolApprovalResponse({ id, approved })` is called for a given `approval.id`, the library immediately transitions `state` away from `'approval-requested'` and the decision cannot be re-triggered (no further approval UI can render for that id) — satisfies spec's "Approval cannot be changed" rule (§5) without any plan-level bookkeeping.
- Each `ToolCallPart` in a turn carries its own independent `approval.id`; resolving one does not affect sibling parts in the same message — satisfies spec US-005 directly from the library's design, no extra state management needed.
- On denial, the library auto-produces a tool result (`{ error: "User declined tool execution" }`, `state: "output-error"`) and feeds it to the LLM as a normal tool-result message — satisfies spec US-003's "LLM must be informed of denial" with no custom glue code.

### ToolCallDisplayState (new — derived, client-only, not a stored field)

A pure function of `ToolCallPart`, exposed as a single shared helper — `getToolCallDisplayState(part: ToolCallPart): ToolCallDisplayState` — that every component needing it (the `ToolCall` root, for its `Collapsible` open state, and each self-guarding child, for its own render condition) calls independently with the same `part` prop it already received. This is the actual new "domain" contract this feature adds. It is **not** distributed via Context: `part` is already in scope at every call site (the route holds it while mapping `message.parts`, and passes it straight through as a prop to `ToolCall` and each child it composes), so the helper is the single source of truth for the _derivation logic_, while `part` itself is the single source of truth for the _data_ — no third, duplicated "computed state" object needs to be threaded through the tree.

| Display state         | Derivation rule                                                                    | Rationale                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending-approval`    | `part.state === 'approval-requested' && part.approval`                             | Drives whether the approval-actions child renders itself.                                                                                                                                                                                                           |
| `denied`              | `part.state === 'error' && part.approval?.approved === false`                      | The library represents denial as a generic `error` state; `approval.approved` distinguishes intent from failure (see §6).                                                                                                                                           |
| `error`               | `part.state === 'error' && part.approval?.approved !== false`                      | Either a non-gated tool's genuine failure, or a post-approval execution failure — existing error rendering, unchanged per spec §7 constraint.                                                                                                                       |
| `running` (existing)  | any of `awaiting-input \| input-streaming \| input-complete \| approval-responded` | `approval-responded` is a brief transient state (library immediately re-streams for continuation) — folded into the existing "running" treatment rather than given its own UI, since it is not user-actionable and typically resolves within one stream round-trip. |
| `complete` (existing) | `part.state === 'complete'` or `part.output !== undefined` with no error           | Unchanged.                                                                                                                                                                                                                                                          |

**Domain invariant:** a `pending-approval` card must render its arguments without requiring an extra click to expand, and its Approve/Deny decision must be a single interaction (spec NFR, Usability). Both are satisfied by `ToolCall` computing its own `Collapsible` open state from `getToolCallDisplayState(part)` (see §6) — no external caller needs to know this rule exists.

### Component Prop Contract (new — how children receive what they need, in place of a context value)

| Prop                   | Type           | Passed to                                                                                                                          | Notes                                                                                                                                                                                             |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `part`                 | `ToolCallPart` | `ToolCall`, `ToolCallName`, `ToolCallArgs`, `ToolCallApprovalActions`, `ToolCallResponse`, `ToolCallDeniedNotice`, `ToolCallError` | The same value, passed directly by the route to every child that needs it — each child calls `getToolCallDisplayState(part)` itself rather than receiving a pre-computed variant.                 |
| `onApprove` / `onDeny` | `() => void`   | `ToolCall` (for reference/co-location) and `ToolCallApprovalActions` (where the buttons actually live)                             | Thin closures already constructed by the route (`() => addToolApprovalResponse({ id: part.approval!.id, approved: true })`); no id-hiding indirection needed since the route already owns the id. |

**Business rules:** identical to the ones already listed under `ToolCallPart` above — this is a thin, render-friendly way of giving each component the same data, not a new source of truth.

## 5. API Surface

This feature adds **no new HTTP endpoints**. The existing `POST /api/chat` SSE stream (`src/routes/api/chat.ts`) already carries approval requests and responses as part of the AG-UI protocol's event stream (the library's internal `CUSTOM` event type) — that wire protocol is unchanged by this feature. The surface that _does_ change is the tool-contract layer and the client hook surface already exposed by the library:

### Tool Definition Contract (`needsApproval` flag)

| Tool                                                                                                                                             | File                                      | `needsApproval`   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ----------------- |
| `create_category`, `update_category`, `delete_category`                                                                                          | `src/lib/ai/tools/categories.ts`          | `true` (new)      |
| `list_categories`, `get_category`                                                                                                                | `src/lib/ai/tools/categories.ts`          | unset (unchanged) |
| `create_transaction`, `update_transaction`, `delete_transaction`                                                                                 | `src/lib/ai/tools/transactions.ts`        | `true` (new)      |
| `list_transactions`, `get_transaction`                                                                                                           | `src/lib/ai/tools/transactions.ts`        | unset (unchanged) |
| `create_recurring_template`, `update_recurring_template`, `delete_recurring_template`, `activate_recurring_template`, `pause_recurring_template` | `src/lib/ai/tools/recurring-templates.ts` | `true` (new)      |
| `list_recurring_templates`, `get_recurring_template`                                                                                             | `src/lib/ai/tools/recurring-templates.ts` | unset (unchanged) |

### Client Hook Surface (existing library API, newly consumed)

```
addToolApprovalResponse(response: { id: string; approved: boolean }): Promise<void>
```

Already returned by `useChat()` and passed through `usePlataChat()` unchanged. `HomePage` (`index.tsx`) destructures it alongside `messages`, `sendMessage`, `isLoading`, `error`.

## 6. Technical Decisions

### Rely entirely on the library's native approval mechanism

**Decision:** Use `needsApproval` + `addToolApprovalResponse` as-is; build no custom pause/resume, queueing, or approval-tracking logic.
**Alternatives considered:** A custom middleware layer intercepting tool calls before execution (relevant if the installed SDK lacked approval support — it doesn't).
**Rationale:** Confirmed against the installed package's shipped types/JS and Context7 docs for `/tanstack/ai` (not assumed from a newer API) that this version fully implements pause-on-approval, per-call independent resolution, and automatic denial-to-LLM feedback — exactly the spec's requirements.
**Tradeoffs accepted:** The feature is coupled to this library's exact state-machine shape (`ToolCallState` union, `approval` field). If the SDK's approval API changes in a future major version, the rendering switch and `ToolCallDisplayState` derivation will need to move with it.

### Derive "denied" from `approval.approved === false`, not from the error string

**Decision:** Distinguish a denied call from a genuinely failed call using `part.approval?.approved === false`, not by matching the literal string `"User declined tool execution"`.
**Alternatives considered:** String-matching the auto-generated error message (fragile — an internal library string, not a documented contract) or introducing a synthetic client-side "denied" `ToolCallState` (not possible without forking the library's type).
**Rationale:** `approval.approved` is a structured field set exactly once by `addToolApprovalResponse` and is documented to persist on the part; it is unaffected by SDK copy changes. Satisfies spec US-003's requirement that denied is "distinguishable from a completed or errored call." This derivation logic lives in exactly one place — the shared `getToolCallDisplayState(part)` helper (§4) — so `ToolCallDeniedNotice` and `ToolCallError` both call the same helper rather than each re-implementing the `approval.approved` check inline.
**Tradeoffs accepted:** This is an inference from the library's architecture docs (approval field is set once, only mutated by the approval response), not an explicitly documented invariant of the `error`-state transition. `/task` should include a quick manual verification (deny a call, inspect `part.approval` in the rendered state) before relying on it in tests or review.

### Model the approval UI as self-guarding compound children driven by a plain `part` prop — not React Context

**Decision:** `ChatMessages.ToolCall` and its siblings are rebuilt so every component that needs tool-call data takes the raw `part: ToolCallPart` as a plain prop (plus `onApprove`/`onDeny` where relevant) and derives what it needs — including whether to render at all — via the shared `getToolCallDisplayState(part)` helper (§4). No `createContext`/provider is introduced. The full contract:

| Component                 | Props                         | Self-guard condition                                                                                                                                       | Replaces                                                           |
| ------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ToolCall` (root)         | `part`, `children`            | always renders; owns its own `Collapsible` open state, forced true while `getToolCallDisplayState(part) === 'pending-approval'`, otherwise user-controlled | today's `ToolCall` (took an external `variant` prop)               |
| `ToolCallName`            | `part`                        | always renders; picks its own icon/label/color from `getToolCallDisplayState(part)`                                                                        | today's `ToolCallName` (took external `variant` + `pending` props) |
| `ToolCallContent`         | — (pure layout)               | always renders                                                                                                                                             | unchanged                                                          |
| `ToolCallArgs`            | `part`                        | always renders while `part.arguments` exists                                                                                                               | today's `ToolCallArgs` (took `children`)                           |
| `ToolCallApprovalActions` | `part`, `onApprove`, `onDeny` | `getToolCallDisplayState(part) === 'pending-approval'`                                                                                                     | **new**                                                            |
| `ToolCallResponse`        | `part`                        | `getToolCallDisplayState(part) === 'complete'` and output exists                                                                                           | today's `ToolCallResponse` (took `children`)                       |
| `ToolCallDeniedNotice`    | `part`                        | `getToolCallDisplayState(part) === 'denied'`                                                                                                               | **new**                                                            |
| `ToolCallError`           | `part`                        | `getToolCallDisplayState(part) === 'error'`                                                                                                                | today's `ToolCallError` (took `children`)                          |

With this contract, `src/routes/_protected/index.tsx` composes **one fixed JSX tree** for every `tool-call` part, passing the same `part` (and the two callbacks) to each line — no `if (part.state === "approval-requested")` branching, no computed `pending`/`variant` values. Each state (running, pending-approval, complete, denied, error) is simply which of the always-mounted children decides to render itself.

**Alternatives considered:**

- **A `ToolCallContext` provider** (this plan's previous draft): `ToolCall` as a context provider exposing `{ state: { part, displayState }, actions: { approve, deny } }`, with children calling `use(ToolCallContext)` instead of taking props. Rejected on reconsideration — Context earns its cost when there's deep prop-drilling through unrelated layers, multiple interchangeable state sources (dependency injection), or siblings _outside_ the visual tree needing shared state (the justification for `PromptInput.Root`'s context, where `Toolbar` and `EditorSlot` share one expensive stateful tiptap `editor` instance). None of that holds here: `part` is cheap, already in scope at the route, and every consumer is a direct child rendered together by one call site. Context here would only add indirection, not solve a real drilling problem.
- The original design from this plan's first draft: keep `ToolCallVariant` as a `"default" | "error"` union grown to four string values, plus a separate `pending` boolean, with `ToolCallName`/`ToolCall` taking both, computed by the route. Rejected — two independent flags that can combine into impossible states (e.g. `variant="pending-approval"` with `pending=true`) is the real anti-pattern this redesign fixes, regardless of whether Context or props distribute the fix.
- A one-off, non-compound `ApprovalPrompt` component rendered conditionally by the route alongside the existing `ToolCall`. Rejected — it would duplicate the card chrome (border, icon, name) that `ToolCall`/`ToolCallName` already render, and reintroduces route-level conditionals.

**Rationale:** The core fix is collapsing two overlapping flags (`variant` + `pending`) into one clean discriminated `ToolCallDisplayState`, and letting each piece of UI decide for itself whether it applies, instead of the route pre-computing and threading presentation decisions down. That fix does not require Context — passing `part` as a plain prop to a handful of always-nested siblings is simpler, has no new API surface to learn (`use(ToolCallContext)`), and matches this project's "no premature abstraction" convention (CLAUDE.md) better than provider/consumer machinery with exactly one caller. It also still satisfies two spec-level requirements as a side effect: US-001's "arguments visible before deciding" (the root's own open-state logic) and US-005's "each proposed call resolved independently" (each `ToolCall` instance only ever sees its own `part`, so there is no shared mutable state across sibling tool calls to leak between them).

**Tradeoffs accepted:** `part={part}` (and `onApprove`/`onDeny` on `ToolCallApprovalActions`) is repeated on several JSX lines in the route, which is slightly more verbose than a single `<ChatMessages.ToolCall part={part}>` wrapper distributing it implicitly. Accepted because the repetition is shallow (one hop, always the same value), explicit, and grep-able — and because if a genuine need for Context ever emerges (e.g., a second, differently-sourced rendering of tool-call history), it can be introduced then, against a real requirement instead of a speculative one.

### Remove the narrate-delete prompt instruction; add no new prompt instruction about approval

**Decision:** Delete the two sentences in `system-prompt.ts`'s "Acting with care" section that ask the LLM to narrate/confirm deletes in text and describe create/update/activate/pause as running immediately (per spec §7 constraint). Do not add new prompt text instructing the LLM on how to react to a denial.
**Alternatives considered:** Adding explicit prompt guidance like "if a tool result indicates the user declined, acknowledge briefly and ask what they'd like instead."
**Rationale:** The spec constraint only mandates removal (to avoid double-confirmation). The library already feeds the denial back as a normal tool-result message; general-purpose LLM behavior (already exercised via the rest of the system prompt's conversational tone) is expected to handle acknowledging a declined action without a dedicated instruction. Keeping the prompt diff minimal reduces risk of unintended behavior changes elsewhere in the prompt.
**Tradeoffs accepted:** If early manual testing (US-003 AC: "assistant can respond... rather than the turn simply ending") shows the model handles denial awkwardly, a short added instruction is a cheap follow-up — flagged as an open risk in §7, not pre-solved here.

### No test coverage added for the new UI in this pass

**Decision:** No Testing-Library component tests and no new Storybook stories are added for the Approve/Deny UI. Only the existing tool-definition shape tests (`tools/__tests__/*.test.ts`) and the chat route test (`chat.test.ts`) get updated assertions for the `needsApproval` flag, since those files already assert on tool/definition shape today.
**Alternatives considered:** Testing-Library tests for click-to-approve/deny interaction (would have been a new precedent, since no component currently has Testing-Library coverage — only Storybook stories exist for `ChatMessages`); Storybook-only visual coverage (matching existing precedent).
**Rationale:** Explicit user scope decision for this implementation pass.
**Tradeoffs accepted:** The approve/deny click-handler wiring (`ToolCallApprovalActions` calling the `onApprove`/`onDeny` props it's given) and the five self-guarding children's render conditions have no automated regression protection. This is a real gap given the feature exists specifically to prevent data-loss mistakes — flagged as an open risk in §7. The compound-component design (§6) at least makes each condition independently readable and small (a one-line `getToolCallDisplayState(part) === '...'` check per component), which lowers (but doesn't eliminate) the risk relative to a monolithic branch.

## 7. Open Questions & Risks

- [ ] **Risk — no automated coverage for approval UI.** Per explicit scope decision (§6), the Approve/Deny click path is untested. Likelihood: any future refactor of `ChatMessages` or the rendering switch could silently break the gate without a failing test. Mitigation: manual verification during `/implement` (approve and deny at least one call of each mutating tool type through the dev server) is required before considering this feature done, even without automated tests.
- [ ] **Risk — `approval.approved` persistence through the error-state transition is inferred, not explicitly documented.** The architecture docs describe the `approval` field being set by `addToolApprovalResponse` and describe the `TOOL_CALL_END` dual-role transition to `error` state as touching `output`/`state`, but do not explicitly confirm `approval.approved` survives that transition untouched. Mitigation: verify manually (deny a call, log/inspect the resulting part) early in `/implement`, before building the `denied` variant on top of it. If the assumption is wrong, fall back to the string-match alternative noted in §6, documented as a known fragility.
- [ ] **Open question — LLM's conversational handling of a denial.** §6 deliberately adds no new prompt instruction for this. If manual testing during `/implement` shows the model handles a declined tool call awkwardly (e.g., repeats the same call, or the turn stalls), revisit and add a short instruction — this would be a `/revise` to this plan's prompt-change scope, not a re-architecture.

---

_Spec: [./spec.md](./spec.md) | Mode: brownfield_
