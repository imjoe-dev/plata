// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({
    id: path,
    options: opts,
    useRouteContext: vi.fn(),
  }),
  redirect: vi.fn(),
  Outlet: () => null,
  // Resolves the route pattern to a plain href so History items render as real anchors.
  Link: ({ to, params, ...props }: any) => {
    let href: string = to;
    for (const [key, value] of Object.entries(params ?? {})) {
      href = href.replace(`$${key}`, String(value));
    }
    return <a href={href} {...props} />;
  },
  useNavigate: vi.fn(),
  useParams: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useInfiniteQuery: vi.fn(),
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
vi.mock("@/lib/auth/functions", () => ({
  getSession: vi.fn(),
}));
vi.mock("@/lib/auth/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/client")>("@/lib/auth/client");
  return {
    authClient: {
      ...actual.authClient,
      signOut: vi.fn(),
    },
  };
});

import { useNavigate, useParams } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { usePlataChat } from "@/hooks/use-plata-chat";
import { mockPlataChat } from "@/hooks/__tests__/mock-plata-chat";
import { apiGet } from "@/lib/ai/fetch";
import { toastManager } from "@/components/ui/toast-manager";
import { authClient } from "@/lib/auth/client";
import * as RouteMod from "@/routes/_protected/route";

const Route = RouteMod.Route as any;
const ProtectedLayout = Route.options.component;

type MockParams = { sessionId?: string };

function mockChat(overrides: Partial<ReturnType<typeof usePlataChat>> = {}) {
  vi.mocked(usePlataChat).mockReturnValue(mockPlataChat(overrides));
}

// beforeLoad's session (fetched server-side via getSession()) reaches the component through
// route context; narrowed here to just the fields ProtectedLayoutContent actually reads.
type MockUser = { name: string; email: string; image: string | null };

function mockSession(user: Partial<MockUser> = {}) {
  vi.mocked(Route.useRouteContext).mockReturnValue({
    session: { user: { name: "Jose Ariza", email: "jose@example.com", image: null, ...user } },
  });
}

