import { vi } from "vite-plus/test";
import type { usePlataChat } from "@/hooks/use-plata-chat";

export function mockPlataChat(overrides: Partial<ReturnType<typeof usePlataChat>> = {}) {
  return {
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
  } as ReturnType<typeof usePlataChat>;
}
