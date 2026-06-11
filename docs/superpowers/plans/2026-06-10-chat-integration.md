# Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the `/_protected/` page to `/api/chat` using `@tanstack/ai-react`'s `useChat` hook.

**Architecture:** Custom hook (`usePlataChat`) wraps `useChat` with `forwardedProps` for model selection, consumed directly by the route component. `PromptInput.Root` gains an `onSubmit` prop so the page can send messages without HTML-stripping hacks. API route updated to read `model_id` from AG-UI `forwardedProps`.

**Tech Stack:** `@tanstack/ai-react` (client hook), `@tanstack/ai` (server), TipTap (editor text extraction), Vite+ toolchain.

---

### Task 1: Install `@tanstack/ai-react`

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml` (via vp add)

- [ ] **Step 1: Add the package**

```bash
vp add @tanstack/ai-react
```

Expected: Package installed, lockfile updated.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add @tanstack/ai-react"
```

---

### Task 2: Update API route to read `model_id` from `forwardedProps`

**Files:**

- Modify: `src/routes/api/chat.ts`

**Context:** `useChat` sends requests in AG-UI `RunAgentInput` format where `model_id` is nested inside `forwardedProps` (not top-level body). The API route must extract it from there.

- [ ] **Step 1: Replace `model_id` extraction logic**

Replace lines 22-24 in `src/routes/api/chat.ts`:

```ts
const body = await request.json();
const { model_id } = modelIdSchema.parse(body);
const { messages } = await chatParamsFromRequestBody(body);
```

With:

```ts
const body = await request.json();
const { messages, forwardedProps } = await chatParamsFromRequestBody(body);
const { model_id } = modelIdSchema.parse(forwardedProps ?? {});
```

Full file after change:

```ts
import { chat, chatParamsFromRequestBody, toServerSentEventsResponse } from "@tanstack/ai";
import { createOpenaiChat, openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";

const SUPPORTED_MODELS = ["gpt-5.4-mini"] as const;
type SupportedModel = (typeof SUPPORTED_MODELS)[number];

const adapters: Record<SupportedModel, ReturnType<typeof openaiText>> = {
  "gpt-5.4-mini": createOpenaiChat("gpt-5.4-mini", env.OPENAI_API_KEY),
};

const modelIdSchema = z.object({
  model_id: z.enum(SUPPORTED_MODELS),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const { messages, forwardedProps } = await chatParamsFromRequestBody(body);
        const { model_id } = modelIdSchema.parse(forwardedProps ?? {});

        const stream = chat({
          adapter: adapters[model_id],
          messages,
        });

        return toServerSentEventsResponse(stream);
      },
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/api/chat.ts
git commit -m "fix: read model_id from forwardedProps in chat API route"
```

---

### Task 3: Create `usePlataChat` custom hook

**Files:**

- Create: `src/hooks/use-plata-chat.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";

export function usePlataChat() {
  return useChat({
    connection: fetchServerSentEvents("/api/chat"),
    forwardedProps: { model_id: "gpt-5.4-mini" },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-plata-chat.ts
git commit -m "feat: add usePlataChat hook with @tanstack/ai-react"
```

---

### Task 4: Add `onSubmit` prop to `PromptInput.Root`

**Files:**

- Modify: `src/components/ui/prompt-input.tsx`

**Context:** Replace the `stripHtml` hack by using TipTap's built-in `editor.getText()`. Add an optional `onSubmit` prop to `PromptInput.Root` that fires on Enter (without Shift), calls `editor.getText()`, and clears content.

- [ ] **Step 1: Add `onSubmit` to the `RootProps` interface**

Find the `RootProps` interface (line 31) and add the `onSubmit` prop:

```ts
interface RootProps {
  defaultValue?: string;
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  onSubmit?: (text: string) => void;
}
```

- [ ] **Step 2: Destructure and wire `onSubmit` in the `Root` function**

Find the `Root` function signature (line 41) and add `onSubmit`:

