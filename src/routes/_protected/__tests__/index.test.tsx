// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({ id: path, options: opts }),
}));
vi.mock("@/hooks/use-plata-chat", () => ({
  usePlataChat: vi.fn(),
}));
vi.mock("@/components/ui/toast-manager", () => ({
  toastManager: { add: vi.fn() },
}));
vi.mock("@/components/ui/prompt-input", () => ({
  PromptInput: {
    Root: ({ children }: any) => <div>{children}</div>,
    Editor: () => <div />,
  },
}));

import { usePlataChat } from "@/hooks/use-plata-chat";
import { toastManager } from "@/components/ui/toast-manager";
import * as RouteMod from "@/routes/_protected/index";

const Route = RouteMod.Route as any;
const HomePage = Route.options.component;

beforeEach(() => {
  vi.clearAllMocks();
});

function mockChat(overrides: Partial<ReturnType<typeof usePlataChat>> = {}) {
  vi.mocked(usePlataChat).mockReturnValue({
    messages: [],
    sendMessage: vi.fn(),
    isLoading: false,
    error: undefined,
    addToolApprovalResponse: vi.fn(),
    ...overrides,
  } as any);
}

describe("HomePage chat error toast", () => {
  it("fires a toast when usePlataChat() reports a truthy error", () => {
    mockChat({ error: new Error("You're doing that too fast") });
    render(<HomePage />);
    expect(toastManager.add).toHaveBeenCalledTimes(1);
    expect(toastManager.add).toHaveBeenCalledWith({
      title: "You're doing that too fast",
      data: { variant: "error" },
    });
  });

  it("does not fire a toast when there is no error", () => {
    mockChat({ error: undefined });
    render(<HomePage />);
    expect(toastManager.add).not.toHaveBeenCalled();
  });

  it("does not fire a duplicate toast on an unrelated re-render with the same error", () => {
    mockChat({ error: new Error("boom") });
    const { rerender } = render(<HomePage />);
    rerender(<HomePage />);
    expect(toastManager.add).toHaveBeenCalledTimes(1);
  });
});
