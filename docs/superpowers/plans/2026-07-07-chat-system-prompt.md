# Chat System Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constrain the chat model to Plata's purpose with a restrictive, app-aware system prompt and wire it into the existing TanStack AI chat route via `systemPrompts`.

**Architecture:** Add a single pure module exporting a `SYSTEM_PROMPT` constant string, then import it in `src/routes/api/chat.ts` and pass it as `systemPrompts: [SYSTEM_PROMPT]` to the `chat()` call. Update the existing chat route test to assert `systemPrompts` is passed. No client changes.

**Tech Stack:** TanStack AI (`@tanstack/ai@0.28.0`) — `chat(options)` accepts an optional `systemPrompts: string[]` param (verified via Context7 `/tanstack/ai` docs); Vite+ (`vp`) toolchain; Vitest for tests.

## Global Constraints

- PackageManager: `pnpm@11.3.0`. Run scripts via `pnpm <script>` or `vp <command>`.
- Lint/format/typecheck/test command: `vp check && vp test run` (run before claiming done).
- Do not add comments to source files unless requested.
- No new dependencies.
- Follow existing style: 2-space indent, double quotes, semicolons, trailing commas in multi-line objects/arrays.
- The prompt text is the version agreed in `docs/superpowers/specs/2026-07-07-chat-system-prompt-design.md`.

## File Structure

```
src/lib/ai/
  system-prompt.ts            # NEW — exports SYSTEM_PROMPT (const string)
  tools/                      # unchanged
  fetch.ts                    # unchanged
src/routes/api/chat.ts        # MODIFIED — import SYSTEM_PROMPT, pass systemPrompts to chat()
src/routes/api/__tests__/chat.test.ts  # MODIFIED — assert systemPrompts is passed
```

---

## Task 1: Add the SYSTEM_PROMPT constant

**Files:**

- Create: `src/lib/ai/system-prompt.ts`

**Interfaces:**

- Produces: `export const SYSTEM_PROMPT: string` — a single multi-line string exported as a named export. Later task imports it as `import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt"`.

- [ ] **Step 1: Create the file with the prompt text**

Create `src/lib/ai/system-prompt.ts` with exactly this content:

```typescript
export const SYSTEM_PROMPT = `# Identity & Mandate

You are Plata, the in-app assistant of a multi-user personal finance tracker.
"Plata" is Colombian Spanish for "money." Your single job is to help the signed-in
user record and manage their money — expenses and income, one-off and recurring —
and to produce text reports on their own data.

You are NOT a general-purpose assistant. You are NOT a financial advisor.

# What you must refuse

Hard-refuse, briefly and without lecture, any of the following:
- General-knowledge questions unrelated to the user's finances.
- Advice on investing, stocks, crypto, lending, borrowing, or taxes.
- Predictions of markets, prices, or future values.
- Coding, travel, recipes, writing tasks, or anything outside personal finance.
- Any request to act on data you do not have a tool for.
After a refusal, redirect to what you can help with. Brief pleasantries
(greetings, small thanks) are fine; do not extend them.

# What you may do

Use ONLY the provided tools. They operate on the current (authenticated) user's
data; never assume or request another user's identifiers.
- Categories: list, create, get, update, delete. type ∈ {expense, income, both}.
- Transactions: list, create, get, update, delete. type ∈ {expense, income};
  source defaults to "chat" for rows you create. You may omit categoryId and
  recurringTemplateId; ask only if the user clearly expects a specific category.
- Recurring templates: list, create, get, update, delete, activate, pause.
  status ∈ {active, paused, completed, failed};
  cadence ∈ {daily, weekly, biweekly, monthly, quarterly, yearly}.
Amounts are MAJOR currency units (9.99 = $9.99); the tool stores cents
internally — never send cents or multiply by 100. Currency follows ISO 4217;
default to "USD" only if the user hasn't given one.

# Acting with care

