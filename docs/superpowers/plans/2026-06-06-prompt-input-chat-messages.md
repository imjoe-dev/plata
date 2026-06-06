# PromptInput & ChatMessages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two compound-component families — TipTap-based rich text editor and composable chat message renderers — with Storybook stories. No backend integration.

**Architecture:** PromptInput uses React context to share a TipTap editor instance across `Root`, `Toolbar`, and `Editor` sub-components. ChatMessages are flat compound components with no shared root context except `ToolCall` which manages expand/collapse state; `UserMessage` and `AssistantMessage` both embed `react-markdown` with a shared styling map. All styling uses existing design tokens (`cn()`, `font-sans`, `font-mono`, `font-serif`, dark theme colors, zero border radius).

**Tech Stack:** React 19, TipTap (react, starter-kit, placeholder), react-markdown + remark-gfm, Tailwind CSS v4, `cn()` from `@/lib/utils`, lucide-react icons, Storybook 10 (`@storybook/react-vite`).

---

## File Structure

```
src/components/ui/
  prompt-input.tsx              # Create — PromptInput.Root, .Toolbar, .Editor
  prompt-input.stories.tsx      # Create — Storybook stories
  chat-messages.tsx             # Create — ChatMessages.* (8 exports)
  chat-messages.stories.tsx     # Create — Storybook stories
```

Single-file-per-family following existing conventions (see `field.tsx` which exports `Field`, `FieldLabel`, `FieldDescription`, `FieldError`).

---

### Task 1: Install dependencies

**Files:**

- Modify: `package.json` (implicit via `vp install`)

- [ ] **Step 1: Install all new dependencies**

```bash
vp install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder react-markdown remark-gfm
```

Verify: Run `vp check` to confirm no type errors from new packages.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add tiptap, react-markdown, remark-gfm"
```

---

### Task 2: Create PromptInput component

**Files:**

- Create: `src/components/ui/prompt-input.tsx`

- [ ] **Step 1: Write the full PromptInput component file**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
} from "lucide-react";

// ── Context ──────────────────────────────────────────────────────────────────

interface PromptInputContextValue {
  editor: Editor | null;
}

const PromptInputContext = createContext<PromptInputContextValue>({
  editor: null,
});

function usePromptInput() {
  return useContext(PromptInputContext);
}

// ── Root ─────────────────────────────────────────────────────────────────────

interface PromptInputRootProps {
  defaultValue?: string;
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

function Root({
  defaultValue = "",
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  children,
}: PromptInputRootProps) {
  const [isControlled] = useState(() => value !== undefined);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
      }),
    ],
    content: isControlled ? value : defaultValue,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[120px] w-full px-3 py-2 outline-none",
          "text-fg font-sans text-sm leading-relaxed",
          "[&_h1]:text-fg-strong [&_h1]:font-serif [&_h1]:text-lg [&_h1]:font-medium [&_h1]:mt-3 [&_h1]:mb-1",
          "[&_h2]:text-fg-strong [&_h2]:font-serif [&_h2]:text-base [&_h2]:font-medium [&_h2]:mt-2 [&_h2]:mb-1",
          "[&_h3]:text-fg-strong [&_h3]:font-serif [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-0.5",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5",
          "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5",
          "[&_blockquote]:border-hairline-strong [&_blockquote]:text-fg-muted [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2",
          "[&_hr]:border-hairline [&_hr]:my-3",
          "[&_strong]:text-fg-strong [&_strong]:font-semibold",
          "[&_em]:italic",
          "[&_s]:text-fg-muted [&_s]:line-through",
          "[&_p.is-editor-empty:first-child::before]:text-fg-faint [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        ),
      },
    },
  });

  useEffect(() => {
    if (isControlled && editor && value !== undefined) {
      const current = editor.getHTML();
      if (current !== value) {
        editor.commands.setContent(value, false);
      }
    }
  }, [editor, value, isControlled]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  return (
    <PromptInputContext.Provider value={{ editor }}>
      <div className={cn("flex flex-col", disabled && "pointer-events-none opacity-40", className)}>
        {children}
      </div>
    </PromptInputContext.Provider>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

interface PromptInputToolbarProps {
  className?: string;
}

function Toolbar({ className }: PromptInputToolbarProps) {
  const { editor } = usePromptInput();

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    cn(
      "size-7 inline-flex items-center justify-center text-xs transition-colors duration-fast ease-out",
      active ? "text-accent bg-sunken" : "text-fg-muted hover:text-fg hover:bg-sunken",
    );

  return (
    <div
      className={cn(
        "border-hairline bg-raised flex flex-wrap items-center gap-0.5 border-b p-1",
        className,
      )}
    >
      <button
        type="button"
        className={btnClass(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
      >
        <Bold className="size-3" />
      </button>
      <button
        type="button"
        className={btnClass(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
      >
        <Italic className="size-3" />
      </button>
      <button
        type="button"
        className={btnClass(editor.isActive("strike"))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Strikethrough"
      >
        <Strikethrough className="size-3" />
      </button>

      <div className="bg-hairline mx-1 h-5 w-px" />

      <button
        type="button"
        className={btnClass(editor.isActive("heading", { level: 1 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
      >
        <Heading1 className="size-3" />
      </button>
      <button
        type="button"
        className={btnClass(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
      >
        <Heading2 className="size-3" />
      </button>
      <button
        type="button"
        className={btnClass(editor.isActive("heading", { level: 3 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
      >
        <Heading3 className="size-3" />
      </button>

      <div className="bg-hairline mx-1 h-5 w-px" />

      <button
        type="button"
        className={btnClass(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
      >
        <List className="size-3" />
      </button>
      <button
        type="button"
        className={btnClass(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Ordered list"
      >
        <ListOrdered className="size-3" />
      </button>

      <div className="bg-hairline mx-1 h-5 w-px" />

      <button
        type="button"
        className={btnClass(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        aria-label="Blockquote"
      >
        <Quote className="size-3" />
      </button>
      <button
        type="button"
        className={btnClass(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        aria-label="Horizontal rule"
      >
        <Minus className="size-3" />
      </button>
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

interface PromptInputEditorProps {
  className?: string;
}

function EditorSlot({ className }: PromptInputEditorProps) {
  const { editor } = usePromptInput();

  if (!editor) return null;

  return (
    <div
      className={cn(
        "bg-sunken border-hairline w-full border",
        "focus-within:bg-base focus-within:border-fg-muted",
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

// ── Namespace export ─────────────────────────────────────────────────────────

export const PromptInput = {
  Root,
  Toolbar,
  Editor: EditorSlot,
};
```

