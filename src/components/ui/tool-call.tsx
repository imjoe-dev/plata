import { cn } from "@/lib/utils";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDown, Wrench } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import { Button } from "@/components/ui/button";

export type ToolCallDisplayState = "running" | "pending-approval" | "complete" | "denied" | "error";

interface ToolCallContextValue {
  state: {
    displayState: ToolCallDisplayState;
    statusLabel?: string;
  };
  actions: {
    approve: () => void;
    deny: () => void;
  };
}

const ToolCallContext = createContext<ToolCallContextValue>({
  state: { displayState: "running", statusLabel: undefined },
  actions: { approve: () => {}, deny: () => {} },
});

// Consumed by later tasks' leaf components via useContext(ToolCallContext).

interface RootProps {
  displayState: ToolCallDisplayState;
  statusLabel?: string;
  onApprove?: () => void;
  onDeny?: () => void;
  className?: string;
  children: ReactNode;
}

function Root({ displayState, statusLabel, onApprove, onDeny, className, children }: RootProps) {
  const isError = displayState === "error";
  const isPendingApproval = displayState === "pending-approval";

  return (
    <ToolCallContext.Provider
      value={{
        state: { displayState, statusLabel },
        actions: {
          approve: onApprove ?? (() => {}),
          deny: onDeny ?? (() => {}),
        },
      }}
    >
      <Collapsible.Root
        className={cn(
          "group",
          isError ? "border-negative/40 bg-negative/5" : "border-hairline bg-raised",
          "border",
          className,
        )}
        data-tool-call-state={displayState}
        open={isPendingApproval ? true : undefined}
      >
        {children}
      </Collapsible.Root>
    </ToolCallContext.Provider>
  );
}

function Content({ className, ...props }: Collapsible.Panel.Props) {
  return (
    <Collapsible.Panel
      className={cn("border-hairline space-y-2 border-t px-3 py-2", className)}
      {...props}
    />
  );
}

interface NameProps {
  children: ReactNode;
  className?: string;
}

function Name({ children, className }: NameProps) {
  return (
    <Collapsible.Trigger
      className={cn(
        "duration-fast group-data-[tool-call-state=pending-approval]:hover:bg-caution/10 group-data-[tool-call-state=denied]:hover:bg-info/10 group-data-[tool-call-state=error]:hover:bg-negative/10 hover:bg-sunken flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors select-none",
        className,
      )}
    >
      <Wrench
        className={cn(
          "text-fg-muted size-3.5",
          "group-data-[tool-call-state=pending-approval]:text-caution",
          "group-data-[tool-call-state=denied]:text-info",
          "group-data-[tool-call-state=error]:text-negative",
        )}
      />
      <span
        className={cn(
          "text-fg-strong font-mono text-xs font-medium",
          "group-data-[tool-call-state=pending-approval]:text-caution",
          "group-data-[tool-call-state=denied]:text-info",
          "group-data-[tool-call-state=error]:text-negative",
        )}
      >
        {children}
      </span>
      <StatusBadge className="ml-auto" />
      <ChevronDown
        className={cn(
          "text-fg-muted ml-auto size-3.5 shrink-0 transition-transform data-panel-open:rotate-180",
          "group-data-[tool-call-state=pending-approval]:text-caution",
          "group-data-[tool-call-state=denied]:text-info",
          "group-data-[tool-call-state=error]:text-negative",
        )}
      />
    </Collapsible.Trigger>
  );
}

interface StatusBadgeProps {
  className?: string;
}

function StatusBadge({ className }: StatusBadgeProps) {
  const {
    state: { displayState, statusLabel },
  } = useContext(ToolCallContext);

  if (!statusLabel) return null;

  return (
    <span
      className={cn(
        "text-fg-muted inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase",
        "group-data-[tool-call-state=pending-approval]:text-caution",
        "group-data-[tool-call-state=denied]:text-info",
        "group-data-[tool-call-state=error]:text-negative",
        className,
      )}
    >
      {displayState === "running" ? (
        <span
          aria-hidden="true"
          className="inline-block size-3 animate-spin border border-current border-t-transparent"
        />
      ) : (
        <span aria-hidden="true" className="size-[5px] bg-current" />
      )}
      {statusLabel}
    </span>
  );
}

interface ArgsProps {
  children: ReactNode;
  className?: string;
}

function Args({ children, className }: ArgsProps) {
  if (!children) return null;

  return (
    <div className={className}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Arguments</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

interface ResponseProps {
  children: ReactNode;
  className?: string;
}

function Response({ children, className }: ResponseProps) {
  const {
    state: { displayState },
  } = useContext(ToolCallContext);

  if (displayState !== "complete" || !children) return null;

  return (
    <div className={className}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Response</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

interface ErrorProps {
  children: ReactNode;
  className?: string;
}

function Error({ children, className }: ErrorProps) {
  const {
    state: { displayState },
  } = useContext(ToolCallContext);

  if (displayState !== "error") return null;

  return (
    <div className={className}>
      <span className="text-negative mb-1 block font-mono text-[10px]">Error</span>
      <pre className="bg-negative/10 text-negative overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

interface ApprovalActionsProps {
  approveLabel?: string;
  denyLabel?: string;
  className?: string;
}

function ApprovalActions({
  approveLabel = "Approve",
  denyLabel = "Deny",
  className,
}: ApprovalActionsProps) {
  const {
    state: { displayState },
    actions: { approve, deny },
  } = useContext(ToolCallContext);

  if (displayState !== "pending-approval") return null;

  return (
    <div className={cn("flex gap-2", className)}>
      <Button variant="primary" size="sm" onClick={approve}>
        {approveLabel}
      </Button>
      <Button variant="destructive" size="sm" onClick={deny}>
        {denyLabel}
      </Button>
    </div>
  );
}

interface DeniedNoticeProps {
  children: ReactNode;
  className?: string;
}

function DeniedNotice({ children, className }: DeniedNoticeProps) {
  const {
    state: { displayState },
  } = useContext(ToolCallContext);

  if (displayState !== "denied") return null;

  return (
    <div className={className}>
      <span className="text-info mb-1 block font-mono text-[10px]">Declined</span>
      <pre className="bg-info/10 text-info overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

export const ToolCall = {
  Root,
  Name,
  StatusBadge,
  Content,
  Args,
  Response,
  Error,
  ApprovalActions,
  DeniedNotice,
};
