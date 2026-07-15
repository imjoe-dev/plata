import { cn } from "@/lib/utils";
import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDown, Wrench } from "lucide-react";
import { createContext, useContext } from "react";
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

type RootProps = Omit<Collapsible.Root.Props, "open"> & {
  displayState: ToolCallDisplayState;
  statusLabel?: string;
  onApprove?: () => void;
  onDeny?: () => void;
};

function Root({
  displayState,
  statusLabel,
  onApprove,
  onDeny,
  className,
  children,
  ...props
}: RootProps) {
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
        {...props}
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

function Name({ children, className, ...props }: Collapsible.Trigger.Props) {
  return (
    <Collapsible.Trigger
      className={cn(
        "duration-fast group-data-[tool-call-state=pending-approval]:hover:bg-caution/10 group-data-[tool-call-state=denied]:hover:bg-info/10 group-data-[tool-call-state=error]:hover:bg-negative/10 hover:bg-sunken flex w-full cursor-pointer items-center gap-2 px-3 py-2 transition-colors select-none",
        className,
      )}
      {...props}
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

function StatusBadge({ className, ...props }: React.ComponentProps<"span">) {
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
      {...props}
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

function Args({ children, className, ...props }: React.ComponentProps<"div">) {
  if (!children) return null;

  return (
    <div className={className} {...props}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Arguments</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

function Response({ children, className, ...props }: React.ComponentProps<"div">) {
  const {
    state: { displayState },
  } = useContext(ToolCallContext);

  if (displayState !== "complete" || !children) return null;

  return (
    <div className={className} {...props}>
      <span className="text-fg-muted mb-1 block font-mono text-[10px]">Response</span>
      <pre className="bg-sunken text-fg overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

function Error({ children, className, ...props }: React.ComponentProps<"div">) {
  const {
    state: { displayState },
  } = useContext(ToolCallContext);

  if (displayState !== "error") return null;

  return (
    <div className={className} {...props}>
      <span className="text-negative mb-1 block font-mono text-[10px]">Error</span>
      <pre className="bg-negative/10 text-negative overflow-x-auto p-2 font-mono text-xs whitespace-pre-wrap">
        {children}
      </pre>
    </div>
  );
}

type ApprovalActionsProps = {
  approveLabel?: string;
  denyLabel?: string;
};

function ApprovalActions({
  approveLabel = "Approve",
  denyLabel = "Deny",
  className,
  ...props
}: ApprovalActionsProps & React.ComponentProps<"div">) {
  const {
    state: { displayState },
    actions: { approve, deny },
  } = useContext(ToolCallContext);

  if (displayState !== "pending-approval") return null;

  return (
    <div className={cn("flex gap-2", className)} {...props}>
      <Button variant="primary" size="sm" onClick={approve}>
        {approveLabel}
      </Button>
      <Button variant="destructive" size="sm" onClick={deny}>
        {denyLabel}
      </Button>
    </div>
  );
}

function DeniedNotice({ children, className, ...props }: React.ComponentProps<"div">) {
  const {
    state: { displayState },
  } = useContext(ToolCallContext);

  if (displayState !== "denied") return null;

  return (
    <div className={className} {...props}>
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
