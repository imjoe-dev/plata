import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  p: ({ children, ...props }) => (
    <p className="text-fg text-sm leading-relaxed" {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="text-fg-strong mt-3 mb-1 font-serif text-lg font-medium" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-fg-strong mt-2 mb-1 font-serif text-base font-medium" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-fg-strong mt-2 mb-0.5 font-serif text-sm font-medium" {...props}>
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
    <a className="text-accent underline" {...props}>
      {children}
    </a>
  ),
  hr: (props) => <hr className="border-hairline my-3" {...props} />,
  table: ({ children, ...props }) => (
    <div className="my-2 overflow-x-auto">
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
      className="text-fg-strong border-hairline border-b px-2 py-1 text-left text-xs font-medium"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="text-fg border-hairline border-b px-2 py-1 text-sm" {...props}>
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  img: () => <></>,
  code: () => <></>,
  pre: () => <></>,
};

interface ChatMessagesListProps {
  children: ReactNode;
  className?: string;
}

function List({ children, className }: ChatMessagesListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [children]);

  return (
    <div className={cn("flex flex-col gap-3 overflow-y-auto p-4", className)}>
      {children}
      <div ref={sentinelRef} />
    </div>
  );
}

interface ChatMessagesUserMessageProps {
  children: string;
  className?: string;
}

function UserMessage({ children, className }: ChatMessagesUserMessageProps) {
  return (
    <div className={cn("flex justify-end", className)}>
      <div className="max-w-[80%]">
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {children}
        </Markdown>
      </div>
    </div>
  );
}

interface ChatMessagesAssistantMessageProps {
  children: string;
  className?: string;
}

function AssistantMessage({ children, className }: ChatMessagesAssistantMessageProps) {
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
      <span className="text-fg-muted max-w-[200px] truncate">{name}</span>
    </div>
  );
}

export { List, UserMessage, AssistantMessage, Attachment };
