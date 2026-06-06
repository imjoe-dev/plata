# Not Found (404) Page

## Summary

Add a `notFoundComponent` to the root route (`__root.tsx`) so unmatched routes render a minimal 404 page instead of TanStack Router's default bare `<p>Not Found</p>`.

## Design

**File changed:** `src/routes/__root.tsx`

**Approach:** Add `notFoundComponent` key to the existing `createRootRouteWithContext()` call. This is TanStack Router's idiomatic way to handle 404s in file-based routing. The component renders inside the `RootDocument` shell, so it inherits the `<html>`, `<head>`, `<body>`, `ToastProvider`, and devtools.

**Component:**

- Displays "404 — Page Not Found" heading
- Includes a `<Link to="/">` back to home
- Uses existing `@tanstack/react-router` `Link` import

**Routes not matching:**

- `/login` (public)
- `/` (protected, requires session)
- Any unknown path will render the 404

## Testing

Manual verification: navigate to a non-existent route and confirm the 404 page renders.
