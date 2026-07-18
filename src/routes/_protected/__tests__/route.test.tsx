// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// History links resolve the route pattern to a plain href so items render as real anchors.
type MockLinkProps = React.ComponentProps<"a"> & {
  to: string;
  params?: Record<string, string>;
};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: any) => ({
    id: path,
    options: opts,
    useRouteContext: vi.fn(),
  }),
  redirect: vi.fn(),
  Outlet: () => null,
  Link: ({ to, params, ...props }: MockLinkProps) => {
    let href = to;
    for (const [key, value] of Object.entries(params ?? {})) {
      href = href.replace(`$${key}`, value);
    }
    return <a href={href} {...props} />;
  },
  useNavigate: vi.fn(),
  useParams: vi.fn(),
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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

// The History query runs against the REAL TanStack Query client — only the HTTP layer
// (apiGet) is mocked. This keeps the seam at the spec's level: a break anywhere between
// useChatSessions and Query's pagination machinery fails these tests.
type MockSessionItem = { id: string; title: string; updated_at: string };
type MockHistoryPage = { items: MockSessionItem[]; next_cursor: string | null };

const SESSIONS_URL = "/api/chat/sessions";

// Serves `pages` in order across successive requests; messages hydration gets an empty
// conversation. Returns the mock for per-test call inspection.
function mockApi(pages: MockHistoryPage[] = [{ items: [], next_cursor: null }]) {
  let sessionsCall = 0;
  vi.mocked(apiGet).mockImplementation((url: string) => {
    if (url === SESSIONS_URL) {
      const page = pages[Math.min(sessionsCall, pages.length - 1)];
      sessionsCall += 1;
      return Promise.resolve(page);
    }
    return Promise.resolve([]);
  });
  return vi.mocked(apiGet);
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

function renderLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProtectedLayout />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useParams).mockReturnValue({} as MockParams as ReturnType<typeof useParams>);
  mockChat();
  mockSession();
  mockApi();
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

    const { getByText } = renderLayout();
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

    const { getByText } = renderLayout();

    expect(getByText("Jose Ariza")).toBeDefined();
    expect(getByText("jose@example.com")).toBeDefined();
  });

  it("signs out and redirects to the login route when clicked", () => {
    const signOut = mockSignOut();
    const navigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);

    const { getByRole } = renderLayout();
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

  it("renders the first page of Chat Sessions as links, newest Activity first", async () => {
    mockApi([{ items, next_cursor: null }]);

    const { findAllByRole } = renderLayout();
    const links = await findAllByRole("link");

    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe("/chat/sess_2");
    expect(links[0].textContent).toContain("Set up a monthly rent reminder");
    expect(links[1].getAttribute("href")).toBe("/chat/sess_1");
    expect(links[1].textContent).toContain("Categorize my Uber rides");
  });

  it("highlights the open session, derived from the route's sessionId param", async () => {
    vi.mocked(useParams).mockReturnValue({
      sessionId: "sess_1",
    } as MockParams as ReturnType<typeof useParams>);
    mockApi([{ items, next_cursor: null }]);

    const { findByRole } = renderLayout();

    const active = await findByRole("link", { current: "page" });
    expect(active.getAttribute("href")).toBe("/chat/sess_1");
  });

  it("highlights nothing on the index (new chat) route", async () => {
    mockApi([{ items, next_cursor: null }]);

    const { findAllByRole, queryByRole } = renderLayout();

    expect(await findAllByRole("link")).toHaveLength(2);
    expect(queryByRole("link", { current: "page" })).toBeNull();
  });

  it("shows 'No chats yet' for an account with no Chat Sessions", async () => {
    mockApi([{ items: [], next_cursor: null }]);

    const { findByText, queryAllByRole } = renderLayout();

    expect(await findByText("No chats yet")).toBeDefined();
    expect(queryAllByRole("link")).toHaveLength(0);
  });

  it("shows a quiet inline notice on fetch failure, without a toast", async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error("boom"));

    const { findByText, queryAllByRole } = renderLayout();

    expect(await findByText("Couldn't load history")).toBeDefined();
    expect(queryAllByRole("link")).toHaveLength(0);
    expect(toastManager.add).not.toHaveBeenCalled();
  });

  it("renders nothing while loading — no skeleton, no status text", () => {
    // A request that never settles pins the query in its loading state.
    vi.mocked(apiGet).mockImplementation(() => new Promise(() => {}));

    const { queryAllByRole, queryByText } = renderLayout();

    expect(queryAllByRole("link")).toHaveLength(0);
    expect(queryByText("No chats yet")).toBeNull();
    expect(queryByText("Couldn't load history")).toBeNull();
  });

  it("loads and appends the next page when 'Show more' is clicked", async () => {
    const api = mockApi([
      { items, next_cursor: "cursor_2" },
      {
        items: [
          { id: "sess_0", title: "Plan groceries budget", updated_at: "2026-07-10T08:00:00Z" },
        ],
        next_cursor: null,
      },
    ]);

    const { findByRole, findAllByRole, getAllByRole, queryByRole } = renderLayout();
    fireEvent.click(await findByRole("button", { name: "Show more" }));

    // The second page's items append below the first — real Query pagination, not a stub.
    await waitFor(() => {
      expect(getAllByRole("link")).toHaveLength(3);
    });
    expect((await findAllByRole("link"))[2].getAttribute("href")).toBe("/chat/sess_0");
    expect(api).toHaveBeenCalledWith(SESSIONS_URL, { cursor: "cursor_2" });

    // History is now exhausted (next_cursor: null) — the control disappears.
    await waitFor(() => {
      expect(queryByRole("button", { name: "Show more" })).toBeNull();
    });
  });

  it("hides 'Show more' once History is exhausted", async () => {
    mockApi([{ items, next_cursor: null }]);

    const { findAllByRole, queryByRole } = renderLayout();

    expect(await findAllByRole("link")).toHaveLength(2); // items still render
    expect(queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
