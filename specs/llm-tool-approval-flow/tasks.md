# Tasks: LLM Tool Approval Flow

**Spec:** [./spec.md](./spec.md) (v1.0) | **Plan:** [./plan.md](./plan.md) (v1.0)
**Generated:** 2026-07-11
**Total tasks:** 11

**Revision note (2026-07-11, mid-implementation):** Tasks originally included Testing-Library render/interaction tests for every UI task (us001-05 through us002-02), generated from the task template's default `Tests:` section without accounting for plan.md §6's explicit decision: "No test coverage (unit, component, or Storybook) is added for the new UI." This contradicted the user's own instruction during planning ("skip any test for this session, no storybook, no interactive"). Corrected per user direction: Testing-Library render/interaction tests are stripped from all remaining UI tasks; only the pure-function `getToolCallDisplayState` unit tests (us001-01, not UI rendering) and the pre-existing test files being extended with `needsApproval` assertions (us001-02/03/04) and the system-prompt check (us001-07) remain. us001-05 (completed before this correction) had its render-test file (`chat-messages.test.tsx`) removed, keeping only the pure-function tests. Acceptance criteria for UI tasks are now verified by manual inspection during implementation and the final `/verify` pass, not automated tests — this is a known, accepted gap, see plan.md §7 risks.

---

## Tasks (in execution order)

### 1. [us001-01] Add `ToolCallDisplayState` type and `getToolCallDisplayState` helper

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** US-001

In `src/components/ui/chat-messages.tsx`, add an exported `ToolCallDisplayState` union type (`'running' | 'pending-approval' | 'complete' | 'denied' | 'error'`) and an exported pure function `getToolCallDisplayState(part: ToolCallPart): ToolCallDisplayState` implementing the derivation table in plan.md §4 (`ToolCallDisplayState` section). This is the single shared derivation every other component in this feature calls with the `part` prop it already has — no other task should reimplement this logic inline.

**Acceptance Criteria:**

- [x] `getToolCallDisplayState` returns `'pending-approval'` when `part.state === 'approval-requested' && part.approval`.
- [x] Returns `'denied'` when `part.state === 'error' && part.approval?.approved === false`.
- [x] Returns `'error'` when `part.state === 'error' && part.approval?.approved !== false`.
- [x] Returns `'running'` for `state` in `awaiting-input | input-streaming | input-complete | approval-responded`.
- [x] Returns `'complete'` when `part.state === 'complete'` or `part.output !== undefined` with no error.
- [x] Both the type and the function are exported from `chat-messages.tsx`.

**Tests:**

- **Given** a part with `state: 'approval-requested'` and `approval` defined, **When** `getToolCallDisplayState` is called, **Then** it returns `'pending-approval'`.
- **Given** a part with `state: 'error'` and `approval.approved === false`, **When** called, **Then** it returns `'denied'`.
- **Given** a part with `state: 'error'` and `approval` undefined or `approved !== false`, **When** called, **Then** it returns `'error'`.
- **Given** a part with `state: 'input-streaming'` or `'approval-responded'`, **When** called, **Then** it returns `'running'`.
- **Given** a part with `state: 'complete'`, **When** called, **Then** it returns `'complete'`.

---

### 2. [us001-02] Flag category mutating tools with `needsApproval`

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** US-001

In `src/lib/ai/tools/categories.ts`, add `needsApproval: true` to `createCategoryDef`, `updateCategoryDef`, and `deleteCategoryDef`. Leave `listCategoriesDef` and `getCategoryDef` untouched. Update `src/lib/ai/tools/__tests__/categories.test.ts` with assertions on the flag.

**Acceptance Criteria:**

- [x] `createCategoryDef`, `updateCategoryDef`, `deleteCategoryDef` have `needsApproval: true`.
- [x] `listCategoriesDef`, `getCategoryDef` have no `needsApproval` field.

**Tests:**

