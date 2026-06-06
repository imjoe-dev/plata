# Not Found (404) Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `notFoundComponent` to the root route so unmatched paths render a minimal 404 page instead of the bare default `<p>Not Found</p>`.

**Architecture:** Single-file change to `src/routes/__root.tsx`. Add `Link` to the existing import and add `notFoundComponent` to the `createRootRouteWithContext()` options. The component renders inside `RootDocument`, inheriting the full HTML shell, ToastProvider, and devtools.

**Tech Stack:** React 19, TanStack Router (file-based routing), TanStack Start

---

### Task 1: Add `notFoundComponent` to root route

**Files:**

- Modify: `src/routes/__root.tsx:1` (import)
- Modify: `src/routes/__root.tsx:38-39` (route options)

- [ ] **Step 1: Add `Link` to the import**

`src/routes/__root.tsx` line 1, change:

```tsx
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
```

to:

```tsx
import { HeadContent, Link, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
```

- [ ] **Step 2: Add `notFoundComponent` to route options**

`src/routes/__root.tsx`, after `shellComponent: RootDocument,` (line 38), add:

```tsx
  notFoundComponent: NotFound,
```

So the route definition becomes:

```tsx
export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});
```

- [ ] **Step 3: Add the `NotFound` component above the `RootDocument` function**

`src/routes/__root.tsx`, add before `function RootDocument` (line 41):

```tsx
function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>404 — Page Not Found</h1>
      <Link to="/">Go back home</Link>
    </div>
  );
}
```

- [ ] **Step 4: Verify the build compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 5: Verify the dev server works**

```bash
npm run dev
```

Navigate to a non-existent route (e.g., `/nonexistent`) and confirm the 404 page renders with the heading "404 — Page Not Found" and a "Go back home" link.

- [ ] **Step 6: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: add 404 not-found page"
```
