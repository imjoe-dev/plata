// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));
vi.mock("@/hooks/use-plata-chat", () => ({
  usePlataChat: vi.fn(),
}));
vi.mock("@/components/ui/toast-manager", () => ({
  toastManager: { add: vi.fn() },
}));
vi.mock("@/lib/ai/fetch", () => ({
  apiGet: vi.fn(),
}));

import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlataChat } from "@/hooks/use-plata-chat";
import { mockPlataChat } from "@/hooks/__tests__/mock-plata-chat";
import { toastManager } from "@/components/ui/toast-manager";
import { ChatProvider, useChatContext } from "@/contexts/chat-context";

let capturedContext: ReturnType<typeof useChatContext> | undefined;

function Consumer() {
  capturedContext = useChatContext();
  return null;
}

// useParams' real type is generic over the app's route tree; narrowed to what ChatProvider reads.
type MockParams = { sessionId?: string };

function mockChat(overrides: Partial<ReturnType<typeof usePlataChat>> = {}) {
  vi.mocked(usePlataChat).mockReturnValue(mockPlataChat(overrides));
}

/** A sendMessage mock typed against the real signature, so the id read back off it is a string. */
function mockSendMessage() {
  return vi.fn<ReturnType<typeof usePlataChat>["sendMessage"]>(() => Promise.resolve());
}

/** The (text, sessionId) the provider last sent, asserted present before it's destructured. */
function lastSend(sendMessage: ReturnType<typeof mockSendMessage>) {
  const lastCall = sendMessage.mock.lastCall;
  expect(lastCall).toBeDefined();
  return lastCall!;
}

// useQuery's real return type is a large discriminated union; narrowed to what ChatProvider reads.
type MockQueryResult = { data: UIMessage[] | undefined; isError: boolean };

function mockQuery(overrides: Partial<MockQueryResult> = {}) {
  const result: MockQueryResult = { data: undefined, isError: false, ...overrides };
  vi.mocked(useQuery).mockReturnValue(result as ReturnType<typeof useQuery>);
}

// The query client's real type is the full QueryClient class; narrowed to what ChatProvider calls.
function mockQueryClient() {
  const invalidateQueries = vi.fn();
  vi.mocked(useQueryClient).mockReturnValue({
    invalidateQueries,
  } as unknown as ReturnType<typeof useQueryClient>);
  return invalidateQueries;
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedContext = undefined;
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
  vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
  mockQuery();
  mockQueryClient();
});

afterEach(() => {
  cleanup();
});