- [ ] **Step 2: Run type check**

```bash
vp check
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/prompt-input.tsx
git commit -m "feat: add PromptInput compound component (Root, Toolbar, Editor)"
```

---

### Task 3: Create PromptInput stories

**Files:**

- Create: `src/components/ui/prompt-input.stories.tsx`

- [ ] **Step 1: Write the stories file**

```tsx
import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PromptInput } from "./prompt-input";

const meta = {
  component: PromptInput.Root,
  subcomponents: {
    Toolbar: PromptInput.Toolbar,
    Editor: PromptInput.Editor,
  },
} satisfies Meta<typeof PromptInput.Root>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <PromptInput.Root>
      <PromptInput.Toolbar />
      <PromptInput.Editor />
    </PromptInput.Root>
  ),
};

export const WithPlaceholder: Story = {
  render: () => (
    <PromptInput.Root placeholder="What transactions do you want to create?">
      <PromptInput.Toolbar />
      <PromptInput.Editor />
    </PromptInput.Root>
  ),
};

export const WithDefaultValue: Story = {
  render: () => (
    <PromptInput.Root defaultValue="<p>Create a <strong>recurring transaction</strong> for my rent</p><ul><li><p>$1,500 monthly</p></li><li><p>Category: housing</p></li></ul>">
      <PromptInput.Toolbar />
      <PromptInput.Editor />
    </PromptInput.Root>
  ),
};

export const Disabled: Story = {
  render: () => (
    <PromptInput.Root disabled defaultValue="<p>You cannot edit this</p>">
      <PromptInput.Toolbar />
      <PromptInput.Editor />
    </PromptInput.Root>
  ),
};

export const Controlled: Story = {
  render: function ControlledStory() {
    const [value, setValue] = useState("<p>Edit me...</p>");
    return (
      <div className="space-y-4">
        <PromptInput.Root value={value} onChange={setValue}>
          <PromptInput.Toolbar />
          <PromptInput.Editor />
        </PromptInput.Root>
        <pre className="bg-sunken text-fg-muted font-mono overflow-x-auto p-3 text-xs">{value}</pre>
      </div>
    );
  },
};
```

