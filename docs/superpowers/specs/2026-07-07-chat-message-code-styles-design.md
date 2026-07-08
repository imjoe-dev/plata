# Chat message `code` and `pre` styles — Design

**Date:** 2026-07-07
**Status:** Approved

## Problem

The markdown renderers in `src/components/ui/chat-messages.tsx` currently stub `code` and `pre` to `() => null` for both AI and user messages. Any inline code (backticks) or fenced code blocks the model emits render as nothing — the content is invisible. As the AI assistant starts producing SQL snippets, JSON payloads, shell commands, and general code examples, this becomes a real gap.

## Goal

Replace the four `() => null` placeholders with styled `code` and `pre` renderers for both `markdownComponents` (AI messages) and `userMarkdownComponents` (user messages), following the existing design-system conventions.

## Context

Plata's chat surfaces two message types with distinct visual contexts:

- **AI messages** render in a `bg-raised border-hairline border p-3.5` bubble on a dark canvas. Existing block elements (blockquote, hr, tables) use semantic dark tokens: `bg-sunken`, `text-fg`, `text-fg-muted`, `border-hairline`.
- **User messages** render in a `bg-accent text-accent-fg p-3.5` bubble (light green-yellow background, dark green text). Existing block elements use currentColor opacity overlays rather than semantic tokens — e.g. blockquote uses `border-current/30`, `del` uses `opacity-60`, `hr` uses `border-current/30`.

The file already contains a precedent for styled `<pre>` in `ToolCallArgs` and `ToolCallResponse`:

```tsx
<pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
```

This spec mirrors that pattern for AI code blocks and adapts it with currentColor opacity for user code blocks, so each message type stays visually cohesive.

## Decisions

- **No language labels** on code blocks. Keeps the rendering minimal and matches the existing `ToolCallArgs`/`ToolCallResponse` aesthetic.
- **No copy-to-clipboard button.** Scope is styling only; interactivity can be added later if needed.
- **Inline code gets a subtle background pill**, distinct from fenced code blocks. Inline uses tight horizontal/vertical padding (`px-1.5 py-0.5`); blocks use uniform `p-2`.
- **Context-aware styling per message type.** AI code uses semantic `bg-sunken`/`text-fg` tokens (matching `ToolCallArgs`). User code uses `bg-current/[0.07]` (currentColor at 7% opacity), matching the existing blockquote/`del` opacity-overlay pattern for the accent bubble.
- **Inline-vs-block detection via `className`.** react-markdown calls the `code` renderer for both inline code and the inner `<code>` of a fenced block. Fenced blocks receive a `language-*` class; inline code receives none. The renderer checks `className` to skip the inline pill styles when inside a `pre`, avoiding double padding on top of the `pre`'s `p-2`.
- **No syntax highlighting.** Out of scope — would require a rehype plugin (`rehype-highlight` or similar) and a theme. The `language-*` class is preserved on block `<code>` so a future syntax-highlighting pass can pick it up without rework.

## Design

### AI messages (`markdownComponents`)

```tsx
code: ({ className, children, ...props }) => {
  if (className) {
    return (
      <code className={cn("font-mono text-xs whitespace-pre-wrap", className)} {...props}>
        {children}
      </code>
    );
  }
  return (
    <code className="bg-sunken text-fg px-1.5 py-0.5 font-mono text-xs" {...props}>
      {children}
    </code>
  );
},
pre: ({ children, ...props }) => (
  <pre
    className="bg-sunken text-fg my-2 overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap"
    {...props}
  >
    {children}
  </pre>
),
```

The block `pre` matches `ToolCallArgs`/`ToolCallResponse` exactly, plus `my-2` for vertical spacing inside the message bubble. The inline `code` uses the same `bg-sunken`/`text-fg` tokens with `px-1.5 py-0.5` pill padding.

### User messages (`userMarkdownComponents`)

```tsx
code: ({ className, children, ...props }) => {
  if (className) {
    return (
      <code className={cn("font-mono text-xs whitespace-pre-wrap", className)} {...props}>
        {children}
      </code>
    );
  }
  return (
    <code className="bg-current/[0.07] px-1.5 py-0.5 font-mono text-xs" {...props}>
      {children}
    </code>
  );
},
pre: ({ children, ...props }) => (
  <pre
    className="bg-current/[0.07] my-2 overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap"
    {...props}
  >
    {children}
  </pre>
),
```

`bg-current/[0.07]` overlays the current text color (`text-accent-fg`, a dark green) at 7% opacity onto the `bg-accent` bubble — a subtle dimmed region that reads clearly as a code surface without punching a dark hole through the accent fill. This mirrors the `border-current/30` and `opacity-*` patterns already used by the user blockquote, `del`, and `hr`.

## Scope & impact

- **One file changed:** `src/components/ui/chat-messages.tsx`. Replace the four `() => null` lines (current lines 42-43, 79-80).
- **No new imports.** `cn` (from `@/lib/utils`) and the `Components` type (from `react-markdown`) are already imported.
- **No dependency changes.** No syntax-highlighting library added.

## Edge cases

- **Bare backtick fences** (no language): `className` is undefined, so the inner `code` renders with inline pill styles. The wrapping `<pre>` still provides the block-level container and background, so the result is a styled block — acceptable, since language-less fences are semantically ambiguous anyway.
- **Empty code blocks:** render as a short empty rectangle with the block background. Harmless.
- **Markdown inside code:** react-markdown does not parse markdown inside `code` by default. No special handling needed.
- **Long single lines:** `overflow-x-auto` provides horizontal scroll; `whitespace-pre-wrap` wraps only when the author's line breaks would otherwise be lost (preserves intentional formatting while preventing layout blowout).

## Testing

- Pure styling change — no behavioral logic to test in isolation.
- `vp check` (lint + typecheck + format) covers correctness; `vp test` runs the existing suite to confirm no regressions in components that consume `ChatMessages`.
