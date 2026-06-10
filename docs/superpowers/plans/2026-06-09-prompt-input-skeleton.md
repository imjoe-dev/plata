# PromptInput Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an SSR-safe skeleton fallback to `PromptInput.Root` using `useEditor()`'s null state as the detection signal.

**Architecture:** Add a `Skeleton` sub-component to the `PromptInput` namespace that renders a pulse-animated placeholder matching the editor's visual shape. Modify `Root` to render `<Skeleton />` instead of children when `editor === null`. No changes to call sites required.

**Tech Stack:** React, @tiptap/react, Tailwind CSS v4 (semantic tokens), `cn()` util

---

### Task 1: Add PromptInput.Skeleton component and auto-detection in Root

**Files:**

- Modify: `src/components/ui/prompt-input.tsx`

All changes are in one file. No new files needed.

- [ ] **Step 1: Add the Skeleton component function**

Insert after the `EditorSlot` function and before the `export const PromptInput` block (after line 242):

```tsx
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("border-hairline bg-sunken w-full border px-3 py-2 animate-pulse", className)}
      {...props}
    >
      <div className="bg-raised mb-2 h-3 w-3/4 rounded" />
      <div className="bg-raised h-3 w-1/2 rounded" />
    </div>
  );
}
```

- [ ] **Step 2: Modify Root to render Skeleton when editor is null**

In the `Root` function, replace the existing return block (lines 103–109):

```tsx
return (
  <PromptInputContext.Provider value={{ editor }}>
    <div className={cn("flex flex-col", disabled && "pointer-events-none opacity-40", className)}>
      {children}
    </div>
  </PromptInputContext.Provider>
);
```

With:

```tsx
if (!editor) {
  return <Skeleton className={className} />;
}

return (
  <PromptInputContext.Provider value={{ editor }}>
    <div className={cn("flex flex-col", disabled && "pointer-events-none opacity-40", className)}>
      {children}
    </div>
  </PromptInputContext.Provider>
);
```

- [ ] **Step 3: Export Skeleton in the namespace**

Change the export block (lines 244–248) from:

```tsx
export const PromptInput = {
  Root,
  Toolbar,
  Editor: EditorSlot,
};
```

To:

```tsx
export const PromptInput = {
  Root,
  Toolbar,
  Editor: EditorSlot,
  Skeleton,
};
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 5: Verify existing Storybook stories still work**

Run: `npx storybook dev --no-open` (then check render)
Or just verify the existing stories compile without error since the skeleton auto-detection is only visible during SSR/initial mount.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/prompt-input.tsx
git commit -m "feat: add SSR-safe skeleton fallback to PromptInput"
```

---
