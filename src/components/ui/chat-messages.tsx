import {
  useEffect,
  useRef,
  Children,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Wrench, ChevronDown } from "lucide-react";

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
    <a className="text-accent underline" target="_blank" rel="noopener noreferrer" {...props}>
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
  img: () => null,
  code: () => null,
  pre: () => null,
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

interface ChatMessagesToolCallNameProps {
  children: ReactNode;
  className?: string;
}

function ToolCallName({ children, className }: ChatMessagesToolCallNameProps) {
  return (
    <span className={cn("text-fg-strong font-mono text-xs font-medium", className)}>
      {children}
    </span>
  );
}
ToolCallName.displayName = "ChatMessages.ToolCallName";

interface ChatMessagesToolCallProps {
  children: ReactNode;
  className?: string;
  defaultExpanded?: boolean;
}

function ToolCall({ children, className, defaultExpanded = false }: ChatMessagesToolCallProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = () => setExpanded((prev) => !prev);

  const childrenArray = Children.toArray(children);
  const toolCallNameChild = childrenArray.find(
    (child) => isValidElement(child) && child.type === ToolCallName,
  );
  const restChildren = childrenArray.filter(
    (child) => !(isValidElement(child) && child.type === ToolCallName),
  );

  return (
    <ToolCallContext.Provider value={{ expanded, toggle }}>
      <div className={cn("border-hairline bg-raised border", className)}>
        <button
          type="button"
          className="hover:bg-sunken duration-fast flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors select-none"
          onClick={toggle}
        >
          <Wrench className="text-fg-muted size-3.5" />
          <span className="text-fg-muted font-mono text-xs">Tool call</span>
          {toolCallNameChild}
          <ChevronDown
            className={cn(
              "text-fg-muted ml-auto size-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        {expanded && (
          <div className="border-hairline space-y-2 border-t px-3 py-2">{restChildren}</div>
        )}
      </div>
    </ToolCallContext.Provider>
  );
}

interface ChatMessagesToolCallArgsProps {
  children: ReactNode;
  className?: string;
}

function ToolCallArgs({ children, className }: ChatMessagesToolCallArgsProps) {
  const { expanded } = useToolCall();
  if (!expanded) return null;

  return (
    <div className={className}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Arguments</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

interface ChatMessagesToolCallResponseProps {
  children: ReactNode;
  className?: string;
}

function ToolCallResponse({ children, className }: ChatMessagesToolCallResponseProps) {
  const { expanded } = useToolCall();
  if (!expanded) return null;

  return (
    <div className={className}>
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
  ToolCallArgs,
  ToolCallResponse,
  Attachment,
};
