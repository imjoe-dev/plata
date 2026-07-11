import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ToolCallPart } from "@tanstack/ai-client";
import { Table } from "@/components/ui/table";
import { Wrench, ChevronDown } from "lucide-react";
import { Collapsible } from "@base-ui/react/collapsible";
import { Button } from "@/components/ui/button";

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

export type ToolCallDisplayState = "running" | "pending-approval" | "complete" | "denied" | "error";

export function getToolCallDisplayState(part: ToolCallPart): ToolCallDisplayState {
  const state = part.state as string; // Handle type compatibility with library version

  // pending-approval: when approval has been requested and approval exists
  if (state === "approval-requested" && part.approval) {
    return "pending-approval";
  }

  // denied: when in error state and explicitly denied by user (approved === false)
  if (state === "error" && part.approval?.approved === false) {
    return "denied";
  }

  // error: when in error state but not denied (genuine execution failure)
  if (state === "error" && part.approval?.approved !== false) {
    return "error";
  }

  // complete: when execution finished successfully (state is complete or output is defined without error)
  if (state === "complete" || (part.output !== undefined && state !== "error")) {
    return "complete";
  }

  // running: intermediate states during execution and between approval decision and continuation
  if (
    state === "awaiting-input" ||
    state === "input-streaming" ||
    state === "input-complete" ||
    state === "approval-responded"
  ) {
    return "running";
  }

  // default to running for any unhandled states
  return "running";
}

const TOOL_CALL_NAME_STYLES: Record<
  ToolCallDisplayState,
  { icon: string; label: string; hover: string; indicator: string }
> = {
  running: {
    icon: "text-fg-muted",
    label: "text-fg-strong",
    hover: "hover:bg-sunken",
    indicator: "text-fg-muted",
  },
  complete: {
    icon: "text-fg-muted",
    label: "text-fg-strong",
    hover: "hover:bg-sunken",
    indicator: "text-fg-muted",
  },
  "pending-approval": {
    icon: "text-caution",
    label: "text-caution",
    hover: "hover:bg-caution/10",
    indicator: "text-caution",
  },
  denied: {
    icon: "text-info",
    label: "text-info",
    hover: "hover:bg-info/10",
    indicator: "text-info",
  },
  error: {
    icon: "text-negative",
    label: "text-negative",
    hover: "hover:bg-negative/10",
    indicator: "text-negative",
  },
};

function ToolCallName({ className, part }: { part: ToolCallPart; className?: string }) {
  const displayState = getToolCallDisplayState(part);
  const styles = TOOL_CALL_NAME_STYLES[displayState];

  return (
    <Collapsible.Trigger
      className={cn(
        "duration-fast flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors select-none",
        styles.hover,
        className,
      )}
    >
      <Wrench className={cn("size-3.5", styles.icon)} />
      <span className={cn("font-mono text-xs font-medium", styles.label)}>{part.name}</span>
      {displayState === "running" && (
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase",
            styles.indicator,
          )}
        >
          <span
            aria-hidden="true"
            className="inline-block size-3 animate-spin border border-current border-t-transparent"
          />
          running
        </span>
      )}
      {displayState === "pending-approval" && (
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase",
            styles.indicator,
          )}
        >
          <span aria-hidden="true" className="size-[5px] bg-current" />
          awaiting approval
        </span>
      )}
      {displayState === "denied" && (
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase",
            styles.indicator,
          )}
        >
          <span aria-hidden="true" className="size-[5px] bg-current" />
          denied
        </span>
      )}
      {displayState === "error" && (
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase",
            styles.indicator,
          )}
        >
          <span aria-hidden="true" className="size-[5px] bg-current" />
          error
        </span>
      )}
      <ChevronDown
        className={cn(
          "size-3.5 transition-transform data-panel-open:rotate-180",
          styles.icon,
          displayState === "complete" && "ml-auto",
        )}
      />
    </Collapsible.Trigger>
  );
}
ToolCallName.displayName = "ChatMessages.ToolCallName";

function ToolCall({
  className,
  part,
  children,
}: {
  part: ToolCallPart;
  className?: string;
  children?: React.ReactNode;
}) {
  const displayState = getToolCallDisplayState(part);
  const isError = displayState === "error";
  const isPendingApproval = displayState === "pending-approval";

  return (
    <Collapsible.Root
      className={cn(
        "border",
        isError ? "border-negative/40 bg-negative/5" : "border-hairline bg-raised",
        className,
      )}
      open={isPendingApproval ? true : undefined}
    >
      {children}
    </Collapsible.Root>
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

function ToolCallArgs({ part, className }: { part: ToolCallPart; className?: string }) {
  if (!part.arguments) {
    return null;
  }

  return (
    <div className={className}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Arguments</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {part.arguments}
      </pre>
    </div>
  );
}

function ToolCallResponse({ part, className }: { part: ToolCallPart; className?: string }) {
  if (getToolCallDisplayState(part) !== "complete" || part.output === undefined) {
    return null;
  }

  return (
    <div className={className}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Response</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {JSON.stringify(part.output)}
      </pre>
    </div>
  );
}

function ToolCallError({ part, className }: { part: ToolCallPart; className?: string }) {
  if (getToolCallDisplayState(part) !== "error") {
    return null;
  }

  const errorText =
    (part.output as { error?: string } | undefined)?.error ?? JSON.stringify(part.output);

  return (
    <div className={className}>
      <span className="text-negative mb-1 block font-mono text-[10px]">Error</span>
      <pre className="bg-negative/10 text-negative overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {errorText}
      </pre>
    </div>
  );
}

function ToolCallApprovalActions({
  part,
  onApprove,
  onDeny,
  className,
}: {
  part: ToolCallPart;
  onApprove: () => void;
  onDeny: () => void;
  className?: string;
}) {
  if (getToolCallDisplayState(part) !== "pending-approval") {
    return null;
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <Button variant="primary" size="sm" onClick={onApprove}>
        Approve
      </Button>
      <Button variant="destructive" size="sm" onClick={onDeny}>
        Deny
      </Button>
    </div>
  );
}
ToolCallApprovalActions.displayName = "ChatMessages.ToolCallApprovalActions";

function ToolCallDeniedNotice({ part, className }: { part: ToolCallPart; className?: string }) {
  if (getToolCallDisplayState(part) !== "denied") {
    return null;
  }

  return (
    <div className={className}>
      <span className="text-info mb-1 block font-mono text-[10px]">Declined</span>
      <div className="bg-info/10 text-info p-2 text-xs">You declined this action.</div>
    </div>
  );
}
ToolCallDeniedNotice.displayName = "ChatMessages.ToolCallDeniedNotice";

export const ChatMessages = {
  List,
  UserMessage,
  AssistantMessage,
  ToolCall,
  ToolCallName,
  ToolCallContent,
  ToolCallArgs,
  ToolCallApprovalActions,
  ToolCallResponse,
  ToolCallDeniedNotice,
  ToolCallError,
  Attachment,
};
