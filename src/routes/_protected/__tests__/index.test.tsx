// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UIMessage } from "@tanstack/ai-react";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: unknown) => ({ id: path, options: opts }),
}));
vi.mock("@/contexts/chat-context", () => ({
  useChatContext: vi.fn(),
}));
vi.mock("@/components/chat", () => ({
  Chat: {
    Root: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="conversation">{children}</div>
    ),
    Scroll: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Viewport: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Messages: () => <div />,
    Composer: () => <div data-testid="composer" />,
  },
}));

import { useChatContext } from "@/contexts/chat-context";
import * as RouteMod from "@/routes/_protected/index";

const Route = RouteMod.Route as unknown as { options: { component: () => React.ReactNode } };
const HomePage = Route.options.component;

function mockContext(overrides: Partial<ReturnType<typeof useChatContext>> = {}) {
  vi.mocked(useChatContext).mockReturnValue({
    messages: [],
    isLoading: false,
    error: undefined,
    addToolApprovalResponse: vi.fn(),
    sessionId: "",
    submit: vi.fn(() => true),
    resetChat: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useChatContext>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("HomePage", () => {
  it("resets the chat on mount, so arriving at / — including via browser Back — starts fresh", () => {
    const resetChat = vi.fn();
    mockContext({ resetChat });

    render(<HomePage />);

    expect(resetChat).toHaveBeenCalledTimes(1);
  });

  it("shows the hero with a composer, and no conversation, before anything has been sent", () => {
    mockContext({ messages: [] });

    const { getByText, getByTestId, queryByTestId } = render(<HomePage />);

    expect(getByText("What would you like to know?")).toBeDefined();
    expect(getByTestId("composer")).toBeDefined();
    expect(queryByTestId("conversation")).toBeNull();
  });

  it("keeps the conversation on screen once a message exists, bridging the navigation gap", () => {
    mockContext({ messages: [{ id: "m1" } as UIMessage] });

    const { getByTestId } = render(<HomePage />);

    expect(getByTestId("conversation")).toBeDefined();
  });
});