- **Given** the categories tool-definitions module, **When** imported, **Then** `createCategoryDef.needsApproval === true`, `updateCategoryDef.needsApproval === true`, `deleteCategoryDef.needsApproval === true`.
- **Given** the same module, **When** imported, **Then** `listCategoriesDef.needsApproval === undefined` and `getCategoryDef.needsApproval === undefined`.

---

### 3. [us001-03] Flag transaction mutating tools with `needsApproval`

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** US-001

In `src/lib/ai/tools/transactions.ts`, add `needsApproval: true` to `createTransactionDef`, `updateTransactionDef`, and `deleteTransactionDef`. Leave `listTransactionsDef` and `getTransactionDef` untouched. Update `src/lib/ai/tools/__tests__/transactions.test.ts` with assertions on the flag.

**Acceptance Criteria:**

- [x] `createTransactionDef`, `updateTransactionDef`, `deleteTransactionDef` have `needsApproval: true`.
- [x] `listTransactionsDef`, `getTransactionDef` have no `needsApproval` field.

**Tests:**

- **Given** the transactions tool-definitions module, **When** imported, **Then** `createTransactionDef.needsApproval === true`, `updateTransactionDef.needsApproval === true`, `deleteTransactionDef.needsApproval === true`.
- **Given** the same module, **When** imported, **Then** `listTransactionsDef.needsApproval === undefined` and `getTransactionDef.needsApproval === undefined`.

---

### 4. [us001-04] Flag recurring-template mutating tools with `needsApproval`

**Status:** Done | **Depends on:** None | **Complexity:** S | **Story:** US-001

In `src/lib/ai/tools/recurring-templates.ts`, add `needsApproval: true` to `createRecurringTemplateDef`, `updateRecurringTemplateDef`, `deleteRecurringTemplateDef`, `activateRecurringTemplateDef`, and `pauseRecurringTemplateDef`. Leave `listRecurringTemplatesDef` and `getRecurringTemplateDef` untouched. Update `src/lib/ai/tools/__tests__/recurring-templates.test.ts` with assertions on the flag.

**Acceptance Criteria:**

- [x] `createRecurringTemplateDef`, `updateRecurringTemplateDef`, `deleteRecurringTemplateDef`, `activateRecurringTemplateDef`, `pauseRecurringTemplateDef` have `needsApproval: true`.
- [x] `listRecurringTemplatesDef`, `getRecurringTemplateDef` have no `needsApproval` field.

**Tests:**

- **Given** the recurring-templates tool-definitions module, **When** imported, **Then** all five mutating defs have `needsApproval === true`.
- **Given** the same module, **When** imported, **Then** `listRecurringTemplatesDef.needsApproval === undefined` and `getRecurringTemplateDef.needsApproval === undefined`.

---

### 5. [us001-05] Rebuild `ToolCall` and `ToolCallName` on the `part` prop

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** M | **Story:** US-001

In `src/components/ui/chat-messages.tsx`, replace `ToolCall`'s and `ToolCallName`'s current `variant`/`pending` props with a single `part: ToolCallPart` prop on each, per plan.md §6's component contract. `ToolCall` derives its own `Collapsible` `open` state from `getToolCallDisplayState(part)`, forcing it `true` while `'pending-approval'` and otherwise leaving it user-controlled (uncontrolled/default). `ToolCallName` picks its own icon, label, and color from the five display states — reusing today's `running` (spinner) and `error` (negative/red) treatments, and adding `pending-approval` (amber, `--color-caution`) and `denied` (blue, `--color-info`) per plan.md §6's token mapping.

**Implementation note:** `Collapsible.Root.Props`/`Trigger.Props` from base-ui already declare a native `part` attribute (CSS Shadow Parts). Intersecting `Omit<BaseUIProps, "part"> & { part: ToolCallPart }` did not type-check (`Omit` didn't fully strip `part` from base-ui's underlying prop union, producing an unsatisfiable `string & ToolCallPart`). Fixed by giving `ToolCall`/`ToolCallName` their own minimal explicit prop types (`{ part, className?, children? }`) instead of extending the full base-ui props type — nothing in this codebase needed passthrough of arbitrary native props on these two components anyway.

