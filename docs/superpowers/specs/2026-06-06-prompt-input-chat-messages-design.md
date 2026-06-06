# Prompt Input & Chat Message Components — Design Spec

**Date**: 2026-06-06
**Status**: Draft

## Overview

Two new UI component families using the Vercel composition pattern (compound components, context providers, no boolean prop proliferation):

1. **PromptInput** — TipTap-based rich text editor with toolbar, for composing transaction requests
2. **ChatMessages** — composable message components for rendering chat conversations with markdown support

Both are pure UI — no backend integration. Each ships with Storybook stories.

## Dependencies to Add

```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder react-markdown remark-gfm
```

- `@tiptap/react` — React bindings for TipTap
- `@tiptap/starter-kit` — bundle of common extensions (we'll exclude CodeBlock)
- `@tiptap/extension-placeholder` — placeholder text in empty editor
- `react-markdown` — markdown-to-React rendering
- `remark-gfm` — GitHub Flavored Markdown plugin (for tables)

## 1. PromptInput

### Architecture

Compound component with shared editor context:

```
PromptInput.Root        → creates editor, provides via React context
  PromptInput.Toolbar   → reads editor from context, renders formatting controls
  PromptInput.Editor    → reads editor from context, renders EditorContent
```

### Component Tree

```tsx
<PromptInput.Root
  defaultValue="<p>Hello</p>"
  onChange={(html) => console.log(html)}
  placeholder="What transactions do you want to create?"
>
  <PromptInput.Toolbar />
  <PromptInput.Editor />
</PromptInput.Root>
```

### API

#### `PromptInput.Root`

| Prop           | Type                     | Default | Description                            |
| -------------- | ------------------------ | ------- | -------------------------------------- |
| `defaultValue` | `string` (HTML)          | `""`    | Initial editor content                 |
| `value`        | `string` (HTML)          | —       | Controlled content (optional)          |
| `onChange`     | `(html: string) => void` | —       | Called on content change               |
| `placeholder`  | `string`                 | —       | Placeholder text shown in empty editor |
| `disabled`     | `boolean`                | `false` | Disables the editor                    |
| `className`    | `string`                 | —       | Additional classes on the root wrapper |

**Behavior**:

- Creates a TipTap editor via `useEditor()` with configured extensions
- Provides editor instance via React context (`PromptInputContext`)
- Editor configured with: `Document`, `Paragraph`, `Text`, `Bold`, `Italic`, `Strike`, `Heading` (levels 1-3), `BulletList`, `OrderedList`, `ListItem`, `Blockquote`, `HorizontalRule`, `History`, `Placeholder`
- Excluded: `CodeBlock` (per requirements)
- Accepts either `defaultValue` (uncontrolled) or `value` (controlled via `useEffect` syncing)
- Root element: `<div>` with `flex flex-col` layout

#### `PromptInput.Toolbar`

No props beyond `className`.

**Behavior**:

- Reads editor from `PromptInputContext`
- Renders a horizontal bar with formatting buttons
- Toolbar buttons: Bold (B), Italic (I), Strike (S), Heading 1 (H1), Heading 2 (H2), Heading 3 (H3), Bullet list, Ordered list, Blockquote, Horizontal rule
- Buttons use `editor.isActive()` for active state styling
- Toolbar hidden when `disabled` or no editor
- Separator between text formatting and block formatting groups

**Styling**:

- Wrapper: `border-hairline bg-raised flex flex-wrap items-center gap-0.5 border-b p-1`
- Buttons: base style `text-fg-muted hover:text-fg hover:bg-sunken size-7 inline-flex items-center justify-center text-xs transition-colors duration-fast ease-out`
- Active button: `text-accent bg-sunken`
- Separator: `bg-hairline mx-1 h-5 w-px`

#### `PromptInput.Editor`

| Prop        | Type     | Default | Description        |
| ----------- | -------- | ------- | ------------------ |
| `className` | `string` | —       | Additional classes |

**Behavior**:

- Renders TipTap's `<EditorContent editor={editor} />`
- Controlled by `PromptInputContext`

**Styling**:

- Wrapper: `bg-sunken border-hairline min-h-[120px] w-full border px-3 py-2`
- Focus (via TipTap's `focus` class): `focus-within:bg-base focus-within:border-fg-muted`
- Disabled: `disabled:opacity-40`
- Placeholder: `text-fg-faint` (via TipTap's `.ProseMirror p.is-editor-empty:first-child::before`)
- ProseMirror content styles: `prose-sm text-fg font-sans` with custom headings, lists, blockquote using design tokens

### States

| State                 | Visual                                                    |
| --------------------- | --------------------------------------------------------- |
| Default               | Toolbar visible, editor with placeholder                  |
| Focused               | Border changes to `border-fg-muted`, bg changes to `base` |
| Disabled              | Opacity reduced, no interaction                           |
| Toolbar active button | Accent color background                                   |
| Empty editor          | Placeholder text visible                                  |

### TipTap Extensions Configuration

```ts
// Extensions (excluding CodeBlock):
StarterKit.configure({
  codeBlock: false,
  heading: { levels: [1, 2, 3] },
});
// Plus:
Placeholder.configure({ placeholder });
```

## 2. ChatMessages

### Architecture

Flat compound components (no root context needed except for ToolCall which manages expand state):

```
ChatMessages.List            → scrollable container with auto-scroll
ChatMessages.UserMessage     → right-aligned user bubble
ChatMessages.AssistantMessage → left-aligned AI bubble with react-markdown
ChatMessages.ToolCall        → expandable card (provides ToolCallContext)
  ChatMessages.ToolCallName     → tool name (visible in collapsed header)
  ChatMessages.ToolCallArgs     → tool arguments JSON (visible when expanded)
  ChatMessages.ToolCallResponse → tool response JSON (visible when expanded)
ChatMessages.Attachment      → chip for file/image attachments
```

### Component Tree

```tsx
<ChatMessages.List>
  <ChatMessages.UserMessage>Create a recurring transaction for my rent</ChatMessages.UserMessage>
  <ChatMessages.AssistantMessage>
    Got it! Here's the breakdown of **your rent payment**...
  </ChatMessages.AssistantMessage>
  <ChatMessages.ToolCall>
    <ChatMessages.ToolCallName>create_recurring_transaction</ChatMessages.ToolCallName>
    <ChatMessages.ToolCallArgs>
      {JSON.stringify({ amount: 1500, category: "housing" }, null, 2)}
    </ChatMessages.ToolCallArgs>
    <ChatMessages.ToolCallResponse>
      {JSON.stringify({ id: "t_abc123", status: "created" }, null, 2)}
    </ChatMessages.ToolCallResponse>
  </ChatMessages.ToolCall>
  <ChatMessages.Attachment name="receipt.pdf" />
</ChatMessages.List>
```

### API

#### `ChatMessages.List`

| Prop        | Type        | Default | Description        |
| ----------- | ----------- | ------- | ------------------ |
| `children`  | `ReactNode` | —       | Message components |
| `className` | `string`    | —       | Additional classes |

**Behavior**:

- Wrapper: `<div>` with `overflow-y-auto`, flex column layout
- Auto-scrolls to bottom when children change (via `useEffect` + `scrollIntoView` on a sentinel element)
- Renders children as-is; no filtering or transformation

**Styling**: `flex flex-col gap-3 overflow-y-auto p-4`

#### `ChatMessages.UserMessage`

| Prop        | Type        | Default | Description                      |
| ----------- | ----------- | ------- | -------------------------------- |
| `children`  | `ReactNode` | —       | Message content (plain text)     |
| `className` | `string`    | —       | Additional classes on the bubble |

**Behavior**:

- Renders children in a right-aligned bubble
- Wrapped in a flex row that justifies-end

**Styling**:

- Row wrapper: `flex justify-end`
- Bubble: `bg-raised border-hairline text-fg max-w-[80%] border px-3 py-2 text-sm`

#### `ChatMessages.AssistantMessage`

| Prop        | Type     | Default | Description                             |
| ----------- | -------- | ------- | --------------------------------------- |
| `children`  | `string` | —       | Markdown string content                 |
| `className` | `string` | —       | Additional classes on the outer wrapper |

**Behavior**:

- Renders children as markdown via `react-markdown` with `remarkGfm` plugin
- Applies custom `components` map for all supported markdown elements
- Left-aligned bubble

**Markdown Component Mappings**:

| Markdown Element | Styled Component              | Classes                                                                           |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| `p`              | `<p>`                         | `text-fg text-sm leading-relaxed`                                                 |
| `h1`             | `<h1>`                        | `text-fg-strong font-serif text-lg font-medium`                                   |
| `h2`             | `<h2>`                        | `text-fg-strong font-serif text-base font-medium`                                 |
| `h3`             | `<h3>`                        | `text-fg-strong font-serif text-sm font-medium`                                   |
| `strong`         | `<strong>`                    | `text-fg-strong font-semibold`                                                    |
| `em`             | `<em>`                        | `italic`                                                                          |
| `del`            | `<del>`                       | `text-fg-muted line-through`                                                      |
| `ul`             | `<ul>`                        | `list-disc pl-5 text-fg text-sm space-y-1`                                        |
| `ol`             | `<ol>`                        | `list-decimal pl-5 text-fg text-sm space-y-1`                                     |
| `li`             | `<li>`                        | `text-fg text-sm`                                                                 |
| `blockquote`     | `<blockquote>`                | `border-hairline-strong text-fg-muted border-l-2 pl-3 text-sm italic`             |
| `a`              | `<a>`                         | `text-accent underline`                                                           |
| `hr`             | `<hr>`                        | `border-hairline my-3`                                                            |
| `table`          | `<table>`                     | `w-full border-collapse text-sm`                                                  |
| `thead`          | `<thead>`                     | `border-hairline border-b`                                                        |
| `th`             | `<th>`                        | `text-fg-strong border-hairline px-2 py-1 text-left text-xs font-medium border-b` |
| `td`             | `<td>`                        | `text-fg border-hairline px-2 py-1 text-sm border-b`                              |
| `tr`             | `<tr>`                        | no extra classes (inherits from table context)                                    |
| `img`            | NOT rendered (return `<></>`) |
| `code` (inline)  | NOT rendered (return `<></>`) |
| `pre`            | NOT rendered (return `<></>`) |

**Styling**:

- Row wrapper: `flex justify-start`
- Bubble: `max-w-[80%]`

#### `ChatMessages.ToolCall`

| Prop              | Type        | Default | Description                                  |
| ----------------- | ----------- | ------- | -------------------------------------------- |
| `children`        | `ReactNode` | —       | ToolCallName, ToolCallArgs, ToolCallResponse |
| `className`       | `string`    | —       | Additional classes                           |
| `defaultExpanded` | `boolean`   | `false` | Initial expand state                         |

**Behavior**:

- Expandable/collapsible card, starts collapsed (`defaultExpanded = false`)
- Provides `expanded` + `toggle` via React context (`ToolCallContext`)
- Uses `React.Children` to separate `ToolCallName` from other children:
  - `ToolCallName` is rendered in the header (always visible)
  - Remaining children (`ToolCallArgs`, `ToolCallResponse`) render in the expandable body
- Header (always visible): tool icon (wrench from lucide-react), "Tool call" label, slotted `ToolCallName`, chevron toggle
- Body: conditionally rendered when `expanded` is true; `ToolCallArgs` and `ToolCallResponse` also check context and return `null` when collapsed as a safety net
- Clicking header toggles expand/collapse

**State**: Uses internal `useState(false)` + `defaultExpanded` prop.

**Styling**:

- Card wrapper: `border-hairline bg-raised border`
- Header: `flex cursor-pointer items-center gap-2 px-3 py-2 select-none hover:bg-sunken transition-colors duration-fast`
- Tool icon: `text-fg-muted size-3.5`
- "Tool call" label: `text-fg-muted text-xs font-mono`
- Chevron: `text-fg-muted size-3.5 ml-auto transition-transform`, rotated 180deg when expanded
- Body: `border-hairline border-t px-3 py-2 space-y-2`

#### `ChatMessages.ToolCallName`

No props beyond `children: ReactNode` and `className`.

**Behavior**:

- Renders its children in the ToolCall header (always visible)
- Must be used inside ToolCall

**Styling**: `text-fg-strong font-mono text-xs font-medium`

#### `ChatMessages.ToolCallArgs`

No props beyond `children: ReactNode` and `className`.

**Behavior**:

- Renders only when ToolCall is expanded (reads `expanded` from context)
- Returns `null` when collapsed

**Styling**:

- Label: `text-fg-muted mb-1 block font-mono text-[10px]` — text "Arguments"
- Content: `bg-sunken text-fg font-mono overflow-x-auto whitespace-pre-wrap rounded-none p-2 text-xs`

#### `ChatMessages.ToolCallResponse`

No props beyond `children: ReactNode` and `className`.

**Behavior**:

- Renders only when ToolCall is expanded (reads `expanded` from context)
- Returns `null` when collapsed

**Styling**:

- Label: `text-fg-muted mb-1 block font-mono text-[10px]` — text "Response"
- Content: `bg-sunken text-fg font-mono overflow-x-auto whitespace-pre-wrap rounded-none p-2 text-xs`

#### `ChatMessages.Attachment`

| Prop        | Type        | Default  | Description                             |
| ----------- | ----------- | -------- | --------------------------------------- |
| `name`      | `string`    | required | File or image name                      |
| `children`  | `ReactNode` | —        | Optional icon slot (pass a lucide icon) |
| `className` | `string`    | —        | Additional classes                      |

**Behavior**:

- Renders a chip/tag showing the attachment name
- Optional leading icon via `children` slot

**Styling**:

- Chip: `bg-raised border-hairline text-fg inline-flex items-center gap-1.5 border px-2 py-1 text-xs`

### Markdown Rendering Implementation

`AssistantMessage` renders markdown with a system that maps every element to a design-system class. Each component in the `components` prop is either:

1. **A styled HTML element** with `className` applied
2. **An explicit empty fragment** for disallowed elements (img, code, pre)

### ToolCall Context

```ts
interface ToolCallContextValue {
  expanded: boolean;
  toggle: () => void;
}
```

`ToolCall` creates this context. `ToolCallArgs` and `ToolCallResponse` consume it to conditionally render. `ToolCallName` does not consume context — it renders unconditionally as part of the header.

## File Structure

```
src/components/ui/
  prompt-input.tsx           → PromptInput.Root, PromptInput.Toolbar, PromptInput.Editor
  prompt-input.stories.tsx
  chat-messages.tsx          → ChatMessages.* (all 8 exports)
  chat-messages.stories.tsx
```

Single-file-per-component-family following existing project conventions (e.g., `field.tsx` exports `Field`, `FieldLabel`, `FieldDescription`, `FieldError`).

## Styling Conventions (from existing codebase)

- `cn()` utility with `clsx` + `twMerge`
- Design tokens from `@theme` in `styles.css`
- No border radius (`rounded-none`)
- `transition-colors duration-fast ease-out` for hover states
- `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg-muted`
- `font-sans` for body, `font-mono` for numerals/code, `font-serif` for wordmark/headings
- Use `lucide-react` for icons (already a dependency)

## States & Edge Cases

### PromptInput

| State                  | Handling                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Empty/default          | Placeholder visible via TipTap Placeholder extension                                                        |
| Focused                | Border + background change on editor focus                                                                  |
| Disabled               | `opacity-40`, `pointer-events-none`, `cursor-not-allowed`                                                   |
| Toolbar without editor | Renders nothing (null)                                                                                      |
| Controlled value sync  | `useEffect` watches `value` prop, calls `editor.commands.setContent` only if different from current content |

### ChatMessages

| State                                          | Handling                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| List with single message                       | Normal rendering, no special handling                                         |
| List with many messages                        | Auto-scrolls to bottom                                                        |
| ToolCall collapsed                             | Only name visible in header                                                   |
| ToolCall expanded                              | Args + Response visible, chevron rotated                                      |
| ToolCallName outside ToolCall                  | Renders normally (no context needed)                                          |
| ToolCallArgs/ToolCallResponse outside ToolCall | Renders unconditionally (no context check possible — consumer responsibility) |
| Attachment without icon                        | Name only, no icon slot                                                       |
| Empty markdown string                          | Renders empty paragraph                                                       |
| Markdown with disallowed elements              | img/code/pre render as empty fragments                                        |

## Storybook Stories

### prompt-input.stories.tsx

- **Default** — Empty editor with toolbar
- **With Placeholder** — Editor with custom placeholder text
- **Controlled** — Editor with `value` + `onChange`, logs value changes
- **Disabled** — Editor in disabled state
- **Toolbar Actions** — Demonstrate bold, italic, lists, blockquote, heading changes

### chat-messages.stories.tsx

- **Conversation** — Full example with UserMessage → AssistantMessage (markdown with all supported elements) → ToolCall (expanded) → Attachment
- **UserMessage Only** — Single user message
- **AssistantMessage Markdown** — Assistant message with rich markdown: headings, bold/italic, lists (bulleted + ordered), blockquote, link, hr, strikethrough, table
- **ToolCall Collapsed** — ToolCall in default collapsed state
- **ToolCall Expanded** — ToolCall with `defaultExpanded={true}`
- **Attachment Chip** — Attachment with and without icon

## Testing Considerations

Future test files (`*.test.tsx`) can test:

- PromptInput renders without errors
- ChatMessages.List renders children
- ToolCall expand/collapse toggle
- AssistantMessage markdown rendering output
- UserMessage/AssistantMessage children passthrough
