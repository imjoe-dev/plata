// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

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
    Root: ({ children }: any) => <div>{children}</div>,
    Name: ({ children }: any) => <div>{children}</div>,
    Content: ({ children }: any) => <div>{children}</div>,
    Args: ({ children }: any) => <div>{children}</div>,
    ApprovalActions: () => <div />,
    Response: ({ children }: any) => <div>{children}</div>,
    DeniedNotice: ({ children }: any) => <div>{children}</div>,
    Error: ({ children }: any) => <div>{children}</div>,
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
