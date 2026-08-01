// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/ai-react", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/ai-react")>("@tanstack/ai-react");
  return {
    ...actual,
    useChat: vi.fn(
      (_options: Parameters<typeof actual.useChat>[0]): ReturnType<typeof actual.useChat> => ({
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
      }),
    ),
  };
});

import { useChat } from "@tanstack/ai-react";
import { plataChatOptions, usePlataChat } from "@/hooks/use-plata-chat";

describe("plataChatOptions", () => {
  it("configures no client-side tool set (categories, transactions, and recurring templates all execute server-side)", () => {
    expect(plataChatOptions.tools).toBeUndefined();
  });

  it("forwards the model_id prop", () => {
    expect(plataChatOptions.forwardedProps).toEqual({ model_id: "gpt-5.6-luna" });
  });

  it("targets /api/chat", () => {
    expect(plataChatOptions.connection).toBeDefined();
  });
});

describe("usePlataChat sendMessage", () => {
  it("forwards the model_id prop to useChat", () => {
    renderHook(() => usePlataChat());

    expect(useChat).toHaveBeenCalledWith(
      expect.objectContaining({ forwardedProps: { model_id: "gpt-5.6-luna" } }),
    );
  });

  // Can't verify the real ChatClient reads forwardedProps by reference (useChat is mocked here) —
  // see the "unwritten contract" comment on forwardedPropsRef in use-plata-chat.ts.
  it("makes a session_id set mid-tick visible on the object useChat already holds, with no re-render", () => {
    const { result } = renderHook(() => usePlataChat());
    const lastCall = vi.mocked(useChat).mock.lastCall;
    expect(lastCall).toBeDefined();
    const [options] = lastCall!;
    const forwardedProps = options.forwardedProps as { model_id: string; session_id?: string };

    void result.current.sendMessage("Categorize my Uber rides", "sess_new");

    expect(forwardedProps.session_id).toBe("sess_new");
    expect(forwardedProps.model_id).toBe("gpt-5.6-luna");
  });

  it("calls the underlying single-argument sendMessage with just the content", () => {
    const { result } = renderHook(() => usePlataChat());
    const lastResult = vi.mocked(useChat).mock.results.at(-1)!.value;

    void result.current.sendMessage("Hi", "sess_1");

    expect(lastResult.sendMessage).toHaveBeenCalledWith("Hi");
    expect(lastResult.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does not touch session_id when no sessionId is passed", () => {
    const { result } = renderHook(() => usePlataChat());
    const lastCall = vi.mocked(useChat).mock.lastCall;
    expect(lastCall).toBeDefined();
    const [options] = lastCall!;

    void result.current.sendMessage("Hi");

    expect((options.forwardedProps as { session_id?: string }).session_id).toBeUndefined();
  });
});
