# Centered Chat Homepage

**Date:** 2026-06-09
**Status:** approved

## Summary

Replace the current "plata" splash screen with a single-viewport, centered chat layout. No sidebar, no topbar — just a message column and a floating input.

## Layout

```
┌─────────────────────────────────────┐
│ plata (wordmark, top-left)          │
│                                     │
│         ┌─────────────────┐         │
│         │  User message    │         │  ← centered column, max-w-xl
│         └─────────────────┘         │
│    ┌──────────────────────────┐     │
│    │  Assistant response      │     │
│    └──────────────────────────┘     │
│                                     │
│        ┌─────────────────┐         │
│        │  Ask anything... │         │  ← floating input, pinned bottom
│        └─────────────────┘         │
└─────────────────────────────────────┘
```

## Two states

| State             | Behavior                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Empty**         | Wordmark centered at larger size with subtitle "What would you like to know?". Floating input below.                                                                |
| **With messages** | Wordmark shrinks to top-left corner (`text-[10px] font-mono uppercase tracking-wider text-fg-faint`). Messages scroll in a centered column. Input pinned at bottom. |

## Implementation

### Files changed

**`src/routes/_protected/index.tsx`** — the `HomePage` component replaces the current centered heading with the chat layout.

### Components used (existing, no new files)

- `ChatMessages.List` — scrollable message container
- `ChatMessages.UserMessage` / `ChatMessages.AssistantMessage` — message bubbles
- `PromptInput` — floating input from `@/components/ui/prompt-input`

### Architecture

The `HomePage` component composes existing compound components. No new abstractions. Follows Vercel composition patterns: composition over boolean props, children over render props, explicit variants over modes.

### Design system

- Colors: `bg-base`, `text-fg`, `text-fg-muted`, `text-fg-faint`, `border-hairline`
- Wordmark: `font-serif` for main mark, `font-mono` for corner label
- Input: `rounded-none`, per components.md
- No shadows, no gradients, no border-radius except where specified