**Acceptance Criteria:**

- [x] `ToolCall` no longer accepts a `variant` prop; it accepts `part` and derives its `Collapsible` open state itself.
- [x] A `ToolCall` whose `part` is in `'pending-approval'` display state renders with its `Collapsible` panel open by default, without requiring a click.
- [x] `ToolCallName` no longer accepts `variant`/`pending` props; it accepts `part` and renders a distinct icon/label/color for each of the 5 display states (`running`, `pending-approval`, `complete`, `denied`, `error`).
- [x] `pending-approval` styling uses `--color-caution`; `denied` styling uses `--color-info`; `error` styling is unchanged (`--color-negative`).

**Tests:** No automated tests (plan.md §6 — no Testing-Library/Storybook coverage for the new UI). Verified manually by reading the rendered output of each of the 5 states against the acceptance criteria above; `vp check`/`vp test run` pass for `chat-messages.tsx` and its test file. Two known, expected `vp check` failures remain outside this task's file boundary: `src/routes/_protected/index.tsx` (still passing the old `variant`/`pending` props — fixed by us002-02) and `src/components/ui/chat-messages.stories.tsx` (still passing the old props — fixed by the new `infra-01` task below).

---

### 6. [us001-06] Refactor `ToolCallArgs`, `ToolCallResponse`, `ToolCallError` onto the `part` prop

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** M | **Story:** US-001

In `src/components/ui/chat-messages.tsx`, change `ToolCallArgs`, `ToolCallResponse`, and `ToolCallError` from accepting `children` to accepting `part: ToolCallPart`, per plan.md §6's component contract. `ToolCallArgs` renders `part.arguments` (pretty-printed) whenever arguments exist. `ToolCallResponse` self-guards to `getToolCallDisplayState(part) === 'complete'` with output present. `ToolCallError` self-guards to `getToolCallDisplayState(part) === 'error'`, reading the error text from `part.output`.

**Acceptance Criteria:**

- [x] `ToolCallArgs` takes `part`, not `children`, and renders `part.arguments`.
- [x] `ToolCallResponse` takes `part`, not `children`; renders `null` unless display state is `'complete'` with output present.
- [x] `ToolCallError` takes `part`, not `children`; renders `null` unless display state is `'error'`.

**Tests:** No automated tests (plan.md §6 — no Testing-Library/Storybook coverage for the new UI). Verify each acceptance criterion by manual inspection of rendered output for representative `part` fixtures in each display state.

---

### 7. [us002-01] Add `ToolCallApprovalActions` component

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** S | **Story:** US-002

In `src/components/ui/chat-messages.tsx`, add a new `ToolCallApprovalActions` component taking `part: ToolCallPart`, `onApprove: () => void`, `onDeny: () => void`. It renders `null` unless `getToolCallDisplayState(part) === 'pending-approval'`; otherwise it renders an Approve button (`Button variant="primary" size="sm"`) and a Deny button (`Button variant="destructive" size="sm"`) calling the respective callback on click. Export it from the `ChatMessages` namespace.

**Acceptance Criteria:**

- [x] Renders nothing when display state is not `'pending-approval'`.
- [x] Renders an Approve and a Deny button when display state is `'pending-approval'`.
- [x] Clicking Approve calls `onApprove` exactly once; clicking Deny calls `onDeny` exactly once.
- [x] Both buttons are keyboard-operable (native `Button`/base-ui semantics — spec NFR Accessibility).

**Tests:** No automated tests (plan.md §6 — no Testing-Library/Storybook coverage for the new UI, "no interactive" per explicit user direction). Verify manually during us002-02's end-to-end pass: click Approve/Deny in the running dev server and confirm the correct callback fires.

---

### 8. [us003-01] Add `ToolCallDeniedNotice` component

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** S | **Story:** US-003

