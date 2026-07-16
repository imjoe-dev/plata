// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";
import type { ToolCallPart } from "@tanstack/ai-client";
import type { ToolCall as ToolCallComponent } from "@/components/ui/tool-call";

vi.mock("@/components/ui/toast-manager", () => ({
  toastManager: { add: vi.fn() },
}));
vi.mock("@/components/ui/prompt-input", () => ({
  PromptInput: {
    Root: ({ children }: any) => <div>{children}</div>,
    Editor: () => <div />,
  },
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: {
    Root: ({ children }: any) => <div>{children}</div>,
    Viewport: ({ children }: any) => <div>{children}</div>,
    Content: ({ children }: any) => <div>{children}</div>,
    Scrollbar: ({ children }: any) => <div>{children}</div>,
    Thumb: () => <div />,
  },
}));
vi.mock("@/components/ui/chat-messages", () => ({
  ChatMessages: {
    List: ({ children }: any) => <div>{children}</div>,
    UserMessage: ({ children }: any) => <div>{children}</div>,
    AssistantMessage: ({ children }: any) => <div>{children}</div>,
  },
}));
vi.mock("@/components/ui/tool-call", () => ({
  ToolCall: {
    Root: ({
      children,
      onApprove,
      onDeny,
    }: React.ComponentProps<typeof ToolCallComponent.Root>) => (
      <div>
        <button onClick={onApprove}>approve</button>
        <button onClick={onDeny}>deny</button>
        {children}
      </div>
    ),
    Name: ({ children }: React.ComponentProps<typeof ToolCallComponent.Name>) => (
      <div>{children}</div>
    ),
    Content: ({ children }: React.ComponentProps<typeof ToolCallComponent.Content>) => (
      <div>{children}</div>
    ),
    Args: ({ children }: React.ComponentProps<typeof ToolCallComponent.Args>) => (
      <div>{children}</div>
    ),
    ApprovalActions: () => <div />,
    Response: ({ children }: React.ComponentProps<typeof ToolCallComponent.Response>) => (
      <div>{children}</div>
    ),
    DeniedNotice: ({ children }: React.ComponentProps<typeof ToolCallComponent.DeniedNotice>) => (
      <div>{children}</div>
    ),
    Error: ({ children }: React.ComponentProps<typeof ToolCallComponent.Error>) => (
      <div>{children}</div>
    ),
  },
}));

import { toastManager } from "@/components/ui/toast-manager";
import { ChatConversation } from "@/components/chat-conversation";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

function baseProps(overrides: Partial<Parameters<typeof ChatConversation>[0]> = {}) {
  return {
    messages: [],
    error: undefined,
    onSubmit: vi.fn(() => true),
    addToolApprovalResponse: vi.fn(),
    ...overrides,
  };
}

describe("ChatConversation error toast", () => {
  it("fires a toast when error is truthy", () => {
    render(<ChatConversation {...baseProps({ error: new Error("You're doing that too fast") })} />);
    expect(toastManager.add).toHaveBeenCalledTimes(1);
    expect(toastManager.add).toHaveBeenCalledWith({
      title: "You're doing that too fast",
      data: { variant: "error" },
    });
  });

  it("does not fire a toast when there is no error", () => {
    render(<ChatConversation {...baseProps()} />);
    expect(toastManager.add).not.toHaveBeenCalled();
  });

  it("does not fire a duplicate toast on an unrelated re-render with the same error", () => {
    const props = baseProps({ error: new Error("boom") });
    const { rerender } = render(<ChatConversation {...props} />);
    rerender(<ChatConversation {...props} />);
    expect(toastManager.add).toHaveBeenCalledTimes(1);
  });
});

describe("ChatConversation message rendering", () => {
  it("joins a user message's text parts with no separator", () => {
    const message = {
      id: "m1",
      role: "user",
      parts: [
        { type: "text", content: "Hello " },
        { type: "text", content: "world" },
      ],
    } as UIMessage;

    render(<ChatConversation {...baseProps({ messages: [message] })} />);

    expect(screen.getByText("Hello world")).toBeDefined();
  });
});

describe("ChatConversation tool-call approval", () => {
  function toolCallMessage(): UIMessage {
    const part: ToolCallPart = {
      type: "tool-call",
      id: "tc_1",
      name: "categorizeTransaction",
      arguments: "{}",
      state: "approval-requested",
      approval: { id: "appr_1", needsApproval: true },
    };
    return { id: "m1", role: "assistant", parts: [part] } as UIMessage;
  }

  it("sends the approval id with approved: true when the user approves", () => {
    const addToolApprovalResponse = vi.fn();
    render(
      <ChatConversation
        {...baseProps({ addToolApprovalResponse, messages: [toolCallMessage()] })}
      />,
    );

    fireEvent.click(screen.getByText("approve"));

    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_1", approved: true });
  });

  it("sends the approval id with approved: false when the user denies", () => {
    const addToolApprovalResponse = vi.fn();
    render(
      <ChatConversation
        {...baseProps({ addToolApprovalResponse, messages: [toolCallMessage()] })}
      />,
    );

    fireEvent.click(screen.getByText("deny"));

    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_1", approved: false });
  });
});