Before any delete_* tool call, state exactly what will be deleted (resource + id
or short description) and ask the user to confirm. Do not delete on assumption.
create_*, update_*, activate_*, pause_* run immediately; then report what occurred
in one or two lines. Never invent numerical figures, dates, ids, or cadences. If
the amount, date, cadence, or type is missing or ambiguous, ask one short question
rather than guessing. A wrong $500 expense is a worse outcome than a quick
clarifying question.

# Reporting & formatting

Reply in Markdown. The chat renderer supports GFM — tables, bold, lists, headings.
For reports (spending by category, by period, recent activity, recurring items),
prefer a compact Markdown table with a one-line summary sentence above it. When a
list of transactions would exceed roughly 10 rows, summarize the highlights
(totals, top categories) and offer to show the rest rather than dumping every row.
Do not produce raw numbers without their currency and unit. Do not promise charts
or images — text only.

# Language & tone

Reply in the same language the user wrote in (Spanish, English, etc.). Be concise,
neutral, and friendly. No emojis, no marketing tone, no filler ("Sure!", "Great
question"). When reporting facts, lead with the fact, not preamble.

# Privacy

You only ever see the current user's data via the tools. Do not ask the user for
another person's id, email, or any identifier. If a request implies acting across
users, refuse and explain the tool set is scoped to their own account.`;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `vp check`
Expected: PASS, no errors. The file only exports a string literal, so no type issues are possible.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/system-prompt.ts
git commit -m "feat(ai): add restrictive system prompt constant"
```

---

## Task 2: Wire SYSTEM_PROMPT into the chat route

**Files:**

- Modify: `src/routes/api/chat.ts` (the `chat({...})` call at lines 28-32)

**Interfaces:**

- Consumes: `SYSTEM_PROMPT` from `src/lib/ai/system-prompt.ts` (named export, type `string`).
- Produces: the chat route's `POST` handler now calls `chat({ ..., systemPrompts: [SYSTEM_PROMPT] })`. The `systemPrompts` option is part of TanStack AI's `chat(options)` signature (verified via Context7).

- [ ] **Step 1: Add the import**

Edit `src/routes/api/chat.ts`. Add the import of `SYSTEM_PROMPT` right after the existing `allToolDefinitions` import at line 7.

Current lines 1-7:

```typescript
import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from "@tanstack/ai";
import { createOpenaiChat, openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { allToolDefinitions } from "@/lib/ai/tools/index";
```

Change the last import line to add a new line after it:

```typescript
import { allToolDefinitions } from "@/lib/ai/tools/index";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
```

- [ ] **Step 2: Pass systemPrompts to chat()**

In the same file, change the `chat({...})` call. Replace lines 28-32:

```typescript
const stream = chat({
  adapter: adapters[model_id],
  messages,
  tools: [...allToolDefinitions],
});
```

with:

```typescript
const stream = chat({
  adapter: adapters[model_id],
  messages,
  tools: [...allToolDefinitions],
  systemPrompts: [SYSTEM_PROMPT],
});
```

- [ ] **Step 3: Verify typecheck passes**

Run: `vp check`
Expected: PASS. `systemPrompts?: string[]` is a documented option of `chat()`. If a type error appears, it means `@tanstack/ai@0.28.0` doesn't expose the option in its types — see the "If typecheck fails" note below.

<details>
<summary>If typecheck fails on <code>systemPrompts</code></summary>

The TanStack AI docs (Context7 `/tanstack/ai`) clearly list `systemPrompts (Array<string>) - Optional - System prompts to prepend to messages`. The installed version is `@tanstack/ai@0.28.0`. If `vp check` reports an unknown property, the installed minor may type the option differently (e.g. `systemPrompt` singular, or under a nested object). In that case run `codegraph explore "systemPrompts"` or grep the installed package's `.d.ts` (outside `node_modules` is fine to read types) — but the inline design here is correct per docs. Do not silently drop the option; if typing truly differs, stop and report back.

</details>

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/chat.ts
git commit -m "feat(ai): pass system prompt to chat route"
```

---

## Task 3: Assert systemPrompts in the chat route test

**Files:**

- Modify: `src/routes/api/__tests__/chat.test.ts`

**Interfaces:**

- Consumes: the existing test file's mock setup. `@tanstack/ai` is mocked at module level (lines 7-17), so `vi.mocked(chat).mock.calls[0][0]` exposes the options object passed to `chat()`. The new `SYSTEM_PROMPT` import in `chat.ts` does not require a mock — it's a plain string, imported normally.

- [ ] **Step 1: Add a failing assertion for systemPrompts**

Edit `src/routes/api/__tests__/chat.test.ts`. The existing `it("passes all 17 tool definitions to chat()")` block (lines 33-45) ends with two `expect` calls on `call.tools`. Add a third `expect` to that same block, before the closing `})` of the `it` callback.

Current lines 42-45:

```typescript
    const call = vi.mocked(chat).mock.calls[0][0] as any;
    expect(Array.isArray(call.tools)).toBe(true);
    expect(call.tools).toHaveLength(17);
  });
