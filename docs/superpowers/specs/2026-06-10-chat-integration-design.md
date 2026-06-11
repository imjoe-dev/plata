# Chat Integration — Design Spec

**Date:** 2026-06-10  
**Scope:** Connect `/_protected/` page to `/api/chat` using `@tanstack/ai`

## Architecture

Three-layer separation:

```
src/hooks/use-plata-chat.ts          ← AI integration (custom hook)
src/components/pages/home-page.tsx   ← Presentation (page component)
src/routes/_protected/index.tsx      ← Routing (thin glue)
src/routes/api/chat.ts              ← Updated API route
```

## Data Flow

```
usePlataChat (useChat + forwardedProps)
  → POST /api/chat (SSE)
  → { messages, isLoading, error, sendMessage }
    → HomePage (props)
      → ChatMessages.List + PromptInput
```

## Files

### 1. `src/hooks/use-plata-chat.ts` (new)

Custom hook wrapping `useChat` from `@tanstack/ai-react`:

- Connection: `fetchServerSentEvents("/api/chat")`
- Forwarded props: `{ model_id: "gpt-5.4-mini" }` (hardcoded for now)
- Returns: `{ messages, sendMessage, isLoading, error, stop }`

### 2. `src/components/pages/home-page.tsx` (new)

Pure presentational component. Props:

```ts
{
  messages: UIMessage[];
  isLoading: boolean;
  error?: Error;
  onSend: (content: string) => void;
  onStop?: () => void;
}
```

States:

- **Empty (no messages):** Logo + prompt input centered
- **Has messages:** Header bar + message list + prompt input at bottom
- **Loading:** Disabled prompt input while streaming
- **Error:** Error state (text display for now)

Renders messages using existing `ChatMessages.UserMessage` / `ChatMessages.AssistantMessage` by extracting text content from `message.parts`.

### 3. `src/routes/_protected/index.tsx` (replace)

Thin route component:

```tsx
function HomePage() {
  const chat = usePlataChat();
  return <HomePageView {...chat} onSend={chat.sendMessage} onStop={chat.stop} />;
}
```

### 4. `src/routes/api/chat.ts` (update)

Extract `model_id` from `forwardedProps` (AG-UI compliant) instead of top-level body:

```ts
const { messages, forwardedProps } = await chatParamsFromRequestBody(body);
const { model_id } = modelIdSchema.parse(forwardedProps ?? {});
```

## Out of Scope

- Tool calls (explicitly excluded per user)
- Model selector UI
- Error retry logic
- Message persistence
