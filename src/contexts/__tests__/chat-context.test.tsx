// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

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

function mockChat(overrides: Partial<ReturnType<typeof usePlataChat>> = {}) {
  vi.mocked(usePlataChat).mockReturnValue({
    messages: [],
    sendMessage: vi.fn(),
    setMessages: vi.fn(),
    isLoading: false,
    error: undefined,
    addToolApprovalResponse: vi.fn(),
    ...overrides,
  } as any);
}

function mockQuery(overrides: Partial<ReturnType<typeof useQuery>> = {}) {
  vi.mocked(useQuery).mockReturnValue({
    data: undefined,
    isError: false,
    ...overrides,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedContext = undefined;
  vi.mocked(useNavigate).mockReturnValue(vi.fn());
  vi.mocked(useParams).mockReturnValue({} as any);
  mockQuery();
});

afterEach(() => {
  cleanup();
});

describe("ChatProvider hydration query", () => {
  it("does not query when no sessionId is present (on /)", () => {
    vi.mocked(useParams).mockReturnValue({} as any);
    mockChat();
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    const call = vi.mocked(useQuery).mock.calls[0][0] as any;
    expect(call.enabled).toBe(false);
  });

  it("enables the query for a sessionId that hasn't been loaded yet", () => {
    vi.mocked(useParams).mockReturnValue({ sessionId: "sess_1" } as any);
    mockChat();
    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    const call = vi.mocked(useQuery).mock.calls[0][0] as any;
    expect(call.queryKey).toEqual(["chat-session-messages", "sess_1"]);
    expect(call.enabled).toBe(true);
  });

  it("hydrates messages via setMessages when the query resolves", () => {
    const setMessages = vi.fn();
    vi.mocked(useParams).mockReturnValue({ sessionId: "sess_1" } as any);
    mockChat({ setMessages });
    mockQuery({ data: [{ id: "m1", role: "user", parts: [] }] as any });

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
    vi.mocked(useParams).mockReturnValue({ sessionId: "sess_1" } as any);
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
    vi.mocked(useParams).mockReturnValue({} as any);
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
    vi.mocked(useParams).mockReturnValue({} as any);
    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    capturedContext!.startNewChat("Hi", "new_sess");
    vi.mocked(useParams).mockReturnValue({ sessionId: "new_sess" } as any);
    rerender(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    const lastCall = vi.mocked(useQuery).mock.calls.at(-1)![0] as any;
    expect(lastCall.enabled).toBe(false);
  });

  it("preserves an in-flight message across the index-to-chat.$sessionId route swap, since ChatProvider itself never unmounts", () => {
    // Proves the same ChatProvider instance survives a route change, so an in-flight message
    // isn't dropped when the matched child swaps from `/` to chat.$sessionId.
    let messages: any[] = [];
    const sendMessage = vi.fn((content: string) => {
      messages = [...messages, { id: `m${messages.length}`, role: "user", parts: [{ content }] }];
    });
    vi.mocked(usePlataChat).mockImplementation(
      () =>
        ({
          get messages() {
            return messages;
          },
          sendMessage,
          setMessages: vi.fn((next: any[]) => {
            messages = next;
          }),
          isLoading: false,
          error: undefined,
          addToolApprovalResponse: vi.fn(),
        }) as any,
    );
    vi.mocked(useParams).mockReturnValue({} as any);

    const { rerender } = render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    capturedContext!.startNewChat("Categorize my Uber rides", "new_sess");

    // The route swap to /chat/new_sess: same ChatProvider, matched child's params change.
    vi.mocked(useParams).mockReturnValue({ sessionId: "new_sess" } as any);
    rerender(
      <ChatProvider>
        <Consumer />
      </ChatProvider>,
    );

    expect(capturedContext!.messages).toHaveLength(1);
    expect((capturedContext!.messages[0].parts[0] as any).content).toBe("Categorize my Uber rides");
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
