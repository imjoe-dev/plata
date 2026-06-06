import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Table } from "@/components/ui/table";
import { Wrench, ChevronDown } from "lucide-react";
import { Collapsible } from "@base-ui/react/collapsible";

const markdownComponents: Components = {
  p: ({ children, ...props }) => (
    <p className="text-fg text-sm leading-relaxed" {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="text-fg-strong mt-3 mb-1 text-lg font-medium" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-fg-strong mt-2 mb-1 font-medium" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-fg-strong mt-2 mb-0.5 text-sm font-medium" {...props}>
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
    <ul className="text-fg list-disc space-y-1 pl-5 text-sm" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="text-fg list-decimal space-y-1 pl-5 text-sm" {...props}>
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
      className="border-hairline-strong text-fg-muted my-2 border-l-2 pl-3 text-sm italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  a: ({ children, ...props }) => (
    <a className="text-accent underline" target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  hr: (props) => <hr className="border-hairline my-3" {...props} />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <Table.Root>{children}</Table.Root>
    </div>
  ),
  thead: ({ children }) => <Table.Header>{children}</Table.Header>,
  tbody: ({ children }) => <Table.Body>{children}</Table.Body>,
  th: ({ children }) => <Table.Head>{children}</Table.Head>,
  td: ({ children }) => <Table.Cell>{children}</Table.Cell>,
  tr: ({ children }) => <Table.Row>{children}</Table.Row>,
  img: () => null,
  code: () => null,
  pre: () => null,
};

function List({ children, className, ...props }: React.ComponentProps<"div">) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [children]);

  return (
    <div className={cn("flex flex-col gap-3 overflow-y-auto p-4", className)} {...props}>
      {children}
      <div ref={sentinelRef} />
    </div>
  );
}

function UserMessage({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { children: string }) {
  return (
    <div className={cn("flex justify-end", className)} {...props}>
      <div className="max-w-[80%]">
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {children}
        </Markdown>
      </div>
    </div>
  );
}

function AssistantMessage({
  children,
  className,
}: React.ComponentProps<"div"> & { children: string }) {
  return (
    <div className={cn("flex justify-start", className)}>
      <div className="max-w-[80%]">
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {children}
        </Markdown>
      </div>
    </div>
  );
}

function Attachment({ name, children, className }: React.ComponentProps<"div"> & { name: string }) {
  return (
    <div
      className={cn(
        "bg-raised border-hairline text-fg inline-flex items-center gap-1.5 border px-2 py-1 text-xs",
        className,
      )}
    >
      {children}
      <span className="text-fg-muted max-w-50 truncate">{name}</span>
    </div>
  );
}

function ToolCallName({ children, className, ...props }: Collapsible.Trigger.Props) {
  return (
    <Collapsible.Trigger
      className={cn(
        "hover:bg-sunken duration-fast flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors select-none",
        className,
      )}
      {...props}
    >
      <Wrench className="text-fg-muted size-3.5" />
      {children}
      <ChevronDown className="text-fg-muted ml-auto size-3.5 transition-transform data-panel-open:rotate-180" />
    </Collapsible.Trigger>
  );
}
ToolCallName.displayName = "ChatMessages.ToolCallName";

function ToolCall({ className, ...props }: Collapsible.Root.Props) {
  return (
    <Collapsible.Root className={cn("border-hairline bg-raised border", className)} {...props} />
  );
}

function ToolCallContent({ className, ...props }: Collapsible.Panel.Props) {
  return (
    <Collapsible.Panel
      className={cn("border-hairline space-y-2 border-t px-3 py-2", className)}
      {...props}
    />
  );
}

function ToolCallArgs({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={className} {...props}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Arguments</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

function ToolCallResponse({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={className} {...props}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Response</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

export const ChatMessages = {
  List,
  UserMessage,
  AssistantMessage,
  ToolCall,
  ToolCallName,
  ToolCallContent,
  ToolCallArgs,
  ToolCallResponse,
  Attachment,
};