```

Change to:

```typescript
    const call = vi.mocked(chat).mock.calls[0][0] as any;
    expect(Array.isArray(call.tools)).toBe(true);
    expect(call.tools).toHaveLength(17);
    expect(call.systemPrompts).toEqual([expect.any(String)]);
    expect((call.systemPrompts as string[])[0]).toContain("Identity & Mandate");
  });
```

The first new assertion verifies `systemPrompts` is a single-element array of a string; the second verifies the content is the actual Plata prompt (not an empty or placeholder string), keyed off the first section header.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test run src/routes/api/__tests__/chat.test.ts`
Expected: FAIL. The current `chat.ts` does not pass `systemPrompts`, so `call.systemPrompts` is `undefined` and the first new `expect` throws `expected [Any<String>] received undefined`.

- [ ] **Step 3: Confirm Task 2's wiring makes the test pass**

Run: `pnpm test run src/routes/api/__tests__/chat.test.ts`
Expected: PASS. Task 2 already added `systemPrompts: [SYSTEM_PROMPT]`, so the new assertions succeed.

(If the test fails at this step — e.g. because Task 2 was not actually applied — re-check `src/routes/api/chat.ts` and ensure the `systemPrompts: [SYSTEM_PROMPT]` line is present inside the `chat({...})` call before retrying.)

- [ ] **Step 4: Run the full check + test suite**

Run: `vp check && vp test run`
Expected: PASS for both, no lint/type/test errors anywhere in the repo.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/__tests__/chat.test.ts
git commit -m "test(ai): assert system prompt is passed to chat()"
```

---

## Verification

After all three tasks are committed:

- [ ] **Final combined check**

Run: `vp check && vp test run`
Expected: PASS for both.

- [ ] **Confirm the prompt ships server-side only**

Run: `rg -n "SYSTEM_PROMPT" src/`
Expected: matches in `src/lib/ai/system-prompt.ts` (definition) and `src/routes/api/chat.ts` (import + use) only. No client hook component imports `SYSTEM_PROMPT` — verifying the prompt does not travel over the wire to or from the browser.

---

## Self-Review notes

- **Spec coverage:** Identity/Mandate, refusal list, tools summary, delete-confirmation, ambiguity rule, Markdown reporting, language mirroring, privacy — all present in the prompt text (Task 1, Step 1). Wiring via `systemPrompts` is Task 2. Test coverage of the wiring is Task 3. ✅
- **Type consistency:** `SYSTEM_PROMPT` is the same name in Task 1 (export), Task 2 (import + use), and used implicitly in Task 3 (asserted via content match). ✅
- **No placeholders:** All code blocks are complete and copy-pasteable. ✅
