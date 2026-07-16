// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
  useParams: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
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
import { useQuery } from "@tanstack/react-query";
import { usePlataChat } from "@/hooks/use-plata-chat";
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
  vi.mocked(usePlataChat).mockReturnValue({
    messages: [],
    sendMessage: vi.fn(),
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
    setMessages: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  });
}

// useQuery's real return type is a large discriminated union; narrowed to what ChatProvider reads.
type MockQueryResult = { data: UIMessage[] | undefined; isError: boolean };

function mockQuery(overrides: Partial<MockQueryResult> = {}) {
  const result: MockQueryResult = { data: undefined, isError: false, ...overrides };
  vi.mocked(useQuery).mockReturnValue(result as ReturnType<typeof useQuery>);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedContext = undefined;
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
  vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
  mockQuery();
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

describe("ChatProvider actions", () => {
  it("startNewChat sends the message with the new session id", () => {
    const sendMessage = vi.fn();
    mockChat({ sendMessage });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    capturedContext!.startNewChat("Hi", "new_sess");

    expect(sendMessage).toHaveBeenCalledWith("Hi", "new_sess");
  });

  it("marks a session started via startNewChat as already loaded, skipping its GET hydration", () => {
    mockChat();
    vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    capturedContext!.startNewChat("Hi", "new_sess");
    vi.mocked(useParams).mockReturnValue({
      sessionId: "new_sess",
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

  it("preserves an in-flight message across the index-to-chat.$sessionId route swap, since ChatProvider itself never unmounts", () => {
    let messages: UIMessage[] = [];
    const sendMessage = vi.fn((content: string) => {
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

    capturedContext!.startNewChat("Categorize my Uber rides", "new_sess");

    vi.mocked(useParams).mockReturnValue({
      sessionId: "new_sess",
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

  it("sendMessage sends against the given (already-hydrated) session id", () => {
    const sendMessage = vi.fn();
    mockChat({ sendMessage });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    capturedContext!.sendMessage("More", "sess_1");

    expect(sendMessage).toHaveBeenCalledWith("More", "sess_1");
  });

  it("resetChat clears messages", () => {
    const setMessages = vi.fn();
    mockChat({ setMessages });
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    capturedContext!.resetChat();

    expect(setMessages).toHaveBeenCalledWith([]);
  });
});