- [ ] **Step 2: Run type check and Storybook build**

```bash
vp check
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/prompt-input.stories.tsx
git commit -m "docs: add PromptInput Storybook stories"
```

---

### Task 4: Create ChatMessages component (Part 1 — List, UserMessage, AssistantMessage, Attachment)

**Files:**

- Create: `src/components/ui/chat-messages.tsx`

- [ ] **Step 1: Write List + markdown helpers + message bubble components + Attachment**

```tsx
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// ── Shared markdown component mappings ──────────────────────────────────────

const markdownComponents: Components = {
  p: ({ children, ...props }) => (
    <p className="text-fg text-sm leading-relaxed" {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="text-fg-strong font-serif text-lg font-medium mt-3 mb-1" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-fg-strong font-serif text-base font-medium mt-2 mb-1" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-fg-strong font-serif text-sm font-medium mt-2 mb-0.5" {...props}>
      {children}
    </h3>
  ),
  strong: ({ children, ...props }) => (
    <strong className="text-fg-strong font-semibold" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  del: ({ children, ...props }) => (
    <del className="text-fg-muted line-through" {...props}>
      {children}
    </del>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc pl-5 text-fg text-sm space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal pl-5 text-fg text-sm space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-fg text-sm" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-hairline-strong text-fg-muted border-l-2 pl-3 text-sm italic my-2"
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, href, ...props }) => (
    <a className="text-accent underline" href={href} {...props}>
      {children}
    </a>
  ),
  hr: (props) => <hr className="border-hairline my-3" {...props} />,
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="border-hairline border-b" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="text-fg-strong border-hairline px-2 py-1 text-left text-xs font-medium border-b"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="text-fg border-hairline px-2 py-1 text-sm border-b" {...props}>
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  // Disallowed elements
  img: () => null as unknown as ReactNode,
  code: () => null as unknown as ReactNode,
  pre: () => null as unknown as ReactNode,
};

// ── List ─────────────────────────────────────────────────────────────────────

interface ChatMessagesListProps {
  children: ReactNode;
  className?: string;
}

function List({ children, className }: ChatMessagesListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [children]);

  return (
    <div ref={containerRef} className={cn("flex flex-col gap-3 overflow-y-auto p-4", className)}>
      {children}
      <div ref={sentinelRef} />
    </div>
  );
}

// ── UserMessage ──────────────────────────────────────────────────────────────

interface ChatMessagesUserMessageProps {
  children: string;
  className?: string;
}

function UserMessage({ children, className }: ChatMessagesUserMessageProps) {
  return (
    <div className={cn("flex justify-end", className)}>
      <div className="max-w-[80%]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {children}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ── AssistantMessage ─────────────────────────────────────────────────────────

interface ChatMessagesAssistantMessageProps {
  children: string;
  className?: string;
}

function AssistantMessage({ children, className }: ChatMessagesAssistantMessageProps) {
  return (
    <div className={cn("flex justify-start", className)}>
      <div className="max-w-[80%]">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {children}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ── Attachment ───────────────────────────────────────────────────────────────

interface ChatMessagesAttachmentProps {
  name: string;
  children?: ReactNode;
  className?: string;
}

function Attachment({ name, children, className }: ChatMessagesAttachmentProps) {
  return (
    <div
      className={cn(
        "bg-raised border-hairline text-fg inline-flex items-center gap-1.5 border px-2 py-1 text-xs",
        className,
      )}
    >
      {children}
      <span className="text-fg-muted truncate max-w-[200px]">{name}</span>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
vp check
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/chat-messages.tsx
git commit -m "feat: add ChatMessages List, UserMessage, AssistantMessage, Attachment"
```

---

### Task 5: Create ChatMessages component (Part 2 — ToolCall compound)

**Files:**

- Modify: `src/components/ui/chat-messages.tsx` — append ToolCall components

- [ ] **Step 1: Append ToolCall context + components to chat-messages.tsx**

