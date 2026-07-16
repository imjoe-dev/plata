// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
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
import { ChatProvider } from "@/contexts/chat-context";
import { Sidebar } from "@/components/ui/sidebar";

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
  vi.mocked(useQuery).mockReturnValue({
    data: undefined,
    isError: false,
  } as ReturnType<typeof useQuery>);
});

afterEach(() => {
  cleanup();
});

describe("Sidebar.NewChat", () => {
  it("resets the chat and navigates to the landing route when clicked", () => {
    const setMessages = vi.fn();
    const navigate = vi.fn();
    mockChat({ setMessages });
    vi.mocked(useNavigate).mockReturnValue(navigate);

    const { getByText } = render(
      <ChatProvider>
        <Sidebar.NewChat />
      </ChatProvider>,
    );
    fireEvent.click(getByText("New Chat"));

    // resetChat() clears messages via the real ChatProvider (not a bare mock) — this is what
    // makes the click work identically whether or not the user is already on the landing route,
    // since the handler never inspects current location, only ever clears state and navigates.
    expect(setMessages).toHaveBeenCalledWith([]);
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});