describe("ChatProvider hydration query", () => {
  it("does not query when no sessionId is present (on /)", () => {
    vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
    mockChat();
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    const lastCall = vi.mocked(useQuery).mock.lastCall;
    expect(lastCall).toBeDefined();
    const [options] = lastCall!;
    expect(options.enabled).toBe(false);
  });

  it("enables the query for a sessionId that hasn't been loaded yet", () => {
    vi.mocked(useParams).mockReturnValue({
      sessionId: "sess_1",
    } as MockParams as ReturnType<typeof useParams>);
    mockChat();
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    const lastCall = vi.mocked(useQuery).mock.lastCall;
    expect(lastCall).toBeDefined();
    const [options] = lastCall!;
    expect(options.queryKey).toEqual(["chat-session-messages", "sess_1"]);
    expect(options.enabled).toBe(true);
  });

  it("hydrates messages via setMessages when the query resolves", () => {
    const setMessages = vi.fn();
    vi.mocked(useParams).mockReturnValue({
      sessionId: "sess_1",
    } as MockParams as ReturnType<typeof useParams>);
    mockChat({ setMessages });
    mockQuery({ data: [{ id: "m1", role: "user", parts: [] } as UIMessage] });

    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(setMessages).toHaveBeenCalledWith([{ id: "m1", role: "user", parts: [] }]);
  });

  it("shows a toast and redirects to / when the session fetch fails", () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useParams).mockReturnValue({
      sessionId: "sess_1",
    } as MockParams as ReturnType<typeof useParams>);
    mockChat();
    mockQuery({ isError: true });

    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(toastManager.add).toHaveBeenCalledWith({
      title: "Chat not found",
      data: { variant: "error" },
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("does not query or error-redirect when there's no sessionId at all", () => {
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
    mockChat();
    mockQuery({ isError: true }); // even if the (disabled) query object reports an error

    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(toastManager.add).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("ChatProvider submit — first message of a new Chat Session", () => {
  it("mints a Chat Session id, sends against it, and navigates to that Chat Session", () => {
    const sendMessage = mockSendMessage();
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    mockChat({ sendMessage });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    let accepted: boolean | undefined;
    act(() => {
      accepted = capturedContext!.submit("Categorize my Uber rides");
    });

    expect(accepted).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [text, sessionId] = lastSend(sendMessage);
    expect(text).toBe("Categorize my Uber rides");
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(navigate).toHaveBeenCalledWith({
      to: "/chat/$sessionId",
      params: { sessionId },
    });
  });

  it("starts the send before navigating, so chat state reflects it before the route changes", () => {
    const callOrder: string[] = [];
    const sendMessage = vi.fn(() => {
      callOrder.push("sendMessage");
      return Promise.resolve();
    });
    const navigate = vi.fn(() => {
      callOrder.push("navigate");
      return Promise.resolve();
    });
    vi.mocked(useNavigate).mockReturnValue(navigate);
    mockChat({ sendMessage });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    act(() => {
      capturedContext!.submit("Hi");
    });

    expect(callOrder).toEqual(["sendMessage", "navigate"]);
  });

  it("marks a Chat Session started via submit as already loaded, skipping its GET hydration", () => {
    const sendMessage = mockSendMessage();
    mockChat({ sendMessage });
    vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    act(() => {
      capturedContext!.submit("Hi");
    });
    const [, mintedId] = lastSend(sendMessage);
    vi.mocked(useParams).mockReturnValue({
      sessionId: mintedId,
    } as MockParams as ReturnType<typeof useParams>);
    rerender(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    const lastCall = vi.mocked(useQuery).mock.lastCall;
    expect(lastCall).toBeDefined();
    const [options] = lastCall!;
    expect(options.enabled).toBe(false);
  });

  it("exposes the minted id as the Chat Session in view until the route param catches up", () => {
    const sendMessage = mockSendMessage();
    mockChat({ sendMessage });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    act(() => {
      capturedContext!.submit("Hi");
    });

    const [, mintedId] = lastSend(sendMessage);
    expect(capturedContext!.sessionId).toBe(mintedId);
  });

  it("has no Chat Session in view before anything has been sent", () => {
    mockChat();
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(capturedContext!.sessionId).toBe("");
  });

  it("preserves an in-flight message across the index-to-chat.$sessionId route swap, since ChatProvider itself never unmounts", () => {
    let messages: UIMessage[] = [];
    let mintedId: string | undefined;
    const sendMessage = vi.fn((content: string, sessionId?: string) => {
      mintedId = sessionId;
      messages = [
        ...messages,
        {
          id: `m${messages.length}`,
          role: "user",
          parts: [{ type: "text", content }],
        } as UIMessage,
      ];
      return Promise.resolve();
    });
    vi.mocked(usePlataChat).mockImplementation(
      (): ReturnType<typeof usePlataChat> => ({
        get messages() {
          return messages;
        },
        sendMessage,
        append: vi.fn(),
        addToolResult: vi.fn(),
        addToolApprovalResponse: vi.fn(),
        reload: vi.fn(),
        stop: vi.fn(),
        isLoading: false,
        error: undefined,
        status: "ready",
        isSubscribed: false,
        connectionStatus: "disconnected",
        sessionGenerating: false,
        setMessages: vi.fn((next: UIMessage[]) => {
          messages = next;
        }),
        clear: vi.fn(),
      }),
    );
    vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);

    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    act(() => {
      capturedContext!.submit("Categorize my Uber rides");
    });

    vi.mocked(useParams).mockReturnValue({
      sessionId: mintedId,
    } as MockParams as ReturnType<typeof useParams>);
    rerender(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(capturedContext!.messages).toHaveLength(1);
    const [firstPart] = capturedContext!.messages[0].parts;
    expect(firstPart.type === "text" ? firstPart.content : undefined).toBe(
      "Categorize my Uber rides",
    );
  });
});

describe("ChatProvider submit — an existing Chat Session", () => {
  it("sends against the route's Chat Session and does not navigate", () => {
    const sendMessage = mockSendMessage();
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useParams).mockReturnValue({
      sessionId: "sess_1",
    } as MockParams as ReturnType<typeof useParams>);
    mockChat({ sendMessage });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    let accepted: boolean | undefined;
    act(() => {
      accepted = capturedContext!.submit("More");
    });

    expect(accepted).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith("More", "sess_1");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("prefers the route's Chat Session id as the session in view", () => {
    vi.mocked(useParams).mockReturnValue({
      sessionId: "sess_1",
    } as MockParams as ReturnType<typeof useParams>);
    mockChat();
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(capturedContext!.sessionId).toBe("sess_1");
  });
});

describe("ChatProvider submit — in-flight guard", () => {
  it("refuses to start a new Chat Session while a send is already in flight", () => {
    const sendMessage = mockSendMessage();
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    mockChat({ sendMessage, isLoading: true });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    let accepted: boolean | undefined;
    act(() => {
      accepted = capturedContext!.submit("Hi");
    });

    expect(accepted).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("refuses to send into an existing Chat Session while a send is already in flight", () => {
    const sendMessage = mockSendMessage();
    vi.mocked(useParams).mockReturnValue({
      sessionId: "sess_1",
    } as MockParams as ReturnType<typeof useParams>);
    mockChat({ sendMessage, isLoading: true });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    let accepted: boolean | undefined;
    act(() => {
      accepted = capturedContext!.submit("Hi");
    });

    expect(accepted).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("ChatProvider resetChat", () => {
  it("clears messages", () => {
    const setMessages = vi.fn();
    mockChat({ setMessages });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    act(() => {
      capturedContext!.resetChat();
    });

    expect(setMessages).toHaveBeenCalledWith([]);
  });

  it("drops the minted id, so a later Session Approval can't land on the abandoned Chat Session", () => {
    const sendMessage = mockSendMessage();
    mockChat({ sendMessage });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    act(() => {
      capturedContext!.submit("Hi");
    });
    expect(capturedContext!.sessionId).not.toBe("");

    act(() => {
      capturedContext!.resetChat();
    });

    expect(capturedContext!.sessionId).toBe("");
  });

  it("mints a fresh id for the next chat rather than reusing the cleared one", () => {
    const sendMessage = mockSendMessage();
    mockChat({ sendMessage });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    act(() => {
      capturedContext!.submit("First");
    });
    const [, firstId] = lastSend(sendMessage);

    act(() => {
      capturedContext!.resetChat();
    });
    act(() => {
      capturedContext!.submit("Second");
    });
    const [, secondId] = lastSend(sendMessage);

    expect(secondId).not.toBe(firstId);
    expect(secondId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("ChatProvider error toast", () => {
  it("raises a toast carrying the error's own message", () => {
    mockChat({ error: new Error("You're doing that too fast") });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(toastManager.add).toHaveBeenCalledTimes(1);
    expect(toastManager.add).toHaveBeenCalledWith({
      title: "You're doing that too fast",
      data: { variant: "error" },
    });
  });

  it("falls back to a generic message when the error carries none", () => {
    mockChat({ error: new Error("") });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(toastManager.add).toHaveBeenCalledWith({
      title: "Something went wrong. Please try again.",
      data: { variant: "error" },
    });
  });

  it("raises nothing when there is no error", () => {
    mockChat();
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(toastManager.add).not.toHaveBeenCalled();
  });

  it("does not repeat the toast on an unrelated re-render with the same error", () => {
    const error = new Error("boom");
    mockChat({ error });
    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    mockChat({ error });
    rerender(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(toastManager.add).toHaveBeenCalledTimes(1);
  });
});

describe("ChatProvider History freshness", () => {
  it("invalidates History (the chat-sessions query) when a send completes — loading to idle", () => {
    const invalidateQueries = mockQueryClient();
    mockChat({ isLoading: true });
    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(invalidateQueries).not.toHaveBeenCalled();

    mockChat({ isLoading: false });
    rerender(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["chat-sessions"] });
  });

  it("does not invalidate History on mount or at send start — idle to loading", () => {
    const invalidateQueries = mockQueryClient();
    mockChat({ isLoading: false });
    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    // Mount (idle): no invalidation.
    expect(invalidateQueries).not.toHaveBeenCalled();

    // Send starts (idle → loading): still no invalidation — the session row isn't committed yet.
    mockChat({ isLoading: true });
    rerender(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("does not invalidate History on re-renders while a send is still streaming", () => {
    const invalidateQueries = mockQueryClient();
    mockChat({ isLoading: true });
    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    mockChat({ isLoading: true });
    rerender(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
