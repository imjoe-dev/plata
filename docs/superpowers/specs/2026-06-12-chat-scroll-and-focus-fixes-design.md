# Chat scroll and focus fixes

**Date:** 2026-06-12
**Status:** approved

## Problem

Two UX issues on the chat page (`src/routes/_protected/index.tsx`):

1. **Prompt input scrolls with content.** When the message list is long, scrolling up to see older messages causes the prompt input to scroll with the page instead of staying fixed at the bottom. The ScrollArea should be the sole scrolling container.

2. **Prompt input loses focus after submit.** Pressing Enter to send a message clears the input and the LLM starts responding, but the editor loses focus. The user must click the input again to type their next message.

## Root causes

### Issue 1: Scroll containment

The `@base-ui/react/scroll-area` Root component does not apply `overflow: hidden`. Without it, the Viewport's content can overflow the Root's bounds and push elements below it (the prompt input) downward, making the entire page scrollable. Additionally, the `html`/`body` elements do not prevent page-level scrolling (`min-height: 100%` only, no `overflow: hidden`).

### Issue 2: Focus loss

`disabled={isLoading}` on `PromptInput.Root` calls `editor.setEditable(false)` via a `useEffect` in the PromptInput component. Setting the TipTap editor to non-editable blurs it. The `editor.commands.focus()` call in `handleOnKeyDown` runs first, but is immediately overridden by the `disabled`→`setEditable(false)` cycle. When `isLoading` returns to `false`, editability is restored but focus is not.

## Design

### Fix 1: Scroll containment (2 files)

**`src/components/ui/scroll-area.tsx`** — Add `overflow-hidden` to the Root wrapper so it becomes a proper constraint boundary:

```tsx
function Root({ className, ...props }: Base.Root.Props) {
  return <Base.Root className={cn("overflow-hidden", className)} {...props} />;
}
```

**`src/styles.css`** — Add `overflow: hidden` and `height: 100%` to `html, body, #app` to lock the viewport and prevent page-level scrolling:

```css
html,
body,
#app {
  overflow: hidden;
  height: 100%;
  min-height: 100%;
}
```

The `height: 100%` ensures the `h-screen` flex container in the page component resolves correctly. `overflow: hidden` guarantees no page-level scrollbar appears.

### Fix 2: Focus preservation (1 file)

**`src/routes/_protected/index.tsx`** — Two changes:

1. Remove `disabled={isLoading}` from `PromptInput.Root`. The editor stays enabled at all times, so `editor.commands.focus()` in `handleOnKeyDown` works without interference from `setEditable(false)`.

2. Add a guard in `handleSubmit` to prevent double-submission while a message is in flight:

```tsx
function handleSubmit(text: string) {
  if (isLoading) return;
  void sendMessage(text);
}
```

The user can type their next message while the LLM is responding. Visual feedback for loading state is already provided by the streaming assistant message appearing in the chat list.

## Files changed

| File                                | Change                                                      |
| ----------------------------------- | ----------------------------------------------------------- |
| `src/components/ui/scroll-area.tsx` | Add `overflow-hidden` to Root className                     |
| `src/styles.css`                    | Add `overflow: hidden` and `height: 100%` to html/body/#app |
| `src/routes/_protected/index.tsx`   | Remove `disabled={isLoading}`, add `isLoading` guard        |

## Verification

- Add enough messages to fill the viewport, then scroll up — the prompt input should remain fixed at the bottom
- Submit a message — the editor should clear, keep focus, and be immediately ready for the next message
- Press Enter while a response is streaming — nothing should happen (guard works)
