# Login Page Auth Integration Design

**Date:** 2026-06-04
**Status:** Approved

## Overview

Integrate the existing `/login` route with the `better-auth` client to enable Google OAuth sign-in. The login page currently renders a static "Login with Google" button. This design wires that button to the auth client, handles the OAuth redirect flow, and displays toast notifications on errors.

## Goals

- Enable Google OAuth login from `/login`.
- Redirect the user to `/` after successful authentication.
- Show toast notifications for any login errors.

## Architecture & Data Flow

1. **User clicks "Login with Google"** on `/login`.
2. The click handler calls `authClient.signIn.social({ provider: "google", callbackURL: "/" })`.
3. **`better-auth` initiates the OAuth flow**: redirects the browser to Google's consent screen.
4. **After Google redirects back**, `better-auth` processes the callback and redirects the user to `/` (as specified by `callbackURL`).
5. **Error path**: If the `signIn.social` promise rejects (e.g., network error, misconfiguration), the handler catches the error and triggers a toast via the existing `useToast` hook.

## Components

### `src/routes/login.tsx`

- Add `onClick` handler to the Google login button.
- Import `authClient` from `@/lib/auth/client`.
- Import `useToast` from `@/components/ui/toast`.
- Wrap `authClient.signIn.social` in `try/catch`.
- On error, show a toast with variant `error`.

### `src/routes/__root.tsx`

- Wrap `children` with `<ToastProvider>` so toast notifications are available application-wide.
- Render `<Toast />` as a child of `<ToastProvider>` so the toast viewport is active globally.

## Error Handling

- **Synchronous errors**: `try/catch` around the async call.
- **Promise rejection**: `.catch()` or `catch` block on the awaited `signIn.social` call.
- **Toast on error**: `toastManager.add({ title: "Login failed", data: { variant: "error" } })`.
- No other fallback UI (e.g., inline alert) is required; the toast is the primary error surface.

## Out of Scope

- Multiple authentication providers (only Google).
- Post-login onboarding or conditional redirects.
- Logout functionality.
- Session state display on the login page.
