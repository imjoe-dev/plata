import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/repositories/chat-sessions", () => ({
  createChatSession: vi.fn(),
  getChatSessionById: vi.fn(),
  listChatSessions: vi.fn(),
  touchChatSession: vi.fn(),
}));
vi.mock("@/lib/repositories/chat-messages", () => ({
  createChatMessage: vi.fn(),
  listChatMessagesBySession: vi.fn(),
}));

import * as sessionsRepo from "@/lib/repositories/chat-sessions";
import * as messagesRepo from "@/lib/repositories/chat-messages";
import { appendMessage, deriveTitle, getOrCreateSession, listMessages } from "@/lib/services/chat";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deriveTitle", () => {
  it("returns short text unchanged, trimmed", () => {
    expect(deriveTitle("  Hello there  ")).toBe("Hello there");
  });

  it("leaves text exactly at the boundary unchanged", () => {
    const exact = "a".repeat(60);
    expect(deriveTitle(exact)).toBe(exact);
  });

  it("truncates long text on a word boundary with an ellipsis", () => {
    const long =
      "Can you help me categorize all of my Uber rides from last month as transportation expenses please";
    const title = deriveTitle(long);
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith("…")).toBe(true);
    expect(title.endsWith(" …")).toBe(false);
  });
});

describe("getOrCreateSession", () => {
  const parts = [{ type: "text", content: "Categorize my Uber rides" }] as any;

  it("creates a new session with a derived title when none exists", async () => {
    vi.mocked(sessionsRepo.getChatSessionById).mockResolvedValueOnce(null);
    vi.mocked(sessionsRepo.createChatSession).mockResolvedValueOnce({
      id: "sess_1",
      title: "Categorize my Uber rides",
      user_id: "user_1",
    } as any);

    const session = await getOrCreateSession("user_1", "sess_1", parts);

    expect(session.id).toBe("sess_1");
    const [payload] = vi.mocked(sessionsRepo.createChatSession).mock.calls[0];
    expect(payload.id).toBe("sess_1");
    expect(payload.user_id).toBe("user_1");
    expect(payload.title).toBe("Categorize my Uber rides");
  });

  it("reuses an existing session owned by the same user, idempotently", async () => {
    vi.mocked(sessionsRepo.getChatSessionById).mockResolvedValueOnce({
      id: "sess_1",
      title: "Existing",
      user_id: "user_1",
    } as any);

    const session = await getOrCreateSession("user_1", "sess_1", parts);

    expect(session.title).toBe("Existing");
    expect(sessionsRepo.createChatSession).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the id already belongs to a different user", async () => {
    vi.mocked(sessionsRepo.getChatSessionById)
      .mockResolvedValueOnce(null) // initial lookup: not visible to this caller
      .mockResolvedValueOnce(null); // re-check after the race: still not visible — someone else's
    vi.mocked(sessionsRepo.createChatSession).mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: chat_sessions.id"),
    );

    await expect(getOrCreateSession("user_1", "sess_1", parts)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("resolves idempotently when the race was against the same user's own double-submit", async () => {
    const winningRow = { id: "sess_1", title: "Existing", user_id: "user_1" } as any;
    vi.mocked(sessionsRepo.getChatSessionById)
      .mockResolvedValueOnce(null) // initial lookup: this request hasn't seen it yet
      .mockResolvedValueOnce(winningRow); // re-check after the race: the caller's own row won
    vi.mocked(sessionsRepo.createChatSession).mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: chat_sessions.id"),
    );

    const session = await getOrCreateSession("user_1", "sess_1", parts);

    expect(session).toBe(winningRow);
  });

  it("rethrows an unrelated error from session creation", async () => {
    vi.mocked(sessionsRepo.getChatSessionById).mockResolvedValueOnce(null);
    vi.mocked(sessionsRepo.createChatSession).mockRejectedValueOnce(new Error("disk full"));

    await expect(getOrCreateSession("user_1", "sess_1", parts)).rejects.toThrow("disk full");
  });
});

describe("appendMessage", () => {
  const parts = [{ type: "text", content: "Hi" }] as any;

  it("throws NotFoundError when the session isn't owned by the caller", async () => {
    vi.mocked(sessionsRepo.getChatSessionById).mockResolvedValueOnce(null);

    await expect(appendMessage("user_1", "sess_1", "user", parts)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(messagesRepo.createChatMessage).not.toHaveBeenCalled();
  });

  it("persists the parts as JSON when the session exists", async () => {
    vi.mocked(sessionsRepo.getChatSessionById).mockResolvedValueOnce({
      id: "sess_1",
      user_id: "user_1",
    } as any);
    vi.mocked(messagesRepo.createChatMessage).mockResolvedValueOnce({} as any);

    await appendMessage("user_1", "sess_1", "assistant", parts);

    const [payload] = vi.mocked(messagesRepo.createChatMessage).mock.calls[0];
    expect(payload.session_id).toBe("sess_1");
    expect(payload.role).toBe("assistant");
    expect(JSON.parse(payload.content as string)).toEqual(parts);
  });
});

describe("listMessages", () => {
  it("throws NotFoundError when the session isn't owned by the caller", async () => {
    vi.mocked(sessionsRepo.getChatSessionById).mockResolvedValueOnce(null);

    await expect(listMessages("user_1", "sess_1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns ordered, deserialized messages", async () => {
    const parts = [{ type: "text", content: "Hi" }];
    vi.mocked(sessionsRepo.getChatSessionById).mockResolvedValueOnce({
      id: "sess_1",
      user_id: "user_1",
    } as any);
    vi.mocked(messagesRepo.listChatMessagesBySession).mockResolvedValueOnce([
      { id: "msg_1", role: "user", content: JSON.stringify(parts) } as any,
    ]);

    const messages = await listMessages("user_1", "sess_1");

    expect(messages).toEqual([{ id: "msg_1", role: "user", parts }]);
  });
});
