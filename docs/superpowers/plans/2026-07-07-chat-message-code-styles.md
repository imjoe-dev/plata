# Chat Message `code`/`pre` Styles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four `() => null` `code`/`pre` placeholders in `chat-messages.tsx` with styled renderers for both AI and user messages, and update the Storybook stories to showcase inline code and fenced code blocks.

**Architecture:** Pure styling change to two `Components` config objects (`markdownComponents` for AI, `userMarkdownComponents` for user) inside `src/components/ui/chat-messages.tsx`. AI code uses semantic dark tokens (`bg-sunken`, `text-fg`) matching the existing `ToolCallArgs`/`ToolCallResponse` `<pre>` pattern. User code uses currentColor opacity overlays (`bg-current/[0.07]`) matching the existing user-message blockquote/`del` pattern. Inline-vs-block detection via `className` (fenced blocks receive `language-*`, inline code receives none). Storybook stories are the project's UI verification mechanism — no unit tests for UI components.

**Tech Stack:** React 19, react-markdown v10 + remark-gfm, Tailwind CSS v4, `cn()` from `@/lib/utils`, Storybook 10 (`@storybook/react-vite`), `vp` toolchain for check/test.

## Global Constraints

- Dark theme, zero border radius everywhere (see `src/styles.css` `@theme` block).
- `font-mono` maps to "JetBrains Mono" via `--font-mono` token.
- AI message bubble: `bg-raised border-hairline border p-3.5`. User message bubble: `bg-accent text-accent-fg p-3.5`.
- Existing `<pre>` precedent (from `ToolCallArgs`/`ToolCallResponse`): `bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap`.
- `cn()` from `@/lib/utils` (clsx + tailwind-merge) is already imported in the target file.
- `Components` type from `react-markdown` is already imported in the target file.
- Run `vp check` for lint + typecheck + format, `vp test` for the test suite.

---

## File Structure

```
src/components/ui/
  chat-messages.tsx              # Modify — replace 4 null renderers with styled code/pre
  chat-messages.stories.tsx      # Modify — add code block examples to stories
```

No new files. No dependency changes. No new imports.

---

### Task 1: Add styled `code` and `pre` renderers

**Files:**

- Modify: `src/components/ui/chat-messages.tsx` (lines 42-43 and 79-80 — the four `() => null` placeholders)

**Interfaces:**

- Consumes: `cn` from `@/lib/utils` (already imported), `Components` type from `react-markdown` (already imported)
- Produces: styled `code` and `pre` entries in `markdownComponents` and `userMarkdownComponents`, consumed by the existing `<Markdown>` instances in `UserMessage` and `AssistantMessage`

- [ ] **Step 1: Read the current file to confirm line numbers**

Run: `read src/components/ui/chat-messages.tsx`
Expected: See `code: () => null,` at line 42, `pre: () => null,` at line 43 (inside `markdownComponents`), and the same at lines 79-80 (inside `userMarkdownComponents`).

- [ ] **Step 2: Replace the AI `code` and `pre` renderers**

In `markdownComponents`, replace these two lines:

```tsx
  code: () => null,
  pre: () => null,
```

with:

```tsx
  code: ({ className, children, ...props }) => {
    if (className) {
      return (
        <code className={cn("font-mono text-xs whitespace-pre-wrap", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-sunken text-fg px-1.5 py-0.5 font-mono text-xs" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="bg-sunken text-fg my-2 overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap"
      {...props}
    >
      {children}
    </pre>
  ),
```

- [ ] **Step 3: Replace the user `code` and `pre` renderers**

In `userMarkdownComponents`, replace these two lines:

```tsx
  code: () => null,
  pre: () => null,
```

with:

```tsx
  code: ({ className, children, ...props }) => {
    if (className) {
      return (
        <code className={cn("font-mono text-xs whitespace-pre-wrap", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-current/[0.07] px-1.5 py-0.5 font-mono text-xs" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="bg-current/[0.07] my-2 overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap"
      {...props}
    >
      {children}
    </pre>
  ),
```

- [ ] **Step 4: Run `vp check` to verify lint + typecheck + format**

