import { describe, expect, it } from "vite-plus/test";
import { getToolCallDisplayState } from "@/components/ui/chat-messages";
import type { ToolCallPart } from "@tanstack/ai-client";

describe("getToolCallDisplayState", () => {
  describe("pending-approval state", () => {
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
  });

  describe("denied state", () => {
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
  });

  describe("error state", () => {
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

    it("returns 'error' when state is 'error' and approval.approved is undefined", () => {
      const part = {
        type: "tool-call",
        id: "1",
        name: "create_transaction",
        arguments: '{"amount": 100}',
        state: "error" as const,
        approval: { id: "approval-1", needsApproval: true },
        output: { error: "Tool execution failed" },
      } as unknown as ToolCallPart;

      expect(getToolCallDisplayState(part)).toBe("error");
    });
  });

  describe("running state", () => {
    it("returns 'running' when state is 'awaiting-input'", () => {
      const part: ToolCallPart = {
        type: "tool-call",
        id: "1",
        name: "create_transaction",
        arguments: '{"amount": 100}',
        state: "awaiting-input",
      };

      expect(getToolCallDisplayState(part)).toBe("running");
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

    it("returns 'running' when state is 'input-complete'", () => {
      const part: ToolCallPart = {
        type: "tool-call",
        id: "1",
        name: "create_transaction",
        arguments: '{"amount": 100}',
        state: "input-complete",
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
  });

  describe("complete state", () => {
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
});
