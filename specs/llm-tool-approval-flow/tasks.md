# Tasks: LLM Tool Approval Flow

**Spec:** [./spec.md](./spec.md) (v1.0) | **Plan:** [./plan.md](./plan.md) (v1.2)
**Generated:** 2026-07-11
**Total tasks:** 12

**Revision history:**

- **2026-07-11, mid-implementation:** Testing-Library render/interaction tests, mistakenly added to every UI task by the task template's default `Tests:` section, were stripped per plan.md §6's explicit "no test coverage for the new UI" decision and the user's own "skip any test for this session, no storybook, no interactive" instruction. Only pure-function tests (business logic, not rendering) remain in scope.
- **2026-07-11, post-validation, plan v1.0 → v1.1:** After this feature passed validation and was committed, the user requested three architectural changes: `ToolCallContext` provider instead of plain props, `data-tool-call-state` + Tailwind `group-data-*` styling instead of a JS style map, and a dedicated `tool-call.tsx` file instead of living in `chat-messages.tsx`. 7 of 11 tasks were marked `Stale`.
- **2026-07-11, plan v1.1 → v1.2, same review pass:** Before approval, the user added two more constraints: `ui/tool-call.tsx` must have zero `@tanstack/ai` dependency (the `ToolCallPart` → `ToolCallDisplayState` mapping moves to a new `src/lib/ai/tool-call-display-state.ts`), and the repeated status-indicator markup in `ToolCallName` is extracted into a `ToolCall.StatusBadge` that takes its label from context rather than hardcoding copy.
- **2026-07-11, regenerated via `/task` against plan.md v1.2:** The 7 stale tasks below are replaced by 8 tasks reflecting the final v1.2 contract (one new task, `us001-08`, added for the extracted business-logic file). The 4 previously-`Done` tasks (`us001-02/03/04` tool-def flags, `us001-07` prompt edit) are untouched and renumbered only.

---

## Tasks (in execution order)

### 1. [us001-01] Create `tool-call.tsx`: `ToolCallDisplayState` type, `ToolCallContext`, `ToolCall.Root`, `ToolCall.Content`

**Status:** Done | **Depends on:** None | **Complexity:** M | **Story:** US-001

Create `src/components/ui/tool-call.tsx` — **zero import from `@tanstack/ai`, `@tanstack/ai-client`, or `@tanstack/ai-react`** (plan.md §6, "Keep `ui/tool-call.tsx` decoupled from `@tanstack/ai`"). Export a `ToolCallDisplayState` union type (`'running' | 'pending-approval' | 'complete' | 'denied' | 'error'`). Create a `ToolCallContext` (`createContext`) with value shape `{ state: { displayState: ToolCallDisplayState; statusLabel?: string }, actions: { approve: () => void; deny: () => void } }`, following this codebase's `PromptInputContext` precedent (`src/components/ui/prompt-input.tsx`). Add `ToolCall.Root({ displayState, statusLabel, onApprove, onDeny, className, children })`: the sole context provider; renders `Collapsible.Root` with `className` including `"group"` plus the existing border/background treatment, and `data-tool-call-state={displayState}`; `open` is forced `true` when `displayState === 'pending-approval'`, otherwise left uncontrolled (default closed-until-clicked, matching today's behavior). Add `ToolCall.Content({ className, children })`: pure layout wrapper around `Collapsible.Panel`, matching the existing `ToolCallContent` layout classes in the current (pre-move) `chat-messages.tsx`. Export both from a `ToolCall` namespace object at the bottom of the file — later tasks add more keys to this same object, don't recreate it.

**Acceptance Criteria:**

- [ ] `ToolCallDisplayState` is exported with exactly the 5-value union.
- [ ] `ToolCall.Root` accepts `displayState`, `statusLabel?`, `onApprove?`, `onDeny?`, `className?`, `children`; provides `ToolCallContext` with the shape above.
- [ ] `ToolCall.Root`'s rendered element carries a `group` class and a `data-tool-call-state` attribute equal to `displayState`.
- [ ] `ToolCall.Root`'s `Collapsible` panel is forced open when `displayState === 'pending-approval'`; otherwise behaves as a normal uncontrolled `Collapsible` (closed until clicked).
- [ ] `ToolCall.Content` renders `Collapsible.Panel` with unchanged layout styling.
- [ ] `src/components/ui/tool-call.tsx` has zero import from any `@tanstack/ai*` package — verify with a grep, not just a read-through.

