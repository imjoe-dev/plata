# ScrollArea Component & Chat Scroll Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a ScrollArea component using @base-ui/react's composition API and integrate it into the chat page so the scrollbar sits at the viewport edge with minimal thumb styling.

**Architecture:** New `src/components/ui/scroll-area.tsx` exports a `ScrollArea` object with `Root`, `Viewport`, `Content`, `Scrollbar`, `Thumb`, and `Corner` sub-components wrapping their `@base-ui/react/scroll-area` counterparts with design-system class defaults. The homepage (`src/routes/_protected/index.tsx`) wraps `ChatMessages.List` in the new ScrollArea, overriding its `overflow-y-auto` and `p-4` via `cn()`. The `chat-messages.tsx` file is not modified.

**Tech Stack:** React 19, @base-ui/react ScrollArea, Tailwind CSS v4, tailwind-merge (via `cn()`)

---

### Task 1: Create the ScrollArea component

**Files:**

- Create: `src/components/ui/scroll-area.tsx`

- [ ] **Step 1: Create `src/components/ui/scroll-area.tsx`**

```tsx
import { ScrollArea as Base } from "@base-ui/react/scroll-area";
import { cn } from "@/lib/utils";

function Root({ className, ...props }: Base.Root.Props) {
  return <Base.Root className={cn(className)} {...props} />;
}

function Viewport({ className, ...props }: Base.Viewport.Props) {
  return <Base.Viewport className={cn("h-full w-full", className)} {...props} />;
}

function Content({ className, ...props }: Base.Content.Props) {
  return <Base.Content className={cn(className)} {...props} />;
}

function Scrollbar({ className, ...props }: Base.Scrollbar.Props) {
  return (
    <Base.Scrollbar
      className={cn("flex touch-none select-none flex-col p-0.5", className)}
      {...props}
    />
  );
}

function Thumb({ className, ...props }: Base.Thumb.Props) {
  return (
    <Base.Thumb
      className={cn(
        "relative flex-1 rounded-none",
        "bg-fg-muted opacity-0 transition-opacity duration-300",
        "group-data-[hovering]:opacity-100 group-data-[scrolling]:opacity-100",
        "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-1",
        className,
      )}
      {...props}
    />
  );
}

function Corner({ className, ...props }: Base.Corner.Props) {
  return <Base.Corner className={cn("hidden", className)} {...props} />;
}

export const ScrollArea = {
  Root,
  Viewport,
  Content,
  Scrollbar,
  Thumb,
  Corner,
};
```

Key design decisions:

- `Root`: no default classes — consumer provides layout (e.g., `flex-1`)
- `Viewport`: default `h-full w-full` so it fills its parent
- `Scrollbar`: `flex touch-none select-none p-0.5` — the `group-data-[hovering]`/`group-data-[scrolling]` selectors rely on the Scrollbar being a grouping element via base-ui's `data-hovering` and `data-scrolling` attributes on the Root
- `Thumb`: 4px wide (`w-1`), `bg-fg-muted`, hidden by default (`opacity-0`), appears on group hover/scroll via `group-data-[hovering]:opacity-100` and `group-data-[scrolling]:opacity-100`
- `Corner`: hidden since we only need vertical scrolling in the chat

- [ ] **Step 2: Verify the component builds without errors**

Run: `pnpm run build`
Expected: Build succeeds with no type errors related to scroll-area.tsx

- [ ] **Step 3: Commit the ScrollArea component**

```bash
git add src/components/ui/scroll-area.tsx
git commit -m "feat: add ScrollArea component wrapping @base-ui/react ScrollArea"
```

---

### Task 2: Integrate ScrollArea into the chat page

**Files:**

- Modify: `src/routes/_protected/index.tsx`

- [ ] **Step 1: Update the import and JSX in `src/routes/_protected/index.tsx`**

Add `ScrollArea` import:

```tsx
import { ScrollArea } from "@/components/ui/scroll-area";
```

Replace the `ChatMessages.List` block (lines 42-60) with:

```tsx
<ScrollArea.Root className="flex-1">
  <ScrollArea.Viewport>
    <ScrollArea.Content className="mx-auto max-w-4xl px-4">
      <ChatMessages.List className="overflow-y-visible p-0">
        {messages.map((message: UIMessage) =>
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
    </ScrollArea.Content>
  </ScrollArea.Viewport>
  <ScrollArea.Scrollbar>
    <ScrollArea.Thumb />
  </ScrollArea.Scrollbar>
</ScrollArea.Root>
```

The original `ChatMessages.List` had these classes applied from the page:

- `mx-auto w-full max-w-4xl flex-1` — these are now replaced by the ScrollArea structure:
  - `mx-auto max-w-4xl` moves to `ScrollArea.Content`
  - `w-full flex-1` moves to `ScrollArea.Root` (as `flex-1`)
  - The `px-4` horizontal padding moves from the List's internal `p-4` (overridden to `p-0`) to `ScrollArea.Content`
- `overflow-y-auto` is overridden by `overflow-y-visible` on `ChatMessages.List` (via `cn()` merge) since scroll is now handled by `ScrollArea.Viewport`
- `p-4` is overridden to `p-0` since padding is now on `ScrollArea.Content`

- [ ] **Step 2: Verify the build succeeds**

Run: `pnpm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Verify visually in the browser**

Run: `pnpm run dev`
Expected behavior:

1. Open the app, send a message, receive a response
2. Continue until messages overflow the viewport
3. The scrollbar should appear at the far right edge of the screen (not aligned with the max-w-4xl content)
4. The thumb should be 4px wide, `bg-fg-muted` colored, with no border-radius
5. The thumb should be invisible when not scrolling/hovering, and appear when the user hovers over the scroll area or is actively scrolling
6. Auto-scroll to the bottom should still work (the sentinel ref in ChatMessages.List finds ScrollArea.Viewport as the scroll container)
7. Message content should remain centered at `max-w-4xl`

- [ ] **Step 4: Commit the integration**

```bash
git add src/routes/_protected/index.tsx
git commit -m "feat: integrate ScrollArea into chat page for edge-anchored scrollbar"
```

---

### Self-Review

**1. Spec coverage:**

- ✅ ScrollArea component created with composition pattern (Root, Viewport, Content, Scrollbar, Thumb, Corner)
- ✅ ScrollArea wraps ChatMessages.List in homepage
- ✅ ChatMessages.List override via cn() (overflow-y-visible p-0)
- ✅ Edge-anchored scrollbar via full-width Root + centered Content
- ✅ Auto-show thumb (opacity transitions with data-hovering/data-scrolling)
- ✅ 4px thumb, bg-fg-muted, rounded-none
- ✅ chat-messages.tsx not modified

**2. Placeholder scan:** No TBDs, TODOs, or vague references found.

**3. Type consistency:** All sub-component names (Root, Viewport, Content, Scrollbar, Thumb, Corner) are consistent between plan and spec. Prop types match @base-ui/react ScrollArea API (Base.Root.Props, Base.Scrollbar.Props with orientation, etc.).
