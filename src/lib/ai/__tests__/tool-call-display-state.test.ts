import { describe, expect, it } from "vite-plus/test";
import type { ToolCallPart } from "@tanstack/ai-client";
import { getToolCallDisplayState, getToolCallStatusLabel } from "@/lib/ai/tool-call-display-state";

describe("getToolCallDisplayState", () => {
  it("returns 'pending-approval' when state is 'approval-requested' and approval exists", () => {
    const part: ToolCallPart = {
      type: "tool-call",
      id: "1",
      name: "create_transaction",
      arguments: '{"amount": 100}',
      state: "approval-requested",
      approval: { id: "approval-1", needsApproval: true },
    };

    expect(getToolCallDisplayState(part)).toBe("pending-approval");
  });

  it("returns 'denied' when state is 'error' and approval.approved is false", () => {
    const part = {
      type: "tool-call",
      id: "1",
      name: "create_transaction",
      arguments: '{"amount": 100}',
      state: "error" as const,
      approval: { id: "approval-1", needsApproval: true, approved: false },
      output: { error: "User declined tool execution" },
    } as unknown as ToolCallPart;

    expect(getToolCallDisplayState(part)).toBe("denied");
  });

  it("returns 'error' when state is 'error' and approval is undefined", () => {
    const part = {
      type: "tool-call",
      id: "1",
      name: "list_transactions",
      arguments: "{}",
      state: "error" as const,
      output: { error: "Some error occurred" },
    } as unknown as ToolCallPart;

    expect(getToolCallDisplayState(part)).toBe("error");
  });

  it("returns 'error' when state is 'error' and approval.approved is not false", () => {
    const part = {
      type: "tool-call",
      id: "1",
      name: "create_transaction",
      arguments: '{"amount": 100}',
      state: "error" as const,
      approval: { id: "approval-1", needsApproval: true, approved: true },
      output: { error: "Tool execution failed" },
    } as unknown as ToolCallPart;

    expect(getToolCallDisplayState(part)).toBe("error");
  });

  it("returns 'running' when state is 'input-streaming'", () => {
    const part: ToolCallPart = {
      type: "tool-call",
      id: "1",
      name: "create_transaction",
      arguments: '{"amount": 100}',
      state: "input-streaming",
    };

    expect(getToolCallDisplayState(part)).toBe("running");
  });

  it("returns 'running' when state is 'approval-responded'", () => {
    const part: ToolCallPart = {
      type: "tool-call",
      id: "1",
      name: "create_transaction",
      arguments: '{"amount": 100}',
      state: "approval-responded",
    };

    expect(getToolCallDisplayState(part)).toBe("running");
  });

  it("returns 'complete' when state is 'complete'", () => {
    const part: ToolCallPart = {
      type: "tool-call",
      id: "1",
      name: "create_transaction",
      arguments: '{"amount": 100}',
      state: "complete",
      output: { id: "tx-1" },
    };

    expect(getToolCallDisplayState(part)).toBe("complete");
  });

  it("returns 'complete' when output is defined without error", () => {
    const part: ToolCallPart = {
      type: "tool-call",
      id: "1",
      name: "create_transaction",
      arguments: '{"amount": 100}',
      state: "approval-responded",
      output: { id: "tx-1" },
    };

    expect(getToolCallDisplayState(part)).toBe("complete");
  });
});

describe("getToolCallStatusLabel", () => {
  it("returns 'running' for the 'running' display state", () => {
    expect(getToolCallStatusLabel("running")).toBe("running");
  });

  it("returns 'awaiting approval' for the 'pending-approval' display state", () => {
    expect(getToolCallStatusLabel("pending-approval")).toBe("awaiting approval");
  });

  it("returns 'denied' for the 'denied' display state", () => {
    expect(getToolCallStatusLabel("denied")).toBe("denied");
  });

  it("returns 'error' for the 'error' display state", () => {
    expect(getToolCallStatusLabel("error")).toBe("error");
  });

  it("returns undefined for the 'complete' display state", () => {
    expect(getToolCallStatusLabel("complete")).toBeUndefined();
  });
});
