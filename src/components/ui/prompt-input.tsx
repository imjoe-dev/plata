import { cn } from "@/lib/utils";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
} from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";

interface PromptInputContextValue {
  editor: Editor | null;
}

const PromptInputContext = createContext<PromptInputContextValue>({
  editor: null,
});

function usePromptInputContext() {
  return useContext(PromptInputContext);
}

interface RootProps {
  defaultValue?: string;
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onSubmit?: (text: string) => boolean;
}

function Root({
  defaultValue = "",
  value,
  onChange,
  placeholder = "",
  disabled = false,
  className,
  children,
  onSubmit,
}: RootProps) {
  const [isControlled] = useState(() => value !== undefined);

  const extensions = [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
    }),
    Placeholder.configure({ placeholder }),
  ];

  const editor = useEditor({
    extensions,
    content: isControlled ? value : defaultValue,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "text-fg min-h-[120px] w-full px-3 py-2 font-sans text-sm leading-relaxed outline-none",
          "[&_h1]:text-fg-strong [&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-lg [&_h1]:font-medium",
          "[&_h2]:text-fg-strong [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-medium",
          "[&_h3]:text-fg-strong [&_h3]:mt-2 [&_h3]:mb-0.5 [&_h3]:text-sm [&_h3]:font-medium",
          "[&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-5",
          "[&_ol]:list-decimal [&_ol]:space-y-0.5 [&_ol]:pl-5",
          "[&_blockquote]:border-hairline-strong [&_blockquote]:text-fg-muted [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic",
          "[&_hr]:border-hairline [&_hr]:my-3",
          "[&_strong]:text-fg-strong [&_strong]:font-semibold",
          "[&_em]:italic",
          "[&_s]:text-fg-muted [&_s]:line-through",
          "[&_p.is-editor-empty:first-child::before]:text-fg-faint [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (isControlled && editor && value !== undefined) {
      const currentContent = editor.getHTML();
      if (value !== currentContent) {
        editor.commands.setContent(value, { emitUpdate: false });
      }
    }
  }, [editor, value, isControlled]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  function handleOnKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && onSubmit && editor) {
      e.preventDefault();
      const text = editor.getText().trim();
      if (!text) {
        return;
      }

      if (onSubmit(text)) {
        editor.commands.clearContent();
        editor.commands.focus();
      }
    }
  }

  if (!editor) {
    return <Skeleton className={className} />;
  }

  return (
    <PromptInputContext.Provider value={{ editor }}>
      <div
        className={cn("flex flex-col", disabled && "pointer-events-none opacity-40", className)}
        onKeyDown={handleOnKeyDown}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  );
}

function Toolbar({ className }: { className?: string }) {
  const { editor } = usePromptInputContext();
  if (!editor) return null;

  function btn(isActive: boolean) {
    return cn(
      "duration-fast text-fg-muted hover:text-fg hover:bg-sunken inline-flex size-7 items-center justify-center text-xs transition-colors ease-out",
      isActive && "text-accent bg-sunken",
    );
  }

  const icon = "size-3.5";

  return (
    <div
      className={cn(
        "border-hairline bg-raised flex flex-wrap items-center gap-0.5 border-b p-1",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        aria-label="Bold"
      >
        <Bold className={icon} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
        aria-label="Italic"
      >
        <Italic className={icon} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
        aria-label="Strikethrough"
      >
        <Strikethrough className={icon} />
      </button>

      <div className="bg-hairline mx-1 h-5 w-px" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
        aria-label="Heading 1"
      >
        <Heading1 className={icon} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
        aria-label="Heading 2"
      >
        <Heading2 className={icon} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
        aria-label="Heading 3"
      >
        <Heading3 className={icon} />
      </button>

      <div className="bg-hairline mx-1 h-5 w-px" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        aria-label="Bullet list"
      >
        <List className={icon} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        aria-label="Ordered list"
      >
        <ListOrdered className={icon} />
      </button>

      <div className="bg-hairline mx-1 h-5 w-px" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
        aria-label="Blockquote"
      >
        <Quote className={icon} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btn(false)}
        aria-label="Horizontal rule"
      >
        <Minus className={icon} />
      </button>
    </div>
  );
}

interface EditorSlotProps {
  className?: string;
}

function EditorSlot({ className }: EditorSlotProps) {
  const { editor } = usePromptInputContext();
  if (!editor) return null;

  return (
    <div
      className={cn(
        "bg-sunken border-hairline focus-within:bg-base focus-within:border-fg-muted w-full border",
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-hairline bg-sunken min-h-30 w-full animate-pulse border px-3 py-2",
        className,
      )}
      {...props}
    >
      <div className="bg-raised mb-2 h-3 w-3/4 rounded" />
      <div className="bg-raised h-3 w-1/2 rounded" />
    </div>
  );
}

export const PromptInput = {
  Root,
  Toolbar,
  Editor: EditorSlot,
  Skeleton,
};
