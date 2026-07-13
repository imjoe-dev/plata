import type { ToolCallPart } from "@tanstack/ai-client";
import type { ToolCallDisplayState } from "@/components/ui/tool-call";

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

const TOOL_CALL_STATUS_LABELS: Record<ToolCallDisplayState, string | undefined> = {
  running: "running",
  "pending-approval": "awaiting approval",
  denied: "denied",
  error: "error",
  complete: undefined,
};

export function getToolCallStatusLabel(displayState: ToolCallDisplayState): string | undefined {
  return TOOL_CALL_STATUS_LABELS[displayState];
}