**Tests:** No automated tests (plan.md §6 — no Testing-Library/Storybook coverage for the new UI). Verify by code reading against each acceptance criterion.

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

### 5. [us001-05] Add `ToolCall.Name` and `ToolCall.StatusBadge`

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** M | **Story:** US-001

In `src/components/ui/tool-call.tsx`, add `ToolCall.Name({ children, className })`: renders `Collapsible.Trigger` with a Wrench icon and `children` (the tool name) — it does not interpret or format `children` in any way, just displays it. Icon color and chevron rotation use `group-data-[tool-call-state=x]:` Tailwind selectors (reading the ancestor `ToolCall.Root`'s `data-tool-call-state` attribute) — no JS style-lookup object. Add `ToolCall.StatusBadge({ className })`: reads `{ state: { displayState, statusLabel } }` from `ToolCallContext`; renders `null` if `statusLabel` is falsy; otherwise renders a small inline indicator — a spinning square when `displayState === 'running'`, a static dot otherwise — followed by the `statusLabel` text, colored via the same `group-data-[tool-call-state=x]:` mechanism. This replaces the 4 near-duplicate `<span>` blocks that existed in the pre-revision `ToolCallName` (one per non-`complete` state) with a single reusable, label-agnostic component. Update the `ToolCall` namespace object to add both.

**Acceptance Criteria:**

- [ ] `ToolCall.Name` takes only `children`/`className`; renders the given children as-is, with no logic branching on what the name means.
- [ ] `ToolCall.Name`'s icon/chevron color comes from `group-data-[tool-call-state=x]:` selectors, not a JS object keyed by display state.
- [ ] `ToolCall.StatusBadge` renders `null` when `statusLabel` (read from context) is falsy or undefined.
- [ ] `ToolCall.StatusBadge` renders a spinning indicator when `displayState === 'running'` and a static dot otherwise, followed by `statusLabel`.
- [ ] No string literal resembling `"running"`, `"awaiting approval"`, `"denied"`, or `"error"` appears anywhere in `tool-call.tsx` — those come from the caller via `statusLabel`.
- [ ] Both components exported from the `ToolCall` namespace object.

**Tests:** No automated tests (plan.md §6). Verify by rendering `ToolCall.Root` with each of the 5 `displayState` values and a representative `statusLabel`, confirming the badge shows/hides and spins correctly per criterion above.

---

### 6. [us001-06] Add `ToolCall.Args`, `ToolCall.Response`, `ToolCall.Error`

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** M | **Story:** US-001

In `src/components/ui/tool-call.tsx`, add three components, each taking `{ children, className }` — no other props, no reference to `ToolCallPart` or any tanstack type:

- `ToolCall.Args`: renders the existing "Arguments" labeled `<pre>` block containing `children`, whenever `children` is truthy.
- `ToolCall.Response`: reads `displayState` from context; renders `null` unless `displayState === 'complete'` and `children` is truthy; otherwise renders the existing "Response" labeled block containing `children`.
- `ToolCall.Error`: reads `displayState` from context; renders `null` unless `displayState === 'error'`; otherwise renders the existing "Error" labeled block (negative styling) containing `children`.

Update the `ToolCall` namespace object to add all three.

**Acceptance Criteria:**

- [ ] `ToolCall.Args` renders `children` inside the "Arguments" block whenever `children` is truthy; otherwise renders nothing.
- [ ] `ToolCall.Response` renders `null` unless `displayState === 'complete'` with truthy `children`.
- [ ] `ToolCall.Error` renders `null` unless `displayState === 'error'`.
- [ ] None of the three read anything from context except `displayState` (`Args` doesn't even need that); no `ToolCallPart`-shaped data is referenced anywhere in these components.

**Tests:** No automated tests (plan.md §6). Verify by rendering each component under `ToolCall.Root` at each relevant `displayState`, confirming the render/no-render boundary.

---

### 7. [us002-01] Add `ToolCall.ApprovalActions`

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** S | **Story:** US-002

In `src/components/ui/tool-call.tsx`, add `ToolCall.ApprovalActions({ approveLabel = "Approve", denyLabel = "Deny", className })`. Reads `{ state: { displayState }, actions: { approve, deny } }` from `ToolCallContext`; renders `null` unless `displayState === 'pending-approval'`; otherwise renders an Approve button (`Button variant="primary" size="sm"`, `onClick={actions.approve}`, label `approveLabel`) and a Deny button (`Button variant="destructive" size="sm"`, `onClick={actions.deny}`, label `denyLabel`). The component takes no callback props of its own — `actions.approve`/`actions.deny` come from context, bound once by `ToolCall.Root` to whatever `onApprove`/`onDeny` it was given. Update the `ToolCall` namespace object.

**Acceptance Criteria:**

- [ ] Renders `null` unless `displayState === 'pending-approval'` (read from context, not a prop).
- [ ] Renders Approve/Deny buttons wired to `actions.approve`/`actions.deny` from context when displayed.
- [ ] `approveLabel`/`denyLabel` props override the default `"Approve"`/`"Deny"` text.
- [ ] Both buttons are keyboard-operable (native `Button`/base-ui semantics — spec NFR Accessibility).

**Tests:** No automated tests (plan.md §6, "no interactive" per explicit user direction). Verify manually during `us002-02`'s end-to-end pass.

---

### 8. [us003-01] Add `ToolCall.DeniedNotice`

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** S | **Story:** US-003

In `src/components/ui/tool-call.tsx`, add `ToolCall.DeniedNotice({ children, className })`. Reads `displayState` from context; renders `null` unless `displayState === 'denied'`; otherwise renders `children` inside a labeled block styled with `--color-info`, visually distinct from `ToolCall.Error`'s `--color-negative` styling. Takes no data other than `children`/`className` — the denial copy (e.g. "You declined this action.") is supplied entirely by the caller. Update the `ToolCall` namespace object.

**Acceptance Criteria:**

- [ ] Renders `null` unless `displayState === 'denied'`.
- [ ] Renders `children` inside `--color-info` styling when displayed.
- [ ] No hardcoded denial copy inside the component — the text comes exclusively from `children`.

**Tests:** No automated tests (plan.md §6). Verify by rendering under `ToolCall.Root` at `displayState="denied"` vs. other states.

---

### 9. [us001-08] Create `tool-call-display-state.ts`: `getToolCallDisplayState`, `getToolCallStatusLabel`

**Status:** Done | **Depends on:** [us001-01] | **Complexity:** S | **Story:** US-001

Create `src/lib/ai/tool-call-display-state.ts` — the business-logic bridge between `@tanstack/ai`'s `ToolCallPart` and the generic `ToolCall` UI contract (plan.md §6). Export `getToolCallDisplayState(part: ToolCallPart): ToolCallDisplayState`, importing `ToolCallPart` from `@tanstack/ai-client` and `ToolCallDisplayState` from `@/components/ui/tool-call`, implementing the derivation table in plan.md §4 exactly as it was previously implemented (this is a straight move, not a rewrite — the logic itself doesn't change from the prior implementation). Export `getToolCallStatusLabel(displayState: ToolCallDisplayState): string | undefined`, mapping `'running' → "running"`, `'pending-approval' → "awaiting approval"`, `'denied' → "denied"`, `'error' → "error"`, `'complete' → undefined`. These are the only two functions in the app that know both the `@tanstack/ai` shape and the `ToolCall` component's generic contract.

**Acceptance Criteria:**

- [ ] `getToolCallDisplayState` returns `'pending-approval'` when `part.state === 'approval-requested' && part.approval`.
- [ ] Returns `'denied'` when `part.state === 'error' && part.approval?.approved === false`.
- [ ] Returns `'error'` when `part.state === 'error' && part.approval?.approved !== false`.
- [ ] Returns `'running'` for `state` in `awaiting-input | input-streaming | input-complete | approval-responded`.
- [ ] Returns `'complete'` when `part.state === 'complete'` or `part.output !== undefined` with no error.
- [ ] `getToolCallStatusLabel` returns the correct string for `running`/`pending-approval`/`denied`/`error`, and `undefined` for `complete`.
- [ ] Both functions are exported from `tool-call-display-state.ts`; neither is duplicated inline anywhere else (e.g. in `index.tsx`).

**Tests:**

- **Given** a part with `state: 'approval-requested'` and `approval` defined, **When** `getToolCallDisplayState` is called, **Then** it returns `'pending-approval'`.
- **Given** a part with `state: 'error'` and `approval.approved === false`, **When** called, **Then** it returns `'denied'`.
- **Given** a part with `state: 'error'` and `approval` undefined or `approved !== false`, **When** called, **Then** it returns `'error'`.
- **Given** a part with `state: 'input-streaming'` or `'approval-responded'`, **When** called, **Then** it returns `'running'`.
- **Given** a part with `state: 'complete'`, **When** called, **Then** it returns `'complete'`.
- **Given** each of the 5 `ToolCallDisplayState` values, **When** `getToolCallStatusLabel` is called, **Then** it returns the corresponding label string, or `undefined` for `'complete'`.

_(Business-logic tests, not UI tests — in scope despite plan.md §6's "no test coverage for the new UI," since this file lives in `src/lib/ai/`, not `src/components/ui/`.)_

---

### 10. [infra-01] Move `ToolCall` Storybook stories to `tool-call.stories.tsx` on the generic API

**Status:** Done | **Depends on:** [us001-05, us001-06, us002-01, us003-01] | **Complexity:** S | **Story:** None (infra)

Not tied to a spec user story — codebase hygiene. The `ToolCall*` stories currently in `src/components/ui/chat-messages.stories.tsx` (migrated once already, to the now-superseded `part`-prop API) need a second migration, and since the components themselves moved to `src/components/ui/tool-call.tsx`, the stories should move to a new `src/components/ui/tool-call.stories.tsx` to match this codebase's one-file-per-component convention (plan.md §2). Remove the `ToolCall*` stories from `chat-messages.stories.tsx` entirely (that file keeps only stories for `List`/`UserMessage`/`AssistantMessage`/`Attachment`, if any exist). In the new file, construct `displayState`/`statusLabel` values directly for each story (no `ToolCallPart` fixture needed anymore — this is simpler than the prior migration) and pass them to `ToolCall.Root`, with tool name/arguments/response content composed as plain `children`. Preserve the same visual states demonstrated before (a complete/collapsed call, a complete/expanded call, a running/pending call, an error call). Do **not** add new stories for `pending-approval`/`denied` states — per the user's explicit "no storybook" direction for the new approval UI, this task only keeps existing coverage compiling, it does not extend it.

**Acceptance Criteria:**

- [ ] `chat-messages.stories.tsx` no longer references `ToolCall`/`ChatMessages.ToolCall*` in any form.
- [ ] `tool-call.stories.tsx` exists with stories for the same visual states demonstrated before this feature (collapsed/complete, expanded/complete, running, error), built from `displayState`/`statusLabel` values, not fake `ToolCallPart` objects.
- [ ] No new stories for `pending-approval` or `denied` states.
- [ ] `vp check` reports zero errors in both files.

**Tests:** No automated tests — Storybook stories are this project's own visual-verification mechanism, not something this task adds test coverage for.

---

### 11. [us002-02] Wire the approval UI into the chat route

**Status:** Done | **Depends on:** [us001-08, us001-05, us001-06, us002-01, us003-01] | **Complexity:** M | **Story:** US-002

**Verification note:** All acceptance criteria confirmed by code tracing; `vp check`/`vp test run` fully green repo-wide, zero caveats (187 tests, down from 198 after deleting the superseded `chat-messages.test.ts` — reconciles exactly: 198 − 11 = 187). Criteria involving actual LLM execution (approve → executes, deny → assistant continues, multi-call independence, input-stays-usable) were **not** exercised live — no browser automation was used, per project convention. **A human should do one live click-through** before treating this feature as fully verified — see plan.md §7 risks and this task's Tests section for the exact checklist.

In `src/routes/_protected/index.tsx`, import `ToolCall` from `@/components/ui/tool-call` and `getToolCallDisplayState`/`getToolCallStatusLabel` from `@/lib/ai/tool-call-display-state`. Replace the `part.type === "tool-call"` branch with: compute `const displayState = getToolCallDisplayState(part)` and `const statusLabel = getToolCallStatusLabel(displayState)` once per part, then compose one fixed tree — **note: `ToolCall.Name` already renders `ToolCall.StatusBadge` internally (confirmed in `us001-05`'s implementation), so do not add a separate `<ToolCall.StatusBadge />` line here — it would render the badge twice.**

```
<ToolCall.Root
  key={...}
  displayState={displayState}
  statusLabel={statusLabel}
  onApprove={() => addToolApprovalResponse({ id: part.approval!.id, approved: true })}
  onDeny={() => addToolApprovalResponse({ id: part.approval!.id, approved: false })}
>
  <ToolCall.Name>{part.name}</ToolCall.Name>
  <ToolCall.Content>
    <ToolCall.Args>{part.arguments}</ToolCall.Args>
    <ToolCall.ApprovalActions />
    <ToolCall.Response>{/* JSON.stringify(part.output) when defined */}</ToolCall.Response>
    <ToolCall.DeniedNotice>You declined this action.</ToolCall.DeniedNotice>
    <ToolCall.Error>{/* extracted error text, falling back to JSON.stringify(part.output) */}</ToolCall.Error>
  </ToolCall.Content>
</ToolCall.Root>
```

reused identically for every tool-call part. This is the one place in the app that maps the `@tanstack/ai` shape onto the generic `ToolCall` contract — per plan.md §6, correctly doing so is explicitly this call site's responsibility, not the component library's.

**Acceptance Criteria:**

- [ ] A mutating tool call renders in `pending-approval` display state with its arguments visible without an extra click, and Approve/Deny controls reachable in one interaction (spec US-001, NFR Usability).
- [ ] A read-only tool call (`list_*`/`get_*`) never shows approval controls and renders/executes exactly as it does today (spec US-001 AC).
- [ ] Clicking Approve executes the call and renders its result via `ToolCall.Response` (spec US-002).
- [ ] Once approved or denied, no approval controls reappear for that call (spec US-002/§5).
- [ ] Clicking Deny prevents execution, renders `ToolCall.DeniedNotice` distinctly from a completed or errored call, and the assistant continues the conversation rather than the turn ending (spec US-003) — verify manually that a follow-up assistant message appears after a denial.
- [ ] The chat input remains enabled and a new message can be sent while one or more calls are in `pending-approval` state (spec US-004) — verify manually.
- [ ] An assistant turn proposing multiple mutating tool calls renders one independent approval prompt per call, in proposal order; approving or denying one does not change the state of the others (spec US-005) — verify manually with a multi-tool-call prompt.
- [ ] `index.tsx` never imports `ToolCallPart` handling into `ToolCall`'s own props beyond `displayState`/`statusLabel`/`children` — no leftover `part`-prop usage from the pre-revision API.

**Tests:** No automated tests (plan.md §6). This task carries the bulk of manual, end-to-end verification for the feature — run the dev server and, for at least one mutating tool per entity type (categories/transactions/recurring templates): (1) confirm it pauses with arguments visible and Approve/Deny reachable in one click, (2) approve one and confirm it executes and renders its result, (3) deny one and confirm it never executes, renders distinctly as denied, and the assistant continues the conversation, (4) send a new chat message while a call is pending and confirm the input isn't blocked, (5) prompt for multiple mutating calls in one turn and confirm each resolves independently.

---

### 12. [us001-07] Remove the narrate-delete system-prompt instruction

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

| Story  | Priority    | Tasks                                                                                    | Coverage |
| ------ | ----------- | ---------------------------------------------------------------------------------------- | -------- |
| US-001 | Must Have   | us001-01, us001-02, us001-03, us001-04, us001-05, us001-06, us001-08, us002-02, us001-07 | ✓ Full   |
| US-002 | Must Have   | us002-01, us002-02                                                                       | ✓ Full   |
| US-003 | Must Have   | us003-01, us002-02                                                                       | ✓ Full   |
| US-004 | Should Have | us002-02                                                                                 | ✓ Full   |
| US-005 | Should Have | us002-02                                                                                 | ✓ Full   |

`infra-01` is cross-cutting hygiene (relocates a pre-existing Storybook file to match the new component location) and isn't tied to a user story — it doesn't appear in the coverage table by design.
