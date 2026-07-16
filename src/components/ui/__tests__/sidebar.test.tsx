// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
}));
vi.mock("@/contexts/chat-context", () => ({
  useChatContext: vi.fn(),
}));

import { useNavigate } from "@tanstack/react-router";
import { useChatContext } from "@/contexts/chat-context";
import { Sidebar } from "@/components/ui/sidebar";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Sidebar.NewChat", () => {
  it("resets the chat and navigates to the landing route when clicked", () => {
    const resetChat = vi.fn();
    const navigate = vi.fn();
    vi.mocked(useChatContext).mockReturnValue({ resetChat } as unknown as ReturnType<
      typeof useChatContext
    >);
    vi.mocked(useNavigate).mockReturnValue(navigate);

    const { getByText } = render(<Sidebar.NewChat />);
    fireEvent.click(getByText("New Chat"));

    expect(resetChat).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("resets the chat even when already on the landing route", () => {
    const resetChat = vi.fn();
    const navigate = vi.fn();
    vi.mocked(useChatContext).mockReturnValue({ resetChat } as unknown as ReturnType<
      typeof useChatContext
    >);
    vi.mocked(useNavigate).mockReturnValue(navigate);

    const { getByText } = render(<Sidebar.NewChat />);
    fireEvent.click(getByText("New Chat"));
    fireEvent.click(getByText("New Chat"));

    expect(resetChat).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
