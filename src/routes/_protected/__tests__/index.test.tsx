// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

let capturedPromptSubmit: ((text: string) => boolean) | undefined;
let capturedConversationSubmit: ((text: string) => boolean) | undefined;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, options: opts }),
  useNavigate: vi.fn(),
}));
vi.mock("@/contexts/chat-context", () => ({
  useChatContext: vi.fn(),
}));
vi.mock("@/components/chat-conversation", () => ({
  ChatConversation: ({ messages, onSubmit }: any) => {
    capturedConversationSubmit = onSubmit;
    return <div data-testid="conversation">{messages.length}</div>;
  },
}));
vi.mock("@/components/ui/prompt-input", () => ({
  PromptInput: {
    Root: ({ onSubmit }: any) => {
      capturedPromptSubmit = onSubmit;
      return <div data-testid="prompt" />;
    },
    Editor: () => <div />,
  },
}));

import { useNavigate } from "@tanstack/react-router";
import { useChatContext } from "@/contexts/chat-context";
import * as RouteMod from "@/routes/_protected/index";

const Route = RouteMod.Route as any;
const HomePage = Route.options.component;

function mockContext(overrides: Partial<ReturnType<typeof useChatContext>> = {}) {
  vi.mocked(useChatContext).mockReturnValue({
    messages: [],
    isLoading: false,
    error: undefined,
    addToolApprovalResponse: vi.fn(),
    startNewChat: vi.fn(),
    sendMessage: vi.fn(),
    resetChat: vi.fn(),
    ...overrides,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedPromptSubmit = undefined;
  capturedConversationSubmit = undefined;
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
});

afterEach(() => {
  cleanup();
});

describe("HomePage", () => {
  it("resets shared chat state on mount", () => {
    const resetChat = vi.fn();
    mockContext({ resetChat });
    render(<HomePage />);
    expect(resetChat).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state when there are no messages", () => {
    mockContext({ messages: [] });
    const { getByText, queryByTestId } = render(<HomePage />);
    expect(getByText("plata")).toBeDefined();
    expect(queryByTestId("conversation")).toBeNull();
  });

  it("renders the conversation view when messages already exist", () => {
    mockContext({ messages: [{ id: "m1" } as any] });
    const { getByTestId } = render(<HomePage />);
    expect(getByTestId("conversation")).toBeDefined();
  });
});

describe("HomePage handleSubmit (first message of a new chat)", () => {
  it("mints a session id, starts the chat, and navigates to /chat/:sessionId", () => {
    const startNewChat = vi.fn();
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    mockContext({ messages: [], isLoading: false, startNewChat });

    render(<HomePage />);
    const result = capturedPromptSubmit!("Categorize my Uber rides");

    expect(result).toBe(true);
    expect(startNewChat).toHaveBeenCalledTimes(1);
    const [text, sessionId] = startNewChat.mock.calls[0];
    expect(text).toBe("Categorize my Uber rides");
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(navigate).toHaveBeenCalledWith({
      to: "/chat/$sessionId",
      params: { sessionId },
    });
  });

  it("calls startNewChat before navigate, so the shared chat state reflects the send before the route changes", () => {
    const callOrder: string[] = [];
    const startNewChat = vi.fn(() => {
      callOrder.push("startNewChat");
    });
    const navigate = vi.fn(() => {
      callOrder.push("navigate");
    });
    vi.mocked(useNavigate).mockReturnValue(navigate as any);
    mockContext({ messages: [], startNewChat });

    render(<HomePage />);
    capturedPromptSubmit!("Hi");

    expect(callOrder).toEqual(["startNewChat", "navigate"]);
  });

  it("does not submit while a send is already in flight", () => {
    const startNewChat = vi.fn();
    mockContext({ messages: [], isLoading: true, startNewChat });

    render(<HomePage />);
    const result = capturedPromptSubmit!("Hi");

    expect(result).toBe(false);
    expect(startNewChat).not.toHaveBeenCalled();
  });

  it("forwards submits from the conversation view (messages already present) the same way", () => {
    const startNewChat = vi.fn();
    mockContext({ messages: [{ id: "m1" } as any], startNewChat });

    render(<HomePage />);
    capturedConversationSubmit!("More context");

    expect(startNewChat).toHaveBeenCalledWith("More context", expect.any(String));
  });
});
