# Chat Scroll and Focus Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix prompt input scrolling with content and losing focus after message submission on the chat page.

**Architecture:** Three targeted changes: (1) constrain ScrollArea overflow so it becomes the sole scrolling container, (2) lock html/body viewport to prevent page-level scroll, (3) decouple editor disabled state from loading state so TipTap focus survives submission.

**Tech Stack:** React 19, TypeScript, TipTap, @base-ui/react/scroll-area, Tailwind CSS

---

### Task 1: Constrain ScrollArea.Root overflow

**Files:**

- Modify: `src/components/ui/scroll-area.tsx:4-6`

- [ ] **Step 1: Add `overflow-hidden` to Root wrapper**

```tsx
function Root({ className, ...props }: Base.Root.Props) {
  return <Base.Root className={cn("overflow-hidden", className)} {...props} />;
}
```

Change existing lines 4-6 in `src/components/ui/scroll-area.tsx` — add `"overflow-hidden"` as the first argument to `cn()` so it's always applied before any caller-provided classNames.

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm exec tsc --noEmit src/components/ui/scroll-area.tsx`
Expected: No errors (may show unrelated project-wide errors — scroll-area.tsx itself should have none).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/scroll-area.tsx
git commit -m "fix: add overflow-hidden to ScrollArea.Root for proper scroll containment"
```

---

### Task 2: Lock viewport to prevent page-level scrolling

**Files:**

- Modify: `src/styles.css:68-72`

- [ ] **Step 1: Add `overflow: hidden` and `height: 100%` to html/body/#app rule**

```css
html,
body,
#app {
  overflow: hidden;
  height: 100%;
  min-height: 100%;
}
```

Change existing lines 68-72 in `src/styles.css` — add `overflow: hidden` and `height: 100%` before `min-height: 100%`.

- [ ] **Step 2: Verify no build errors**

Run: `pnpm build`
Expected: Build succeeds (test this compiles the CSS without error).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "fix: lock viewport with overflow hidden to prevent page-level scroll"
```

---

### Task 3: Keep editor focused after message submission

**Files:**

- Modify: `src/routes/_protected/index.tsx:12-23`

- [ ] **Step 1: Guard handleSubmit against double-submission**

Change the `handleSubmit` function (line 15-17) to:

```tsx
function handleSubmit(text: string) {
  if (isLoading) return;
  void sendMessage(text);
}
```

- [ ] **Step 2: Remove `disabled={isLoading}` from PromptInput.Root**

Change line 20 from:

```tsx
<PromptInput.Root placeholder="Ask anything..." disabled={isLoading} onSubmit={handleSubmit}>
```

to:

```tsx
<PromptInput.Root placeholder="Ask anything..." onSubmit={handleSubmit}>
```

The `disabled` prop is removed entirely.

- [ ] **Step 3: Verify the file compiles**

Run: `pnpm exec tsc --noEmit src/routes/_protected/index.tsx`
Expected: No type errors related to the changes.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_protected/index.tsx
git commit -m "fix: keep prompt input focused after message submission"
```

---

### Verification

After all tasks are complete, run the dev server and manually verify:

1. Send enough messages to overflow the viewport. Scroll up — the prompt input stays fixed at the bottom.
2. Submit a message — the editor clears and focus remains in the input (cursor blinking).
3. Press Enter while an LLM response is streaming — nothing happens (guard prevents double-submit).
