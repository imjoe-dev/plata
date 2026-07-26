// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";
import type { ToolCallPart } from "@tanstack/ai-client";
import type { ToolCall as ToolCallComponent } from "@/components/ui/tool-call";

vi.mock("@/components/ui/toast-manager", () => ({
  toastManager: { add: vi.fn() },
}));
vi.mock("@/lib/ai/fetch", () => ({
  apiPost: vi.fn().mockResolvedValue(undefined),
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
      onApproveForSession,
    }: React.ComponentProps<typeof ToolCallComponent.Root>) => (
      <div>
        <button onClick={onApprove}>approve</button>
        <button onClick={onDeny}>deny</button>
        {onApproveForSession && <button onClick={onApproveForSession}>approve for session</button>}
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
import { apiPost } from "@/lib/ai/fetch";
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
    sessionId: "sess_1",
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

describe("ChatConversation Session Approval (docs/adr/0006)", () => {
  function toolCallPart(opts: { id?: string; name?: string; approvalId?: string }): ToolCallPart {
    return {
      type: "tool-call",
      id: opts.id ?? "tc",
      name: opts.name ?? "create_transaction",
      arguments: "{}",
      state: "approval-requested",
      approval: { id: opts.approvalId ?? "appr", needsApproval: true },
    } as ToolCallPart;
  }

  it("shows the third action on a non-delete mutating tool call", () => {
    const message = { id: "m1", role: "assistant", parts: [toolCallPart({})] } as UIMessage;
    render(<ChatConversation {...baseProps({ messages: [message] })} />);

    expect(screen.getByText("approve for session")).toBeDefined();
  });

  it("omits the third action entirely on a delete tool call", () => {
    const part = toolCallPart({ name: "delete_transaction", approvalId: "appr_del" });
    const message = { id: "m1", role: "assistant", parts: [part] } as UIMessage;
    render(<ChatConversation {...baseProps({ messages: [message] })} />);

    expect(screen.queryByText("approve for session")).toBeNull();
  });

  it("approves the clicked call and grants Session Approval on the Chat Session when clicked", () => {
    const addToolApprovalResponse = vi.fn();
    const part = toolCallPart({ approvalId: "appr_1" });
    const message = { id: "m1", role: "assistant", parts: [part] } as UIMessage;
    render(
      <ChatConversation
        {...baseProps({ addToolApprovalResponse, sessionId: "sess_42", messages: [message] })}
      />,
    );

    fireEvent.click(screen.getByText("approve for session"));

    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_1", approved: true });
    expect(apiPost).toHaveBeenCalledWith("/api/chat/sessions/sess_42/approve-mutations");
  });

  it("does not double-respond to the just-clicked call once the same-turn bridge re-scans it", () => {
    const addToolApprovalResponse = vi.fn();
    const part = toolCallPart({ approvalId: "appr_1" });
    const message = { id: "m1", role: "assistant", parts: [part] } as UIMessage;
    render(<ChatConversation {...baseProps({ addToolApprovalResponse, messages: [message] })} />);

    fireEvent.click(screen.getByText("approve for session"));

    expect(addToolApprovalResponse).toHaveBeenCalledTimes(1);
  });

  it("auto-resolves a further non-delete pending call in the same reply once granted", () => {
    const addToolApprovalResponse = vi.fn();
    const partA = toolCallPart({ id: "tc_a", approvalId: "appr_a" });
    const partB = toolCallPart({ id: "tc_b", approvalId: "appr_b" });
    const message = { id: "m1", role: "assistant", parts: [partA, partB] } as UIMessage;
    render(<ChatConversation {...baseProps({ addToolApprovalResponse, messages: [message] })} />);

    fireEvent.click(screen.getAllByText("approve for session")[0]);

    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_a", approved: true });
    expect(addToolApprovalResponse).toHaveBeenCalledWith({ id: "appr_b", approved: true });
  });

  it("still requires an individual prompt for a delete call in the same reply, even after granting", () => {
    const addToolApprovalResponse = vi.fn();
    const nonDelete = toolCallPart({ id: "tc_a", approvalId: "appr_a" });
    const deleteCall = toolCallPart({
      id: "tc_del",
      name: "delete_transaction",
      approvalId: "appr_del",
    });
    const message = { id: "m1", role: "assistant", parts: [nonDelete, deleteCall] } as UIMessage;
    render(<ChatConversation {...baseProps({ addToolApprovalResponse, messages: [message] })} />);

    fireEvent.click(screen.getByText("approve for session"));

    expect(addToolApprovalResponse).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "appr_del" }),
    );
  });
});
