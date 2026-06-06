# Login Page Auth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the `/login` page to `better-auth` for Google OAuth sign-in, redirect to `/` on success, and show toast notifications on errors.

**Architecture:** Approach A (Simple Inline Handler + Global ToastProvider). The login button calls `authClient.signIn.social` directly; `callbackURL` handles the success redirect; `try/catch` handles errors and triggers a toast via the existing `useToast` hook. The `ToastProvider` and `Toast` viewport are added globally in `__root.tsx`.

**Tech Stack:** React 19, TanStack Router/Start, better-auth, @base-ui/react/toast, Vitest, @testing-library/react

---

## File Structure

| File                        | Action | Responsibility                                                        |
| --------------------------- | ------ | --------------------------------------------------------------------- |
| `src/routes/__root.tsx`     | Modify | Wrap app with `<ToastProvider>` and render `<Toast />` globally       |
| `src/routes/login.tsx`      | Modify | Add Google sign-in handler, error toast, export component for testing |
| `src/routes/login.test.tsx` | Create | Tests for sign-in trigger and error toast display                     |

---

### Task 1: Global ToastProvider and Toast Viewport

**Files:**

- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Import ToastProvider and Toast**

Add these imports at the top of `src/routes/__root.tsx`:

```tsx
import { ToastProvider, Toast } from "@/components/ui/toast";
```

- [ ] **Step 2: Wrap children with ToastProvider and add Toast**

Inside the `RootDocument` component, wrap `{children}` with `<ToastProvider>` and render `<Toast />` inside it:

```tsx
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ToastProvider>
          {children}
          <Toast />
        </ToastProvider>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            { name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify app compiles**

Run: `vp check`
Expected: No TypeScript or lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: add global ToastProvider and Toast viewport"
```

---

### Task 2: Wire Login Button to Auth Client

**Files:**

- Modify: `src/routes/login.tsx`

- [ ] **Step 1: Update imports and add handler**

Replace the contents of `src/routes/login.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Google } from "@/components/icons/google";
import { authClient } from "@/lib/auth/client";
import { useToast } from "@/components/ui/toast";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

export function LoginPage() {
  const toast = useToast();

  const handleSignIn = async () => {
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error) {
      toast.add({
        title: "Login failed",
        data: { variant: "error" },
      });
    }
  };

  return (
    <div className="bg-base flex min-h-screen items-center justify-center">
      <Button className="min-w-md" variant="primary" size="lg" onClick={handleSignIn}>
        <Google className="h-4 w-4" strokeWidth={1.5} />
        Login with Google
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `vp check`
Expected: No TypeScript or lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/login.tsx
git commit -m "feat: integrate login page with better-auth google sign-in"
```

---

### Task 3: Test Login Component

**Files:**

- Create: `src/routes/login.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/routes/login.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginPage } from "./login";

const mockSignInSocial = vi.fn();
const mockToastAdd = vi.fn();

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: {
      social: (...args: unknown[]) => mockSignInSocial(...args),
    },
  },
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ add: mockToastAdd }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls signIn.social with google provider and callbackURL on button click", async () => {
    mockSignInSocial.mockResolvedValueOnce({});
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /login with google/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSignInSocial).toHaveBeenCalledTimes(1);
      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/",
      });
    });
  });

  it("shows an error toast when signIn.social rejects", async () => {
    mockSignInSocial.mockRejectedValueOnce(new Error("Network error"));
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /login with google/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockToastAdd).toHaveBeenCalledTimes(1);
      expect(mockToastAdd).toHaveBeenCalledWith({
        title: "Login failed",
        data: { variant: "error" },
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vp test run src/routes/login.test.tsx`
Expected: FAIL — `LoginPage` is not exported from `login.tsx` yet (if not done in Task 2), or the tests fail because the handler hasn't been implemented yet.

- [ ] **Step 3: Run tests to verify they pass**

After Task 2 is complete, run:
Run: `vp test run src/routes/login.test.tsx`
Expected: PASS — both tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/login.test.tsx
git commit -m "test: add login component tests for sign-in and error toast"
```

---

## Self-Review

**1. Spec coverage:**

- ✅ Enable Google OAuth login from `/login` — Task 2
- ✅ Redirect user to `/` after successful auth — Task 2 via `callbackURL: "/"`
- ✅ Show toast notifications on errors — Task 2 via `try/catch` + `toast.add`
- ✅ Global toast setup — Task 1 via `ToastProvider` and `Toast` in `__root.tsx`

**2. Placeholder scan:**

- No TBD/TODO/fill-in-details found.
- All code snippets are complete and runnable.
- All file paths are exact.

**3. Type consistency:**

- `authClient.signIn.social` args match the better-auth API (`provider`, `callbackURL`).
- `toast.add` signature matches the existing `useToast` hook from `@base-ui/react/toast`.
- Component name `LoginPage` is exported consistently in `login.tsx` and imported in the test.

**No gaps found. Plan is ready for execution.**
