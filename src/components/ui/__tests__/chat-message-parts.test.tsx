// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MessagePart, ToolCallPart, ToolResultPart } from "@tanstack/ai";

import {
  AssistantMessageParts,
  ToolCallView,
  findToolResult,
  getToolCallStatus,
} from "@/components/ui/chat-message-parts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

function toolCall(overrides: Partial<ToolCallPart> = {}): ToolCallPart {
  return {
    type: "tool-call",
    id: "call_1",
    name: "create_transaction",
    arguments: JSON.stringify({ amount: 1500, category: "housing" }),
    state: "complete",
    ...overrides,
  };
}

function toolResult(overrides: Partial<ToolResultPart> = {}): ToolResultPart {
  return {
    type: "tool-result",
    toolCallId: "call_1",
    content: JSON.stringify({ id: "t_abc123", status: "created" }),
    state: "complete",
    ...overrides,
  };
}

function textPart(content: string): MessagePart {
  return { type: "text", content };
}

describe("getToolCallStatus", () => {
  it("is pending while tool input is streaming", () => {
    expect(getToolCallStatus(toolCall({ state: "input-streaming" }))).toBe("pending");
    expect(getToolCallStatus(toolCall({ state: "awaiting-input" }))).toBe("pending");
    expect(getToolCallStatus(toolCall({ state: "input-complete" }))).toBe("pending");
  });

  it("is pending while the paired result is still streaming", () => {
    expect(getToolCallStatus(toolCall(), toolResult({ state: "streaming" }))).toBe("pending");
  });

  it("is complete when the paired result is complete", () => {
    expect(getToolCallStatus(toolCall({ state: "input-complete" }), toolResult())).toBe("complete");
  });

  it("is complete for a client-executed call with no result part", () => {
    expect(getToolCallStatus(toolCall({ state: "complete", output: { ok: true } }))).toBe(
      "complete",
    );
  });

  it("is error when the paired result errored", () => {
    expect(getToolCallStatus(toolCall(), toolResult({ state: "error", error: "boom" }))).toBe(
      "error",
    );
  });
});

describe("findToolResult", () => {
  it("pairs a tool-call with its tool-result by toolCallId", () => {
    const parts: MessagePart[] = [
      toolCall({ id: "call_a", name: "list_categories" }),
      toolCall({ id: "call_b", name: "create_transaction" }),
      toolResult({ toolCallId: "call_b", content: '{"id":"t2"}' }),
      toolResult({ toolCallId: "call_a", content: '{"id":"t1"}' }),
    ];

    expect(findToolResult(parts, "call_a")?.content).toBe('{"id":"t1"}');
    expect(findToolResult(parts, "call_b")?.content).toBe('{"id":"t2"}');
  });

  it("returns undefined when no result matches", () => {
    expect(findToolResult([toolCall()], "call_1")).toBeUndefined();
  });
});

describe("ToolCallView", () => {
  it("renders the raw tool name in the row", () => {
    render(<ToolCallView part={toolCall()} result={toolResult()} />);
    expect(screen.getByText("create_transaction")).toBeDefined();
  });

  it("reveals pretty-printed arguments and response when expanded", () => {
    render(<ToolCallView part={toolCall()} result={toolResult()} defaultOpen />);

    expect(screen.getByText("Arguments")).toBeDefined();
    expect(screen.getByText(/"amount": 1500/)).toBeDefined();
    expect(screen.getByText("Response")).toBeDefined();
    expect(screen.getByText(/"id": "t_abc123"/)).toBeDefined();
  });

  it("falls back to ToolCallPart.output when no tool-result part exists", () => {
    render(<ToolCallView part={toolCall({ output: { id: "t_client" } })} defaultOpen />);

    expect(screen.getByText("Response")).toBeDefined();
    expect(screen.getByText(/"id": "t_client"/)).toBeDefined();
  });

  it("shows raw argument text while the input JSON is still partial", () => {
    render(
      <ToolCallView
        part={toolCall({ state: "input-streaming", arguments: '{"amo' })}
        defaultOpen
      />,
    );
    expect(screen.getByText('{"amo')).toBeDefined();
  });

  it("shows a pending indicator while the call is in flight", () => {
    const { container } = render(<ToolCallView part={toolCall({ state: "input-streaming" })} />);

    expect(container.querySelector('[data-status="pending"]')).not.toBeNull();
    expect(screen.getByText("running")).toBeDefined();
  });

  it("shows a pending indicator while the result is streaming", () => {
    const { container } = render(
      <ToolCallView part={toolCall()} result={toolResult({ state: "streaming" })} />,
    );

    expect(container.querySelector('[data-status="pending"]')).not.toBeNull();
    expect(screen.getByText("running")).toBeDefined();
  });

  it("settles to the normal appearance once complete", () => {
    const { container } = render(<ToolCallView part={toolCall()} result={toolResult()} />);

    expect(container.querySelector('[data-status="complete"]')).not.toBeNull();
    expect(screen.queryByText("running")).toBeNull();
  });

  it("marks the row as error and reveals the error detail on expand", () => {
    const { container } = render(
      <ToolCallView
        part={toolCall()}
        result={toolResult({ state: "error", error: "Category not found" })}
        defaultOpen
      />,
    );

    expect(container.querySelector('[data-status="error"]')).not.toBeNull();
    expect(screen.getByText("Error")).toBeDefined();
    expect(screen.getByText("Category not found")).toBeDefined();
  });

  it("expands on click to reveal the detail panel", () => {
    render(<ToolCallView part={toolCall()} result={toolResult()} />);

    expect(screen.queryByText("Arguments")).toBeNull();
    fireEvent.click(screen.getByText("create_transaction"));
    expect(screen.getByText("Arguments")).toBeDefined();
  });
});

describe("AssistantMessageParts", () => {
  it("interleaves text and tool-call parts in part order", () => {
    const { container } = render(
      <AssistantMessageParts
        parts={[
          textPart("Let me check your categories."),
          toolCall({ id: "call_a", name: "list_categories" }),
          textPart("Done, you have 3 categories."),
        ]}
      />,
    );

    const blocks = Array.from(container.children);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.textContent).toContain("Let me check your categories.");
    expect(blocks[1]?.textContent).toContain("list_categories");
    expect(blocks[2]?.textContent).toContain("Done, you have 3 categories.");
  });

  it("pairs each tool-call row with its own result by toolCallId", () => {
    const { container } = render(
      <AssistantMessageParts
        parts={[
          toolCall({ id: "call_a", name: "list_categories" }),
          toolCall({ id: "call_b", name: "create_transaction" }),
          toolResult({ toolCallId: "call_b", state: "error", error: "boom" }),
          toolResult({ toolCallId: "call_a", state: "complete" }),
        ]}
      />,
    );

    const rows = Array.from(container.querySelectorAll("[data-status]"));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.getAttribute("data-status")).toBe("complete");
    expect(rows[1]?.getAttribute("data-status")).toBe("error");
  });

  it("does not render tool-result parts as standalone blocks", () => {
    const { container } = render(
      <AssistantMessageParts
        parts={[toolCall({ id: "call_a" }), toolResult({ toolCallId: "call_a" })]}
      />,
    );

    expect(container.querySelectorAll("[data-status]")).toHaveLength(1);
  });

  it("merges consecutive text parts into a single message bubble", () => {
    const { container } = render(
      <AssistantMessageParts parts={[textPart("Hello "), textPart("world.")]} />,
    );

    expect(container.children).toHaveLength(1);
    expect(container.textContent).toContain("Hello world.");
  });
});