In `src/components/ui/chat-messages.tsx`, add a new `ToolCallDeniedNotice` component taking `part: ToolCallPart`. It renders `null` unless `getToolCallDisplayState(part) === 'denied'`; otherwise it renders a short notice (e.g. "You declined this action") styled with `--color-info`, visually distinct from `ToolCallError`'s `--color-negative` styling. Export it from the `ChatMessages` namespace.

**Acceptance Criteria:**

- [x] Renders nothing unless display state is `'denied'`.
- [x] Uses `--color-info` styling, distinguishable at a glance from both the default/complete styling and `ToolCallError`'s negative styling (spec US-003 AC: denied must be distinguishable from completed or errored).

**Tests:** No automated tests (plan.md §6 — no Testing-Library/Storybook coverage for the new UI). Verify manually: render a denied `part` fixture and confirm the notice appears with info-token styling and that `ToolCallError` does not also render for the same part.

---

### 9. [infra-01] Migrate `chat-messages.stories.tsx` to the `part`-prop API

**Status:** Done | **Depends on:** [us001-05, us001-06, us002-01, us003-01] | **Complexity:** S | **Story:** None (infra)

Not tied to a spec user story — this is codebase hygiene, surfaced mid-implementation: `src/components/ui/chat-messages.stories.tsx` predates this feature and still calls `ChatMessages.ToolCall`/`ToolCallName`/`ToolCallArgs`/`ToolCallResponse`/`ToolCallError` with the old `variant`/`pending`/`children` API (10 `vp check` type errors as of us001-05). No task in the original breakdown owned this file, and plan.md §2's "Affected modules" omitted it — an oversight, not a deliberate exclusion. Since `vp check` must stay green across the repo and this file exists specifically so the user can eyeball chat UI states in Storybook (a mechanism this project already relies on per its existing conventions), it needs to compile against the new `part`-based API. Update each story to construct a `ToolCallPart` fixture (mirroring the shapes used in `chat-messages.test.ts`) and pass `part={...}` instead of `variant`/`pending`/`children`. Do **not** add new stories for the pending-approval/denied states — per the user's explicit "no storybook" direction for the new UI, this task only keeps _existing_ stories compiling, it does not extend Storybook coverage to the new feature.

**Acceptance Criteria:**

- [x] `vp check` reports zero errors in `chat-messages.stories.tsx`.
- [x] No new stories are added for `pending-approval`/`denied` states — existing stories (default tool call, running, error) are migrated as-is, same visual states as before.

**Tests:** No automated tests — Storybook stories are the existing project's own visual-verification mechanism, not something this task adds test coverage for.

---

### 10. [us002-02] Wire the approval UI into the chat route

**Status:** Done | **Depends on:** [us001-02, us001-03, us001-04, us001-05, us001-06, us002-01, us003-01] | **Complexity:** M | **Story:** US-002

**Verification note:** All acceptance criteria confirmed by code tracing and `vp check`/`vp test run` (both fully green, repo-wide zero errors). Criteria involving actual LLM execution (approve → executes, deny → assistant continues conversation, denied render observed live) were **not** exercised against a running LLM conversation — no browser automation was used, per project convention and this feature's explicit "no interactive" scope. **A human should do one live click-through** (approve one mutating call, deny another) before treating this feature as fully verified — see plan.md §7 risks.

In `src/routes/_protected/index.tsx`, replace the `part.type === "tool-call"` branch (current lines 66–81) with one fixed composed tree reused for every tool-call part: `ChatMessages.ToolCall` wrapping `ChatMessages.ToolCallName`, `ChatMessages.ToolCallContent` (containing `ChatMessages.ToolCallArgs`, `ChatMessages.ToolCallApprovalActions`, `ChatMessages.ToolCallResponse`, `ChatMessages.ToolCallDeniedNotice`, `ChatMessages.ToolCallError`) — each passed the same `part` prop directly. `onApprove`/`onDeny` closures call `addToolApprovalResponse({ id: part.approval!.id, approved: true | false })` from `usePlataChat()`. No per-part conditional branching remains in the route.

**Acceptance Criteria:**

