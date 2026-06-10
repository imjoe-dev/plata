# PromptInput Skeleton — SSR Fallback

**Date:** 2026-06-09
**Status:** Design approved

## Context

The `PromptInput` component wraps `@tiptap/react` (`useEditor`), which is client-only. During SSR (TanStack Router + Vite), `useEditor()` returns `null` until the client hydrates. Without a skeleton, the input area renders nothing, causing a visible layout pop when the editor mounts.

## Design

### Two changes to `src/components/ui/prompt-input.tsx`

#### 1. New `PromptInput.Skeleton` sub-component

A visual placeholder that mirrors the editor's shape. Renders two "text line" blocks using `animate-pulse` (existing Tailwind animation, same as the generic `Skeleton` component).

**Visual spec:**

- Border: `border-hairline`, 1px rounded
- Background: `bg-sunken`
- Min height: `44px` (matches editor padding + content)
- Padding: `px-4 py-3` (matches editor)
- Width: `w-full` (fills container)
- Animation: `animate-pulse` (Tailwind built-in)
- Content: two `bg-raised` rectangles inside (3/4 width, 1/2 width, each ~12px tall, stacked with margin)

**Props:** `React.ComponentProps<"div">` — accepts `className` and standard div attributes.

**Export:** Added to the `PromptInput` namespace object as `Skeleton`.

#### 2. Auto-detection in `PromptInput.Root`

When `editor === null`, render `<PromptInput.Skeleton />` instead of children:

```tsx
if (!editor) {
  return <PromptInput.Skeleton />;
}
```

This means:

- SSR: skeleton renders on server
- Client hydration: once Tiptap initializes and `editor` becomes non-null, children render
- Page code (`index.tsx`) requires zero changes — clean call sites

### What does NOT change

- `index.tsx` — call sites stay identical
- Controlled/uncontrolled modes — detection is purely on `editor` reference
- `disabled` prop — handled post-hydration as before
- No new dependencies

### Edge cases

| Scenario                  | Behavior                                              |
| ------------------------- | ----------------------------------------------------- |
| SSR first render          | Skeleton shown (editor is null)                       |
| Client hydration complete | Skeleton swapped for real editor (editor is non-null) |
| Editor creation fails     | Skeleton stays indefinitely (editor stays null)       |
| Disabled prop passed      | Handled after hydration, same as current behavior     |
