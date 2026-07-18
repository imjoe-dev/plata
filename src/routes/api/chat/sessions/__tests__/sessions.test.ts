import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { MessagePart } from "@tanstack/ai";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (path: string) => (opts: unknown) => ({ id: path, ...(opts as object) }),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: vi.fn(),
}));

// db-helper mocks @/db with an in-memory SQLite database, so the route below runs
// against the real service + repository stack — the agreed seam for this endpoint.
import {
  closeTestDB,
  resetTestDB,
  seedUser,
  setupTestDB,
} from "@/lib/repositories/__tests__/db-helper";
import { auth } from "@/lib/auth/server";
import { createChatSession } from "@/lib/repositories/chat-sessions";
import { appendMessage } from "@/lib/services/chat";
import * as RouteMod from "@/routes/api/chat/sessions/index";

type MockRoute = {
  server: {
    handlers: {
      GET: (ctx: { request: Request }) => Promise<Response>;
    };
  };
};
const Route = RouteMod.Route as unknown as MockRoute;

type SessionListItem = { id: string; title: string; updated_at: string };
type SessionListBody = {
  data: { items: SessionListItem[]; next_cursor: string | null };
};

type MockAuth = {
  api: {
    getSession: (args: {
      headers: Headers;
    }) => Promise<{ user: { id: string }; session: { id: string } } | null>;
  };
};

function authedUser(id = "user_1") {
  vi.mocked(auth).mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue({ user: { id }, session: { id: "s1" } }) },
  } as unknown as MockAuth as ReturnType<typeof auth>);
}
function noSession() {
  vi.mocked(auth).mockReturnValue({
    api: { getSession: vi.fn().mockResolvedValue(null) },
  } as unknown as MockAuth as ReturnType<typeof auth>);
}

function listSessionsRequest(query: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/chat/sessions");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return Route.server.handlers.GET({ request: new Request(url) });
}

// Fixed past instants so a real-clock Activity bump (appendMessage) always lands after them.
const BASE_MS = Date.UTC(2026, 0, 1);

function seedSession(
  userId: string,
  id: string,
  offsetSeconds: number,
  over: { title?: string; deleted_at?: Date } = {},
) {
  return createChatSession({
    id,
    user_id: userId,
    title: over.title ?? `Session ${id}`,
    updated_at: new Date(BASE_MS + offsetSeconds * 1000),
    deleted_at: over.deleted_at,
  });
}

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  vi.clearAllMocks();
  resetTestDB();
  seedUser("user_1");
  seedUser("user_2");
});

describe("GET /api/chat/sessions", () => {
  it("lists the caller's sessions newest Activity first, shaped { id, title, updated_at }", async () => {
    authedUser();
    await seedSession("user_1", "a", 1, { title: "Oldest" });
    await seedSession("user_1", "b", 2, { title: "Middle" });
    await seedSession("user_1", "c", 3, { title: "Newest" });

    const res = await listSessionsRequest();

    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionListBody;
    expect(body.data.items.map((item) => item.id)).toEqual(["c", "b", "a"]);
    expect(body.data.items[0].title).toBe("Newest");
    expect(body.data.next_cursor).toBeNull();
    for (const item of body.data.items) {
      expect(Object.keys(item).sort()).toEqual(["id", "title", "updated_at"]);
      expect(new Date(item.updated_at).getTime()).not.toBeNaN();
    }
  });

  it("cursor walking visits every session exactly once and ends with next_cursor null", async () => {
    authedUser();
    const seeded: string[] = [];
    for (let i = 1; i <= 25; i++) {
      const id = `sess_${String(i).padStart(3, "0")}`;
      // Sessions 18–22 share one timestamp so the id tie-breaker spans the
      // default page boundary (20) — the case that breaks naive keyset cursors.
      const offset = i >= 18 && i <= 22 ? 18 : i;
      await seedSession("user_1", id, offset);
      seeded.push(id);
    }

    const pages: SessionListItem[][] = [];
    let cursor: string | null = null;
    do {
      const res = await listSessionsRequest(cursor ? { cursor } : {});
      expect(res.status).toBe(200);
      const body = (await res.json()) as SessionListBody;
      pages.push(body.data.items);
      cursor = body.data.next_cursor;
    } while (cursor);

    // Default limit is 20: a full page, then the remainder.
    expect(pages.map((page) => page.length)).toEqual([20, 5]);

    const walked = pages.flat();
    expect(new Set(walked.map((item) => item.id)).size).toBe(25);
    expect(walked.map((item) => item.id).sort()).toEqual([...seeded].sort());

    // Strictly descending by (updated_at, id) across page boundaries.
    for (let i = 1; i < walked.length; i++) {
      const prev = walked[i - 1];
      const curr = walked[i];
      const prevKey = `${new Date(prev.updated_at).toISOString()}|${prev.id}`;
      const currKey = `${new Date(curr.updated_at).toISOString()}|${curr.id}`;
      expect(prevKey > currKey).toBe(true);
    }
  });

  it("honors the limit param and caps it at 50", async () => {
    authedUser();
    for (let i = 1; i <= 55; i++) {
      await seedSession("user_1", `sess_${String(i).padStart(3, "0")}`, i);
    }

    const small = (await (await listSessionsRequest({ limit: "3" })).json()) as SessionListBody;
    expect(small.data.items).toHaveLength(3);
    expect(small.data.next_cursor).not.toBeNull();

    const capped = (await (await listSessionsRequest({ limit: "999" })).json()) as SessionListBody;
    expect(capped.data.items).toHaveLength(50);
    expect(capped.data.next_cursor).not.toBeNull();
  });

  it("appending a Chat Message bumps that session to the front of the list", async () => {
    authedUser();
    await seedSession("user_1", "a", 1);
    await seedSession("user_1", "b", 2);
    await seedSession("user_1", "c", 3);

    const parts: MessagePart[] = [{ type: "text", content: "hello again" } as MessagePart];
    await appendMessage("user_1", "a", "user", parts);

    const body = (await (await listSessionsRequest()).json()) as SessionListBody;
    expect(body.data.items.map((item) => item.id)).toEqual(["a", "c", "b"]);
  });

  it("never lists other users' sessions or soft-deleted sessions", async () => {
    authedUser("user_1");
    await seedSession("user_1", "mine", 1);
    await seedSession("user_2", "theirs", 2);
    await seedSession("user_1", "deleted", 3, { deleted_at: new Date() });

    const body = (await (await listSessionsRequest()).json()) as SessionListBody;
    expect(body.data.items.map((item) => item.id)).toEqual(["mine"]);
  });

  it("returns 401 when unauthenticated", async () => {
    noSession();

    const res = await listSessionsRequest();

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed cursor", async () => {
    authedUser();
    await seedSession("user_1", "a", 1);

    const malformed = ["%%%not-base64%%%", btoa("no-separator"), btoa("NaN:sess_1")];
    for (const cursor of malformed) {
      const res = await listSessionsRequest({ cursor });
      expect(res.status).toBe(400);
    }
  });

  it("returns 400 for a non-numeric or non-positive limit", async () => {
    authedUser();

    for (const limit of ["abc", "0", "-5", "2.5"]) {
      const res = await listSessionsRequest({ limit });
      expect(res.status).toBe(400);
    }
  });
});
