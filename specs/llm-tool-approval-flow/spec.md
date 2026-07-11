# Spec: LLM Tool Approval Flow

**Status:** Implemented
**Created:** 2026-07-10
**Version:** 1.0

---

## 1. Overview

Today, when the chat LLM decides to create, update, delete, activate, or pause a category, transaction, or recurring template, it does so immediately and silently — the only safeguard is a soft, prompt-level instruction asking the LLM to narrate deletes in text before acting, which the LLM may or may not honor and which is not technically enforced. Users have no reliable opportunity to catch a wrong amount, wrong category, or unintended deletion before it happens to their financial data. This feature adds a technical approval gate: every mutating tool call pauses in the chat transcript for an explicit Approve/Deny decision before it runs.

## 2. Goals

- Every mutating tool call (create/update/delete/activate/pause, across categories, transactions, and recurring templates) is paused and shown to the user for approval before it executes.
- The user can approve or deny each proposed tool call individually, directly in the chat transcript.
- A denied tool call never executes, and the assistant is informed of the denial so it can acknowledge it or propose an alternative.
- Read-only tool calls (list/get) continue to execute immediately, unaffected by this feature.
- The user is never blocked from continuing the conversation while one or more tool calls await their decision.

## 3. Non-Goals

- No per-user or per-tool configurability of which calls require approval — the gate applies uniformly to all mutating tools.
- No inline editing of proposed tool-call arguments — the user approves the call as proposed or denies it; corrections happen via a follow-up chat message.
- No persisted approval history or audit log — approval state is transient and lives only in the current chat transcript.
- No persistence of pending approvals across a page reload — consistent with the chat's current fully in-memory, ephemeral session model.
- No new confirmation UI for tool calls that fail _after_ being approved — existing error rendering is reused unchanged.

## 4. Roles & Actors

| Role          | Description                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Chat User     | The authenticated app user conversing with the LLM; reviews and approves or denies proposed mutating actions.                |
| LLM Assistant | Proposes tool calls in response to the user's requests; is informed of approval/denial outcomes and may respond accordingly. |

## 5. Domain Model

### ToolCall

A single proposed invocation of an LLM tool, rendered as part of an assistant message in the chat transcript.

- **Key fields:** `name` (which tool), `arguments` (proposed input), `state` (lifecycle stage — includes an "awaiting approval" stage and a "denied" stage in addition to the existing running/complete/error stages), `output` (result, once executed)
- **Relationships:** belongs to one assistant chat message; a single assistant turn may contain multiple ToolCalls, each tracked and resolved independently.
- **Business rules:** a ToolCall for a mutating tool cannot execute until it has been explicitly approved; a ToolCall for a read-only tool never enters an approval-pending stage.

### Approval

The user's decision on a pending ToolCall.

- **Key fields:** `approved` (yes/no)
- **Relationships:** resolves exactly one ToolCall.
- **Business rules:** once decided, an Approval cannot be changed; a denial must be communicated back to the LLM Assistant so it can continue the conversation meaningfully rather than the exchange silently dead-ending.

## 6. User Stories

### [US-001] Mutating tool calls pause for approval

**Priority:** Must Have
**Actor:** Chat User

> As a chat user, I want any action that would change my data to pause for my review before it happens, so that I don't end up with unintended or incorrect changes to my finances.

**Acceptance Criteria:**

- [ ] When the LLM proposes a `create_*`, `update_*`, `delete_*`, `activate_*`, or `pause_*` call, it does not execute automatically; it enters an "awaiting approval" state visible in the chat transcript.
- [ ] `list_*` and `get_*` calls are unaffected and continue to execute immediately without any approval step.
- [ ] The proposed arguments for a pending call are visible to the user before they decide.

---

### [US-002] Approve a pending tool call

**Priority:** Must Have
**Actor:** Chat User

> As a chat user, I want to approve a proposed action inline in the chat, so that it then runs exactly as proposed.

**Acceptance Criteria:**

- [ ] The user can approve a pending tool call with a single explicit action in the transcript (no navigating away from the chat).
- [ ] On approval, the tool call executes and its result renders using the same result presentation already used for tool calls today.
- [ ] Once approved, the decision cannot be changed or re-triggered.

---

### [US-003] Deny a pending tool call

**Priority:** Must Have
**Actor:** Chat User

> As a chat user, I want to deny a proposed action inline in the chat, so that it never runs and I can tell the assistant what I actually want instead.

**Acceptance Criteria:**

- [ ] The user can deny a pending tool call with a single explicit action in the transcript.
- [ ] A denied tool call never executes against the user's data.
- [ ] The denied call is visibly marked as denied in the transcript (distinguishable from a completed or errored call).
- [ ] The LLM Assistant is informed the call was denied and can respond in the conversation (e.g. acknowledge it or propose an alternative) rather than the turn simply ending.

---

### [US-004] Keep chatting while approvals are pending

**Priority:** Should Have
**Actor:** Chat User

> As a chat user, I want to keep typing and sending messages while a tool call awaits my decision, so a multi-step request doesn't leave me stuck staring at one prompt.

**Acceptance Criteria:**

- [ ] The chat input remains usable while one or more tool calls are in an "awaiting approval" state.
- [ ] Sending a new message does not silently discard or auto-resolve any pending approval.

---

### [US-005] Handle multiple proposed calls in one turn individually

**Priority:** Should Have
**Actor:** Chat User

> As a chat user, when the assistant proposes several actions at once, I want to approve or deny each one on its own, so I retain control over exactly which changes happen.

**Acceptance Criteria:**

- [ ] When an assistant turn proposes multiple mutating tool calls, each renders its own independent approval prompt.
- [ ] Approving or denying one pending call does not affect the state of the others.
- [ ] Calls are presented and resolved in the order the assistant proposed them.

---

## 7. Constraints

- Read-only tools (`list_*`, `get_*`) must never be gated by approval — the feature applies exclusively to mutating tools.
- The existing system prompt instruction that asks the LLM to narrate and confirm deletes in chat text must be removed once this feature ships, to avoid the user being asked to confirm the same action twice (once in text, once via the approval UI).
- The feature must not introduce any new durability requirement — approval state, like the rest of the chat, may be lost on page reload.
- Approving or denying a call must not change the outcome or presentation of the _result_ of an already-approved call that later fails — existing error handling applies unchanged.

## 8. Non-Functional Requirements

| Category      | Requirement                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usability     | The approval decision (Approve/Deny) must be reachable with a single interaction and must not require leaving or scrolling away from the chat transcript. |
| Accessibility | Approve/Deny controls must be keyboard-operable and consistent with the app's existing interactive component patterns.                                    |
| Reliability   | A denied or approved tool call must never be left in an ambiguous or stuck "pending" state after the user acts on it.                                     |

## 9. Open Questions

- [ ] None outstanding — scope was fully clarified during elicitation. (Implementation-level detail to verify during `/plan`: the exact API shape of the installed tool-calling library's approval mechanism, since it is on a pre-1.0 version.)

---

_Next step: Run `/plan specs/llm-tool-approval-flow/spec.md` to generate the technical plan._
