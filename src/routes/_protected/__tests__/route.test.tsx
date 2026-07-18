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
import { useQuery } from "@tanstack/react-query";
import { usePlataChat } from "@/hooks/use-plata-chat";
import { mockPlataChat } from "@/hooks/__tests__/mock-plata-chat";
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