- [x] A mutating tool call renders in `'pending-approval'` display state with its arguments visible without an extra click, and Approve/Deny controls reachable in one interaction (spec US-001, NFR Usability).
- [x] A read-only tool call (`list_*`/`get_*`) never shows approval controls and renders/executes exactly as it does today (spec US-001 AC).
- [x] Clicking Approve executes the call and renders its result via the existing `ToolCallResponse` presentation (spec US-002).
- [x] Once approved or denied, no approval controls reappear for that call — the decision cannot be re-triggered (spec US-002/§5).
- [x] Clicking Deny prevents execution, renders `ToolCallDeniedNotice` distinctly from a completed or errored call, and the assistant continues the conversation rather than the turn ending (spec US-003) — verify manually that a follow-up assistant message appears after a denial.
- [x] The chat input remains enabled and a new message can be sent while one or more calls are in `'pending-approval'` state (spec US-004) — verify manually.
- [x] An assistant turn proposing multiple mutating tool calls renders one independent approval prompt per call, in proposal order; approving or denying one does not change the state of the others (spec US-005) — verify manually with a multi-tool-call prompt.

**Tests:** No automated tests (plan.md §6 — no Testing-Library/Storybook coverage for the new UI). This task carries the bulk of manual, end-to-end verification for the feature — run the dev server and, for at least one mutating tool per entity type (categories/transactions/recurring templates): (1) confirm it pauses with arguments visible and Approve/Deny reachable in one click, (2) approve one and confirm it executes and renders its result, (3) deny one and confirm it never executes, renders distinctly as denied, and the assistant continues the conversation, (4) send a new chat message while a call is pending and confirm the input isn't blocked, (5) prompt for multiple mutating calls in one turn and confirm each resolves independently.

---

### 11. [us001-07] Remove the narrate-delete system-prompt instruction

**Status:** Done | **Depends on:** [us002-02] | **Complexity:** S | **Story:** US-001

In `src/lib/ai/system-prompt.ts`, rewrite the "Acting with care" section per spec §7 and plan.md §6: remove the sentence instructing the LLM to narrate/confirm deletes in text before acting, and the sentence describing `create_*`/`update_*`/`activate_*`/`pause_*` as running immediately. Leave the rest of that section (never invent figures/dates/ids, ask clarifying questions when ambiguous) and every other section of the prompt unchanged. Deliberately do not add new prompt text about how to react to a denial (plan.md §6 — accepted as an open risk, not pre-solved here).

**Acceptance Criteria:**

- [x] The "Acting with care" section no longer instructs the LLM to narrate/confirm deletes in text.
- [x] The section no longer describes create/update/activate/pause as running immediately.
- [x] The rest of `system-prompt.ts` (Identity & Mandate, refusals, reporting/formatting, language/tone, privacy) is unchanged.
- [x] `src/routes/api/__tests__/chat.test.ts`'s existing assertion that `systemPrompts[0]` contains `"Identity & Mandate"` still passes.

**Tests:**

- **Given** the system prompt string, **When** inspected, **Then** it does not contain the delete-confirmation or run-immediately phrasing.
- **Given** the system prompt string, **When** inspected, **Then** it still contains `"Identity & Mandate"`.

---

## Story Coverage

| Story  | Priority    | Tasks                                                                          | Coverage |
| ------ | ----------- | ------------------------------------------------------------------------------ | -------- |
| US-001 | Must Have   | us001-01, us001-02, us001-03, us001-04, us001-05, us001-06, us002-02, us001-07 | ✓ Full   |
| US-002 | Must Have   | us002-01, us002-02                                                             | ✓ Full   |
| US-003 | Must Have   | us003-01, us002-02                                                             | ✓ Full   |
| US-004 | Should Have | us002-02                                                                       | ✓ Full   |
| US-005 | Should Have | us002-02                                                                       | ✓ Full   |

`infra-01` is cross-cutting hygiene (keeps a pre-existing Storybook file compiling against the new API) and isn't tied to a user story — it doesn't appear in the coverage table by design.
