import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import { createChatSession } from "@/lib/repositories/chat-sessions";
import { createChatMessage, listChatMessagesBySession } from "@/lib/repositories/chat-messages";

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
});

describe("chat_messages repository", () => {
  it("creates and lists messages for a session, ordered by created_at", async () => {
    await createChatSession({ id: "sess_1", title: "Hello", user_id: "user_1" });
    await createChatMessage({ id: "msg_1", session_id: "sess_1", role: "user", content: "a" });
    await createChatMessage({
      id: "msg_2",
      session_id: "sess_1",
      role: "assistant",
      content: "b",
    });

    const rows = await listChatMessagesBySession("sess_1");
    expect(rows.map((r) => r.id)).toEqual(["msg_1", "msg_2"]);
    expect(rows[0].role).toBe("user");
    expect(rows[1].role).toBe("assistant");
  });

  it("only lists messages for the given session", async () => {
    await createChatSession({ id: "sess_1", title: "A", user_id: "user_1" });
    await createChatSession({ id: "sess_2", title: "B", user_id: "user_1" });
    await createChatMessage({ id: "msg_1", session_id: "sess_1", role: "user", content: "a" });
    await createChatMessage({ id: "msg_2", session_id: "sess_2", role: "user", content: "b" });

    const rows = await listChatMessagesBySession("sess_1");
    expect(rows.map((r) => r.id)).toEqual(["msg_1"]);
  });

  it("returns an empty list for a session with no messages", async () => {
    await createChatSession({ id: "sess_1", title: "A", user_id: "user_1" });
    const rows = await listChatMessagesBySession("sess_1");
    expect(rows).toEqual([]);
  });
});