After the `Attachment` function and before the namespace export (which doesn't exist yet), add these imports and code.

First, update the imports at the top of `src/components/ui/chat-messages.tsx`. The file currently imports:

```tsx
import { useEffect, useRef, type ReactNode } from "react";
```

Change to:

```tsx
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
```

Add the lucide icon import after the existing imports:

```tsx
import { Wrench, ChevronDown } from "lucide-react";
```

Then append the following code at the end of the file (after the `Attachment` function):

````tsx
// ── ToolCall Context ─────────────────────────────────────────────────────────

interface ToolCallContextValue {
  expanded: boolean;
  toggle: () => void;
}

const ToolCallContext = createContext<ToolCallContextValue>({
  expanded: false,
  toggle: () => {},
});

function useToolCall() {
  return useContext(ToolCallContext);
}

// ── ToolCall ─────────────────────────────────────────────────────────────────

interface ChatMessagesToolCallProps {
  children: ReactNode;
  className?: string;
  defaultExpanded?: boolean;
}

function ToolCall({
  children,
  className,
  defaultExpanded = false,
}: ChatMessagesToolCallProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = () => setExpanded((prev) => !prev);

  // Separate ToolCallName from other children
  const childrenArray = Children.toArray(children);
  const nameChild = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      child.type === ToolCallName,
  );
  const restChildren = childrenArray.filter(
    (child) => child !== nameChild,
  );

  return (
    <ToolCallContext.Provider value={{ expanded, toggle }}>
      <div
        className={cn("border-hairline bg-raised border", className)}
      >
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 px-3 py-2 select-none",
            "hover:bg-sunken transition-colors duration-fast",
          )}
        >
          <Wrench className="text-fg-muted size-3.5" />
          <span className="text-fg-muted text-xs font-mono">
            Tool call
          </span>
          {nameChild}
          <ChevronDown
            className={cn(
              "text-fg-muted size-3.5 ml-auto transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        {expanded && (
          <div className="border-hairline border-t px-3 py-2 space-y-2">
            {restChildren}
          </div>
        )}
      </div>
    </ToolCallContext.Provider>
  );
}

// ── ToolCallName ─────────────────────────────────────────────────────────────

ToolCallName.displayName = "ChatMessages.ToolCallName";

interface ChatMessagesToolCallNameProps {
  children: ReactNode;
  className?: string;
}

