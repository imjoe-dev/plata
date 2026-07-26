// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";

vi.mock("@/components/ui/toast-manager", () => ({
  toastManager: { add: vi.fn() },
}));
vi.mock("@/contexts/tool-approval-context", () => ({
  useToolApproval: () => ({
    state: { approvedMessageIds: new Set<string>() },
    actions: { forPart: () => ({ approve: vi.fn(), deny: vi.fn() }) },
  }),
}));
vi.mock("@/components/ui/prompt-input", () => ({
  PromptInput: {
    Root: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Editor: () => <div />,
  },
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: {
    Root: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Viewport: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Content: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Scrollbar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Thumb: () => <div />,
  },
}));
vi.mock("@/components/ui/chat-messages", () => ({
  ChatMessages: {
    List: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    UserMessage: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    AssistantMessage: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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
