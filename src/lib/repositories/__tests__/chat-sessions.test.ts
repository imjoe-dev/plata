import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import { createChatSession, getChatSessionById } from "@/lib/repositories/chat-sessions";

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
  seedUser("user_2");
});

describe("chat_sessions repository", () => {
  it("creates and retrieves a session scoped by user", async () => {
    await createChatSession({ id: "sess_1", title: "Hello", user_id: "user_1" });
    const got = await getChatSessionById("user_1", "sess_1");
    expect(got?.title).toBe("Hello");
    expect(got?.user_id).toBe("user_1");
  });

  it("returns null when the session belongs to a different user", async () => {
    await createChatSession({ id: "sess_1", title: "Hello", user_id: "user_1" });
    const got = await getChatSessionById("user_2", "sess_1");
    expect(got).toBeNull();
  });

  it("returns null for a nonexistent session id", async () => {
    const got = await getChatSessionById("user_1", "does_not_exist");
    expect(got).toBeNull();
  });

  it("rejects a duplicate id with an error matching the service's constraint-violation regex", async () => {
    // Guards that the driver's message still matches getOrCreateSession's constraint-violation regex.
    await createChatSession({ id: "sess_1", title: "First", user_id: "user_1" });
    await expect(
      createChatSession({ id: "sess_1", title: "Second", user_id: "user_2" }),
    ).rejects.toThrow(/chat_sessions\.id/i);
  });
});
