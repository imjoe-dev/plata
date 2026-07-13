import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Table } from "@/components/ui/table";

const markdownComponents: Components = {
  p: (props) => <p className="text-fg text-sm leading-relaxed" {...props} />,
  h1: (props) => <h1 className="text-fg-strong mt-3 mb-1 text-lg font-medium" {...props} />,
  h2: (props) => <h2 className="text-fg-strong mt-2 mb-1 font-medium" {...props} />,
  h3: (props) => <h3 className="text-fg-strong mt-2 mb-0.5 text-sm font-medium" {...props} />,
  strong: (props) => <strong className="text-fg-strong font-semibold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  del: (props) => <del className="text-fg-muted line-through" {...props} />,
  ul: (props) => <ul className="text-fg list-disc space-y-1 pl-5 text-sm" {...props} />,
  ol: (props) => <ol className="text-fg list-decimal space-y-1 pl-5 text-sm" {...props} />,
  li: (props) => <li className="text-fg text-sm" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-hairline-strong text-fg-muted my-2 border-l-2 pl-3 text-sm italic"
      {...props}
    />
  ),
  a: (props) => (
    <a className="text-accent underline" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  hr: (props) => <hr className="border-hairline my-3" {...props} />,
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <Table.Root {...props} />
    </div>
  ),
  thead: (props) => <Table.Header {...props} />,
  tbody: (props) => <Table.Body {...props} />,
  th: (props) => <Table.Head {...props} />,
  td: (props) => <Table.Cell {...props} />,
  tr: (props) => <Table.Row {...props} />,
  img: () => null,
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
};

const userMarkdownComponents: Components = {
  p: (props) => <p className="text-sm leading-relaxed" {...props} />,
  h1: (props) => <h1 className="mt-3 mb-1 text-lg font-medium" {...props} />,
  h2: (props) => <h2 className="mt-2 mb-1 font-medium" {...props} />,
  h3: (props) => <h3 className="mt-2 mb-0.5 text-sm font-medium" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  del: (props) => <del className="line-through opacity-60" {...props} />,
  ul: (props) => <ul className="list-disc space-y-1 pl-5 text-sm" {...props} />,
  ol: (props) => <ol className="list-decimal space-y-1 pl-5 text-sm" {...props} />,
  li: (props) => <li className="text-sm" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="my-2 border-l-2 border-current/30 pl-3 text-sm italic opacity-75"
      {...props}
    />
  ),
  a: (props) => (
    <a
      className="underline decoration-current/50"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  hr: (props) => <hr className="my-3 border-current/30" {...props} />,
  table: () => null,
  thead: () => null,
  tbody: () => null,
  th: () => null,
  td: () => null,
  tr: () => null,
  img: () => null,
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
      className="my-2 overflow-x-auto bg-current/[0.07] p-2 font-mono text-xs whitespace-pre-wrap"
      {...props}
    >
      {children}
    </pre>
  ),
};

function List({ children, className, ...props }: React.ComponentProps<"div">) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
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
      <div className="bg-accent text-accent-fg max-w-[80%] p-3.5">
        <Markdown remarkPlugins={[remarkGfm]} components={userMarkdownComponents}>
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
      <div className="bg-raised border-hairline max-w-[80%] border p-3.5">
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

export const ChatMessages = {
  List,
  UserMessage,
  AssistantMessage,
  Attachment,
};
