# ScrollArea Component & Chat Scroll Refactor — Design Spec

**Date:** 2026-06-10

## Summary

Create a new `ScrollArea` component following the @base-ui/react composition API and use it in the chat page to replace the browser-native scrollbar with a custom, edge-anchored scrollbar that appears on scroll/hover.

## Decisions

| Decision             | Choice                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scrollbar placement  | Edge-anchored — sits at the rightmost edge of the viewport, decoupled from the centered content column                                                |
| Visibility behavior  | Auto-show — thumb appears on scroll or hover, fades out after ~1.5s of inactivity                                                                     |
| Styling              | Minimal — 4px thumb in `--fg-muted`, no visible track. `rounded-none` per design system                                                               |
| Integration approach | Wrap `ChatMessages.List` in `ScrollArea`, override its `overflow-y-auto` and `p-4` via `cn()` className merge (no file change to `chat-messages.tsx`) |

## Component: `src/components/ui/scroll-area.tsx`

### API

Object export matching the library's composition pattern (consistent with `tooltip.tsx`, `radio-group.tsx`):

```tsx
import { ScrollArea as Base } from "@base-ui/react/scroll-area";

export const ScrollArea = {
  Root, // Base.Root — passthrough, no default styling
  Viewport, // Base.Viewport — scrollable viewport
  Content, // Base.Content — content wrapper
  Scrollbar, // Base.Scrollbar — track area for thumb
  Thumb, // Base.Thumb — 4px draggable thumb
  Corner, // Base.Corner — hidden (not needed for vertical-only)
};
```

### Sub-component styling

| Sub-component | Default classes                                                                                                                               | Notes                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Root`        | None — consumer provides layout classes (`flex-1`, `h-full`, etc.)                                                                            | Pure container                                                                                       |
| `Viewport`    | `h-full w-full`                                                                                                                               | Full-size scroll container                                                                           |
| `Content`     | None — consumer provides centering                                                                                                            | Wraps content                                                                                        |
| `Scrollbar`   | `flex flex-col touch-none select-none p-0.5`                                                                                                  | Thin track area; `p-0.5` gives slight padding so thumb doesn't touch viewport edge                   |
| `Thumb`       | `w-1 bg-fg-muted rounded-none opacity-0 transition-opacity duration-300 group-data-[hovering]:opacity-100 group-data-[scrolling]:opacity-100` | 4px thumb, no radius; hidden by default, appears when hovering the scroll area or actively scrolling |
| `Corner`      | `hidden`                                                                                                                                      | Not needed for vertical-only chat scroll                                                             |

### State styling references

From the design system (`components.md`):

- `rounded-none` on all elements
- `duration-fast` (100ms) for transitions; ~1.5s fade-out via tailwind-merge override or inline `data-ending-style` animation
- Thumb uses `bg-fg-muted` (consistent with the design system's scrollable areas like Modal body)

## Homepage integration: `src/routes/_protected/index.tsx`

### Before

```tsx
<ChatMessages.List className="mx-auto w-full max-w-4xl flex-1">
  {messages.map((message: UIMessage) => ... )}
</ChatMessages.List>
```

`ChatMessages.List` internally renders a `<div>` with `overflow-y-auto` and `p-4`.

### After

```tsx
<ScrollArea.Root className="flex-1">
  <ScrollArea.Viewport>
    <ScrollArea.Content className="mx-auto max-w-4xl px-4">
      <ChatMessages.List className="overflow-y-visible p-0">
        {messages.map((message: UIMessage) => ... )}
      </ChatMessages.List>
    </ScrollArea.Content>
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar>
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
</ScrollArea.Root>
```

### Key layout mechanics

1. `ScrollArea.Root` gets `flex-1` — fills the remaining height between the "plata" header and the prompt input
2. `ScrollArea.Viewport` is `h-full w-full` — provides the actual scroll container
3. `ScrollArea.Content` handles centering (`mx-auto max-w-4xl px-4`)
4. `ChatMessages.List` retains `flex flex-col gap-3` from its internal classes, but `overflow-y-auto` is overridden to `overflow-y-visible` and `p-4` to `p-0` via `cn()` merge. **No file change to `chat-messages.tsx`.**
5. The `scrollIntoView` sentinel ref in `ChatMessages.List` still works — `ScrollArea.Viewport` becomes the nearest scrollable ancestor
6. The scrollbar sits at the right edge of `ScrollArea.Root` (full viewport width), achieving the edge-anchored placement

### Auto-scroll behavior

The existing `useEffect` with `sentinelRef.current?.scrollIntoView({ behavior: "smooth" })` in `ChatMessages.List` is preserved without modification. It will find the `ScrollArea.Viewport` as the scrollable container and work correctly.

## ChatMessages.List — no changes

File `src/components/ui/chat-messages.tsx` is **not modified**. All overrides happen at the consumer level via `className` prop merging through `cn()`.

## Constraints

- `ChatMessages.List` must not be modified
- ScrollArea must follow the composition pattern from @base-ui/react
- All styling must use the design system tokens from `styles.css` and `components.md`
- No `rounded-*` except `rounded-none`
- Transitions use `duration-fast` (100ms) or `duration-base` (150ms)
