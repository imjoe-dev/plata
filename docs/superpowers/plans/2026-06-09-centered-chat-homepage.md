# Centered Chat Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "plata" splash screen with a single-viewport centered chat layout composing existing `ChatMessages` and `PromptInput` components.

**Architecture:** The `HomePage` component in `src/routes/_protected/index.tsx` becomes a pure layout composition. It uses `ChatMessages.List`, `ChatMessages.UserMessage`, `ChatMessages.AssistantMessage`, and `PromptInput` (Root + Editor) arranged in a centered flex column. Two render paths: empty state (centered wordmark) and messages state (corner wordmark + scrollable message list + pinned input). No new components, no new files.

**Tech Stack:** React 19, TanStack Router, Tailwind v4, existing compound components (ChatMessages, PromptInput)

---

### Task 1: Replace HomePage with centered chat layout

**Files:**

- Modify: `src/routes/_protected/index.tsx`

- [ ] **Step 1: Replace the HomePage component**

Replace the entire file content:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ChatMessages } from "@/components/ui/chat-messages";
import { PromptInput } from "@/components/ui/prompt-input";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});

function HomePage() {
  const hasMessages = false;

  if (!hasMessages) {
    return (
      <div className="bg-base flex h-screen flex-col items-center justify-center gap-6">
        <h1 className="font-serif text-6xl leading-none tracking-tight text-fg-strong">plata</h1>
        <p className="text-fg-muted text-sm">What would you like to know?</p>
        <div className="w-full max-w-xl px-4">
          <PromptInput.Root placeholder="Ask anything...">
            <PromptInput.Editor />
          </PromptInput.Root>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base flex h-screen flex-col">
      <div className="shrink-0 px-4 py-3">
        <span className="text-fg-faint font-mono text-[10px] font-medium uppercase tracking-wider">
          plata
        </span>
      </div>

      <ChatMessages.List className="flex-1 max-w-xl mx-auto w-full">
        <ChatMessages.UserMessage>What's our Q2 revenue?</ChatMessages.UserMessage>
        <ChatMessages.AssistantMessage>
          Q2 revenue was $2.4M, up 12% from Q1.
        </ChatMessages.AssistantMessage>
      </ChatMessages.List>

      <div className="shrink-0 max-w-xl mx-auto w-full px-4 pb-6">
        <PromptInput.Root placeholder="Ask anything...">
          <PromptInput.Editor />
        </PromptInput.Root>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/routes/_protected/index.tsx
git commit -m "feat: add centered chat homepage layout"
```