function ToolCallName({
  children,
  className,
}: ChatMessagesToolCallNameProps) {
  return (
    <span
      className={cn(
        "text-fg-strong font-mono text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── ToolCallArgs ─────────────────────────────────────────────────────────────

interface ChatMessagesToolCallArgsProps {
  children: ReactNode;
  className?: string;
}

function ToolCallArgs({
  children,
  className,
}: ChatMessagesToolCallArgsProps) {
  const { expanded } = useToolCall();
  if (!expanded) return null;

  return (
    <div className={className}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">
        Arguments
      </span>
      <pre className="bg-sunken text-fg font-mono overflow-x-auto whitespace-pre-wrap p-2 text-xs">
        {children}
      </pre>
    </div>
  );
}

// ── ToolCallResponse ─────────────────────────────────────────────────────────

interface ChatMessagesToolCallResponseProps {
  children: ReactNode;
  className?: string;
}

function ToolCallResponse({
  children,
  className,
}: ChatMessagesToolCallResponseProps) {
  const { expanded } = useToolCall();
  if (!expanded) return null;

  return (
    <div className={className}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">
        Response
      </span>
      <pre className="bg-sunken text-fg font-mono overflow-x-auto whitespace-pre-wrap p-2 text-xs">
        {children}
      </pre>
    </div>
  );
}

// ── Namespace export ─────────────────────────────────────────────────────────

export const ChatMessages = {
  List,
  UserMessage,
  AssistantMessage,
  ToolCall,
  ToolCallName,
  ToolCallArgs,
  ToolCallResponse,
  Attachment,
};

- [ ] **Step 2: Run type check**

```bash
vp check
````

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/chat-messages.tsx
git commit -m "feat: add ChatMessages ToolCall compound component"
```

---

### Task 6: Create ChatMessages stories

**Files:**

- Create: `src/components/ui/chat-messages.stories.tsx`

- [ ] **Step 1: Write the stories file**

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Paperclip } from "lucide-react";
import { ChatMessages } from "./chat-messages";

const meta = {
  component: ChatMessages.List,
} satisfies Meta<typeof ChatMessages.List>;
export default meta;

type Story = StoryObj<typeof meta>;

const markdownExample = `Got it! Here's the breakdown of **your rent payment**:

### Summary

- **Amount:** $1,500
- **Category:** Housing
- **Frequency:** Monthly

> Rent is due on the 1st of every month. Late fees apply after the 5th.

| Month | Amount | Status |
|-------|--------|--------|
| Jan   | $1,500 | Paid   |
| Feb   | $1,500 | Paid   |
| Mar   | $1,500 | Pending |

[View details](https://example.com) for more information.`;

export const Conversation: Story = {
  render: () => (
    <ChatMessages.List>
      <ChatMessages.UserMessage>
        Create a recurring transaction for my rent
      </ChatMessages.UserMessage>
      <ChatMessages.AssistantMessage>{markdownExample}</ChatMessages.AssistantMessage>
      <ChatMessages.ToolCall defaultExpanded>
        <ChatMessages.ToolCallName>create_recurring_transaction</ChatMessages.ToolCallName>
        <ChatMessages.ToolCallArgs>
          {JSON.stringify({ amount: 1500, category: "housing", frequency: "monthly" }, null, 2)}
        </ChatMessages.ToolCallArgs>
        <ChatMessages.ToolCallResponse>
          {JSON.stringify({ id: "t_abc123", status: "created", nextDate: "2026-07-01" }, null, 2)}
        </ChatMessages.ToolCallResponse>
      </ChatMessages.ToolCall>
      <ChatMessages.Attachment name="receipt.pdf">
        <Paperclip className="text-fg-muted size-3" />
      </ChatMessages.Attachment>
    </ChatMessages.List>
  ),
};

export const UserMessageOnly: Story = {
  render: () => (
    <ChatMessages.List>
      <ChatMessages.UserMessage>
        Show me all **housing expenses** from last month
      </ChatMessages.UserMessage>
    </ChatMessages.List>
  ),
};

export const AssistantMessageMarkdown: Story = {
  render: () => (
    <ChatMessages.List>
      <ChatMessages.AssistantMessage>{markdownExample}</ChatMessages.AssistantMessage>
    </ChatMessages.List>
  ),
};

export const ToolCallCollapsed: Story = {
  render: () => (
    <ChatMessages.List>
      <ChatMessages.ToolCall>
        <ChatMessages.ToolCallName>fetch_transactions</ChatMessages.ToolCallName>
        <ChatMessages.ToolCallArgs>
          {JSON.stringify({ category: "housing", period: "last_month" }, null, 2)}
        </ChatMessages.ToolCallArgs>
        <ChatMessages.ToolCallResponse>
          {JSON.stringify(
            { count: 3, transactions: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] },
            null,
            2,
          )}
        </ChatMessages.ToolCallResponse>
      </ChatMessages.ToolCall>
    </ChatMessages.List>
  ),
};

export const ToolCallExpanded: Story = {
  render: () => (
    <ChatMessages.List>
      <ChatMessages.ToolCall defaultExpanded>
        <ChatMessages.ToolCallName>create_recurring_transaction</ChatMessages.ToolCallName>
        <ChatMessages.ToolCallArgs>
          {JSON.stringify({ amount: 1500, category: "housing", frequency: "monthly" }, null, 2)}
        </ChatMessages.ToolCallArgs>
        <ChatMessages.ToolCallResponse>
          {JSON.stringify({ id: "t_abc123", status: "created" }, null, 2)}
        </ChatMessages.ToolCallResponse>
      </ChatMessages.ToolCall>
    </ChatMessages.List>
  ),
};

export const AttachmentChip: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <ChatMessages.Attachment name="receipt.pdf">
        <Paperclip className="text-fg-muted size-3" />
      </ChatMessages.Attachment>
      <ChatMessages.Attachment name="statement_march.csv" />
      <ChatMessages.Attachment name="screenshot.png">
        <Paperclip className="text-fg-muted size-3" />
      </ChatMessages.Attachment>
    </div>
  ),
};
```

- [ ] **Step 2: Run type check**

```bash
vp check
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/chat-messages.stories.tsx
git commit -m "docs: add ChatMessages Storybook stories"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full check**

```bash
vp check && vp test
```

Expected: All checks pass, no type errors, no test failures.

- [ ] **Step 2: Verify Storybook builds**

```bash
vp run storybook build
```

Expected: Storybook builds successfully.

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final verification pass"
```
