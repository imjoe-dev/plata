// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

let capturedConversationSubmit: ((text: string) => boolean) | undefined;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({
    id: path,
    options: opts,
    useParams: () => ({ sessionId: "sess_1" }),
  }),
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

import { useChatContext } from "@/contexts/chat-context";
import * as RouteMod from "@/routes/_protected/chat.$sessionId";

const Route = RouteMod.Route as any;
const ChatSessionPage = Route.options.component;

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
  capturedConversationSubmit = undefined;
});

afterEach(() => {
  cleanup();
});

describe("ChatSessionPage", () => {
  it("renders the shared conversation view with the context's messages", () => {
    mockContext({ messages: [{ id: "m1" } as any, { id: "m2" } as any] });
    const { getByTestId } = render(<ChatSessionPage />);
    expect(getByTestId("conversation").textContent).toBe("2");
  });

  it("sends subsequent messages against this route's sessionId", () => {
    const sendMessage = vi.fn();
    mockContext({ messages: [{ id: "m1" } as any], sendMessage });

    render(<ChatSessionPage />);
    const result = capturedConversationSubmit!("Another message");

    expect(result).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith("Another message", "sess_1");
  });

  it("does not submit while a send is already in flight", () => {
    const sendMessage = vi.fn();
    mockContext({ messages: [{ id: "m1" } as any], isLoading: true, sendMessage });

    render(<ChatSessionPage />);
    const result = capturedConversationSubmit!("Another message");

    expect(result).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