```ts
function Root({
  defaultValue = "",
  value,
  onChange,
  placeholder = "",
  disabled = false,
  className,
  children,
  onSubmit,
}: RootProps) {
```

- [ ] **Step 3: Add an `onKeyDown` handler to the editor wrapper div**

Find the `<div>` wrapping the children in the `Root` return (line 108-110):

```tsx
return (
  <PromptInputContext.Provider value={{ editor }}>
    <div className={cn("flex flex-col", disabled && "pointer-events-none opacity-40", className)}>
      {children}
    </div>
  </PromptInputContext.Provider>
);
```

Replace with:

```tsx
return (
  <PromptInputContext.Provider value={{ editor }}>
    <div
      className={cn("flex flex-col", disabled && "pointer-events-none opacity-40", className)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && onSubmit && editor) {
          e.preventDefault();
          const text = editor.getText().trim();
          if (text) {
            onSubmit(text);
            editor.commands.clearContent();
          }
        }
      }}
    >
      {children}
    </div>
  </PromptInputContext.Provider>
);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/prompt-input.tsx
git commit -m "feat: add onSubmit prop to PromptInput.Root for chat submission"
```

---

### Task 5: Wire up the route component

**Files:**

- Modify: `src/routes/_protected/index.tsx`

**Context:** Replace hardcoded static messages with live `usePlataChat` data. Messages from `useChat` are `UIMessage[]` with `{ role, parts: [{ type, content }] }`. Extract text parts and render via `ChatMessages.UserMessage`/`ChatMessages.AssistantMessage`. Use `PromptInput.Root`'s new `onSubmit` prop to call `sendMessage`.

- [ ] **Step 1: Replace the route component**

Replace the entire file:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ChatMessages } from "@/components/ui/chat-messages";
import { PromptInput } from "@/components/ui/prompt-input";
import { usePlataChat } from "@/hooks/use-plata-chat";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});

function HomePage() {
  const { messages, sendMessage, isLoading, error } = usePlataChat();

  function handleSubmit(text: string) {
    sendMessage(text);
  }

  const prompt = (
    <PromptInput.Root placeholder="Ask anything..." disabled={isLoading} onSubmit={handleSubmit}>
      <PromptInput.Editor />
    </PromptInput.Root>
  );

  if (!messages.length) {
    return (
      <div className="bg-base flex h-screen flex-col items-center justify-center gap-6">
        <h1 className="text-fg-strong font-serif text-6xl leading-none tracking-tight">plata</h1>
        <p className="text-fg-muted text-sm">What would you like to know?</p>
        <div className="w-full max-w-4xl px-4">{prompt}</div>
      </div>
    );
  }

  return (
    <div className="bg-base flex h-screen flex-col">
      <div className="shrink-0 px-4 py-3">
        <span className="text-fg-faint font-mono text-[10px] font-medium tracking-wider uppercase">
          plata
        </span>
      </div>

      <ChatMessages.List className="mx-auto w-full max-w-4xl flex-1">
        {messages.map((message) =>
          message.role === "user" ? (
            <ChatMessages.UserMessage key={message.id}>
              {message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.content)
                .join("")}
            </ChatMessages.UserMessage>
          ) : (
            <ChatMessages.AssistantMessage key={message.id}>
              {message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.content)
                .join("")}
            </ChatMessages.AssistantMessage>
          ),
        )}
      </ChatMessages.List>

      <div className="mx-auto w-full max-w-4xl shrink-0 px-4 pb-6">{prompt}</div>

      {error && (
        <div className="mx-auto w-full max-w-4xl px-4 pb-4">
          <p className="text-fg-error text-sm">Something went wrong. Please try again.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/_protected/index.tsx
git commit -m "feat: integrate usePlataChat hook in home page"
```

---

### Task 6: Verify

- [ ] **Step 1: Run type check, lint, and format**

```bash
vp check
```

Expected: Zero errors.

- [ ] **Step 2: Run tests**

```bash
vp test
```

Expected: All existing tests pass.