Run: `vp check`
Expected: PASS — no type errors (the `Components` type allows these signatures), no lint errors, formatting clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/chat-messages.tsx
git commit -m "feat(ui): add styled code and pre renderers to chat messages"
```

---

### Task 2: Update Storybook stories to showcase code blocks

**Files:**

- Modify: `src/components/ui/chat-messages.stories.tsx` (the `markdownExample` constant and the `UserMessageOnly` story)

**Interfaces:**

- Consumes: The styled renderers from Task 1 (already wired into `ChatMessages.AssistantMessage` and `ChatMessages.UserMessage`)
- Produces: Updated stories that render inline code and fenced code blocks for visual verification in Storybook

- [ ] **Step 1: Read the current stories file**

Run: `read src/components/ui/chat-messages.stories.tsx`
Expected: See the `markdownExample` constant (lines 10-26) with no code blocks, and the `UserMessageOnly` story (lines 59-69) with plain markdown.

- [ ] **Step 2: Add code blocks to the `markdownExample` constant**

Replace the existing `markdownExample` constant:

```tsx
const markdownExample = `Got it! Here's the breakdown of **your rent payment**:

### Summary

- **Amount:** $1,500
- **Category:** Housing
- **Frequency:** Monthly

> Rent is due on the 1st of every month. Late fees apply after the 5th.

| Month | Amount | Status |
|-------|--------|--------|
| Jan   | $1,500 | Paid   |
| Feb   | $1,500 | Paid   |
| Mar   | $1,500 | Pending |

[View details](https://example.com) for more information.`;
```

with:

```tsx
const markdownExample = `Got it! Here's the breakdown of **your rent payment**:

### Summary

- **Amount:** $1,500
- **Category:** Housing
- **Frequency:** Monthly

> Rent is due on the 1st of every month. Late fees apply after the 5th.

| Month | Amount | Status |
|-------|--------|--------|
| Jan   | $1,500 | Paid   |
| Feb   | $1,500 | Paid   |
| Mar   | $1,500 | Pending |

Here's the SQL query I ran to fetch this:

\`\`\`sql
SELECT month, amount, status
FROM rent_payments
WHERE user_id = ?
ORDER BY month DESC;
\`\`\`

And the inline command: run \`plata export --month=jan\` to download.

[View details](https://example.com) for more information.`;
```

- [ ] **Step 3: Add a user message with code to the `UserMessageOnly` story**

Replace the existing `UserMessageOnly` story:

```tsx
export const UserMessageOnly: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.UserMessage>
          Show me all **housing expenses** from last month
        </ChatMessages.UserMessage>
      </ChatMessages.List>
    );
  },
};
```

with:

```tsx
export const UserMessageOnly: StoryObj<typeof ChatMessages.List> = {
  render() {
    return (
      <ChatMessages.List>
        <ChatMessages.UserMessage>
          {`Show me all **housing expenses** from last month

\`\`\`json
{"category": "housing", "period": "2026-06"}
\`\`\`

Run the query with \`plata query --housing\`.`}
        </ChatMessages.UserMessage>
      </ChatMessages.List>
    );
  },
};
```

- [ ] **Step 4: Run `vp check` to verify lint + typecheck + format**

Run: `vp check`
Expected: PASS — no type errors, no lint errors, formatting clean.

- [ ] **Step 5: Run `vp test` to confirm no regressions**

Run: `vp test`
Expected: PASS — all existing tests pass (no UI component tests exist, but the suite confirms nothing else broke).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/chat-messages.stories.tsx
git commit -m "feat(ui): add code block examples to chat message stories"
```

---

## Verification

After both tasks:

- [ ] **Final check: Run `vp check` and `vp test` together**

Run: `vp check && vp test`
Expected: Both PASS.

- [ ] **Optional: Run Storybook to visually verify**

Run: `vp run storybook`
Expected: The `Conversation`, `AssistantMessageMarkdown`, and `UserMessageOnly` stories render inline code as subtle pills and fenced code blocks as dark (AI) / dimmed (user) rectangles with mono font.
