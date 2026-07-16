// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/ai-react", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/ai-react")>("@tanstack/ai-react");
  return {
    ...actual,
    useChat: vi.fn((options: any) => ({
      messages: [],
      sendMessage: vi.fn(),
      isLoading: false,
      error: undefined,
      addToolApprovalResponse: vi.fn(),
      __options: options,
    })),
  };
});

import { useChat } from "@tanstack/ai-react";
import { plataChatOptions, usePlataChat } from "@/hooks/use-plata-chat";

describe("plataChatOptions", () => {
  it("configures no client-side tool set (categories, transactions, and recurring templates all execute server-side)", () => {
    expect(plataChatOptions.tools).toBeUndefined();
  });

  it("forwards the model_id prop", () => {
    expect(plataChatOptions.forwardedProps).toEqual({ model_id: "gpt-5.4-mini" });
  });

  it("targets /api/chat", () => {
    expect(plataChatOptions.connection).toBeDefined();
  });
});

describe("usePlataChat sendMessage", () => {
  it("passes forwardedProps as a stable, mutable ref object to useChat", () => {
    const { result } = renderHook(() => usePlataChat());
    const options = vi.mocked(useChat).mock.calls.at(-1)![0] as any;
    expect(options.forwardedProps).toEqual({ model_id: "gpt-5.4-mini" });
    void result;
  });

  it("mutates the same forwardedProps object's session_id in place before sending, rather than replacing it", () => {
    const { result } = renderHook(() => usePlataChat());
    const options = vi.mocked(useChat).mock.calls.at(-1)![0] as any;
    const forwardedPropsRef = options.forwardedProps;

    void result.current.sendMessage("Categorize my Uber rides", "sess_new");

    // Same object reference, mutated — this is what makes the update visible immediately,
    // even if sendMessage is called in the same synchronous tick as minting the session id,
    // with no React re-render in between.
    expect(options.forwardedProps).toBe(forwardedPropsRef);
    expect(forwardedPropsRef.session_id).toBe("sess_new");
    expect(forwardedPropsRef.model_id).toBe("gpt-5.4-mini");
  });

  it("calls the underlying single-argument sendMessage with just the content", () => {
    const { result } = renderHook(() => usePlataChat());
    const underlyingChat = vi.mocked(useChat).mock.results.at(-1)!.value;

    void result.current.sendMessage("Hi", "sess_1");

    expect(underlyingChat.sendMessage).toHaveBeenCalledWith("Hi");
    expect(underlyingChat.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does not touch session_id when no sessionId is passed", () => {
    const { result } = renderHook(() => usePlataChat());
    const options = vi.mocked(useChat).mock.calls.at(-1)![0] as any;

    void result.current.sendMessage("Hi");

    expect(options.forwardedProps.session_id).toBeUndefined();
  });
});
