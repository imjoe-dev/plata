import type { ToolCallPart } from "@tanstack/ai-client";
import type { ToolCallDisplayState } from "@/components/ui/tool-call";

export function getToolCallDisplayState(part: ToolCallPart): ToolCallDisplayState {
  const state = part.state as string;

  if (state === "approval-requested" && part.approval) {
    return "pending-approval";
  }

  if (state === "error" && part.approval?.approved === false) {
    return "denied";
  }

  if (state === "error" && part.approval?.approved !== false) {
    return "error";
  }

  if (state === "complete" || (part.output !== undefined && state !== "error")) {
    return "complete";
  }

  if (
    state === "awaiting-input" ||
    state === "input-streaming" ||
    state === "input-complete" ||
    state === "approval-responded"
  ) {
    return "running";
  }

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

/** Delete tools (docs/adr/0006) are never covered by Session Approval — identified by name. */
export function isDeleteTool(name: string): boolean {
  return name.startsWith("delete_");
}