// useInfiniteQuery's real return type is a large discriminated union; narrowed to what
// useChatSessions reads. `updated_at` arrives as an ISO string over the wire.
type MockSessionItem = { id: string; title: string; updated_at: string };
type MockSessionsPage = { items: MockSessionItem[]; next_cursor: string | null };
type MockSessionsResult = {
  data: { pages: MockSessionsPage[]; pageParams: unknown[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
};

function mockChatSessions(overrides: Partial<MockSessionsResult> = {}) {
  const result: MockSessionsResult = {
    data: undefined,
    isLoading: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    ...overrides,
  };
  vi.mocked(useInfiniteQuery).mockReturnValue(
    result as unknown as ReturnType<typeof useInfiniteQuery>,
  );
}

function sessionsPage(items: MockSessionItem[]): MockSessionsResult["data"] {
  return { pages: [{ items, next_cursor: null }], pageParams: [null] };
}

// authClient.signOut()'s real (generic) signature resists Parameters<> extraction;
// narrowed here to just the shape ProtectedLayoutContent actually passes.
type MockSignOutOptions = { fetchOptions?: { onSuccess?: () => void } };

function mockSignOut() {
  const signOut = vi.fn((options?: MockSignOutOptions) => {
    options?.fetchOptions?.onSuccess?.();
    return Promise.resolve() as unknown as ReturnType<typeof authClient.signOut>;
  });
  vi.mocked(authClient.signOut).mockImplementation(signOut as unknown as typeof authClient.signOut);
  return signOut;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
  vi.mocked(useQuery).mockReturnValue({
    data: undefined,
    isError: false,
  } as ReturnType<typeof useQuery>);
  mockChat();
  mockSession();
  mockChatSessions();
});

afterEach(() => {
  cleanup();
});

describe("ProtectedLayout New Chat wiring", () => {
  it("resets the chat and navigates to the landing route when clicked", () => {
    const setMessages = vi.fn();
    const navigate = vi.fn();
    mockChat({ setMessages });
    vi.mocked(useNavigate).mockReturnValue(navigate);

    const { getByText } = render(<ProtectedLayout />);
    fireEvent.click(getByText("New Chat"));

    // resetChat() clears messages via the real ChatProvider (not a bare mock) — this is what
    // makes the click work identically whether or not the user is already on the landing route,
    // since the handler never inspects current location, only ever clears state and navigates.
    expect(setMessages).toHaveBeenCalledWith([]);
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});

describe("ProtectedLayout account footer wiring", () => {
  it("renders the signed-in user's name and email", () => {
    mockSession({ name: "Jose Ariza", email: "jose@example.com" });

    const { getByText } = render(<ProtectedLayout />);

    expect(getByText("Jose Ariza")).toBeDefined();
    expect(getByText("jose@example.com")).toBeDefined();
  });

  it("signs out and redirects to the login route when clicked", () => {
    const signOut = mockSignOut();
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);

    const { getByRole } = render(<ProtectedLayout />);
    fireEvent.click(getByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
  });
});

describe("ProtectedLayout History", () => {
  const items: MockSessionItem[] = [
    { id: "sess_2", title: "Set up a monthly rent reminder", updated_at: "2026-07-17T10:00:00Z" },
    { id: "sess_1", title: "Categorize my Uber rides", updated_at: "2026-07-16T09:00:00Z" },
  ];

  it("renders the first page of Chat Sessions as links, newest Activity first", () => {
    mockChatSessions({ data: sessionsPage(items) });

    const { getAllByRole } = render(<ProtectedLayout />);
    const links = getAllByRole("link");

    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/chat/sess_2");
    expect(links[0].textContent).toContain("Set up a monthly rent reminder");
    expect(links[1].getAttribute("href")).toBe("/chat/sess_1");
    expect(links[1].textContent).toContain("Categorize my Uber rides");
  });

  it("highlights the open session, derived from the route's sessionId param", () => {
    vi.mocked(useParams).mockReturnValue({
      sessionId: "sess_1",
    } as MockParams as ReturnType<typeof useParams>);
    mockChatSessions({ data: sessionsPage(items) });

    const { getByRole } = render(<ProtectedLayout />);

    const active = getByRole("link", { current: "page" });
    expect(active.getAttribute("href")).toBe("/chat/sess_1");
  });

  it("highlights nothing on the index (new chat) route", () => {
    mockChatSessions({ data: sessionsPage(items) });

    const { getAllByRole, queryByRole } = render(<ProtectedLayout />);

    expect(getAllByRole("link")).toHaveLength(2);
    expect(queryByRole("link", { current: "page" })).toBeNull();
  });

  it("shows 'No chats yet' for an account with no Chat Sessions", () => {
    mockChatSessions({ data: sessionsPage([]) });

    const { getByText, queryAllByRole } = render(<ProtectedLayout />);

    expect(getByText("No chats yet")).toBeDefined();
    expect(queryAllByRole("link")).toHaveLength(0);
  });

  it("shows a quiet inline notice on fetch failure, without a toast", () => {
    mockChatSessions({ isError: true });

    const { getByText, queryAllByRole } = render(<ProtectedLayout />);

    expect(getByText("Couldn't load history")).toBeDefined();
    expect(queryAllByRole("link")).toHaveLength(0);
    expect(toastManager.add).not.toHaveBeenCalled();
  });

  it("renders nothing while loading — no skeleton, no status text", () => {
    mockChatSessions({ isLoading: true });

    const { queryAllByRole, queryByText } = render(<ProtectedLayout />);

    expect(queryAllByRole("link")).toHaveLength(0);
    expect(queryByText("No chats yet")).toBeNull();
    expect(queryByText("Couldn't load history")).toBeNull();
  });

  it("wires the query to the sessions endpoint: stable key, cursor pass-through, next_cursor continuation", () => {
    render(<ProtectedLayout />);

    const lastCall = vi.mocked(useInfiniteQuery).mock.lastCall;
    expect(lastCall).toBeDefined();
    // useInfiniteQuery's options are heavily generic; narrowed to the fields the hook sets.
    const options = lastCall![0] as unknown as {
      queryKey: unknown;
      queryFn: (ctx: { pageParam: unknown }) => unknown;
      getNextPageParam: (lastPage: MockSessionsPage) => string | null;
    };

    expect(options.queryKey).toEqual(["chat-sessions"]);

    void options.queryFn({ pageParam: "cursor_abc" });
    expect(apiGet).toHaveBeenCalledWith("/api/chat/sessions", { cursor: "cursor_abc" });

    expect(options.getNextPageParam({ items: [], next_cursor: "cursor_def" })).toBe("cursor_def");
    expect(options.getNextPageParam({ items: [], next_cursor: null })).toBeNull();
  });
});
