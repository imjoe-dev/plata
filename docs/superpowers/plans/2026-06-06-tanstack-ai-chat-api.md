# TanStack AI Chat API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install `@tanstack/ai`, `@tanstack/ai-openai`, and `zod`, then create a single `POST /api/chat` endpoint with Zod validation that streams LLM responses via SSE.

**Architecture:** A TanStack Start file-based API route at `src/routes/api/chat.ts` following the same `createFileRoute` + `server.handlers` pattern as the existing auth route. Zod validates `{ modelId, messages }` against TanStack AI's message shape. The handler looks up an OpenAI adapter by model ID, calls `chat()`, and returns `toServerSentEventsResponse(stream)`.

**Tech Stack:** `@tanstack/ai`, `@tanstack/ai-openai`, `zod`, TanStack Start server handler pattern.

---

### Task 1: Install dependencies

**Files:**

- Modify: `package.json` (pnpm will update)

- [ ] **Step 1: Add the three packages**

Run: `vp add @tanstack/ai @tanstack/ai-openai zod`

Expected: packages installed, `package.json` and `pnpm-lock.yaml` updated.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @tanstack/ai, @tanstack/ai-openai, zod"
```

---

### Task 2: Create the chat API route

**Files:**

- Create: `src/routes/api/chat.ts`

- [ ] **Step 1: Write the complete route file**

```typescript
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SUPPORTED_MODELS = ["gpt-4o", "gpt-4o-mini", "o3-mini"] as const;
type SupportedModel = (typeof SUPPORTED_MODELS)[number];

const adapters: Record<SupportedModel, ReturnType<typeof openaiText>> = {
  "gpt-4o": openaiText("gpt-4o"),
  "gpt-4o-mini": openaiText("gpt-4o-mini"),
  "o3-mini": openaiText("o3-mini"),
};

const contentPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({
    type: z.literal("image"),
    source: z.object({
      type: z.enum(["url", "data"]),
      value: z.string(),
    }),
  }),
]);

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(contentPartSchema)]),
});

const bodySchema = z.object({
  modelId: z.enum(SUPPORTED_MODELS),
  messages: z.array(messageSchema),
});

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const { modelId, messages } = bodySchema.parse(body);

        const stream = chat({
          adapter: adapters[modelId],
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
git commit -m "feat: add /api/chat endpoint with Zod validation and OpenAI streaming"
```

---

### Task 3: Verify

- [ ] **Step 1: Run type check, lint, and format**

Run: `vp check`

Expected: no errors.

- [ ] **Step 2: Commit (if any fixes from vp check)**

```bash
git add -A
git commit -m "chore: fix lint/format/type issues from vp check"
```

---

### Task 4: Verify OPENAI_API_KEY is wired

- [ ] **Step 1: Confirm the key is in .env.local**

The `openaiText` adapter reads `OPENAI_API_KEY` from the environment automatically. Verify `.env.local` contains:

```
OPENAI_API_KEY=sk-...
```

If missing, add it (do NOT commit the key).

- [ ] **Step 2: No commit needed (env vars are not committed)**
