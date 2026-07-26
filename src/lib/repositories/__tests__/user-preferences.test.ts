import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import {
  createUserPreferences,
  getUserPreferencesByUserId,
  updateUserPreferences,
} from "@/lib/repositories/user-preferences";

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
  seedUser("user_2");
});

describe("user-preferences repository", () => {
  it("creates and retrieves preferences scoped by user", async () => {
    await createUserPreferences({ user_id: "user_1" });
    const got = await getUserPreferencesByUserId("user_1");
    expect(got?.default_currency).toBe("USD");
  });

  it("does not leak across users", async () => {
    await createUserPreferences({ user_id: "user_1" });
    expect(await getUserPreferencesByUserId("user_2")).toBeNull();
  });

  it("returns null when no row exists for the user", async () => {
    expect(await getUserPreferencesByUserId("user_1")).toBeNull();
  });

  it("updates the default currency", async () => {
    await createUserPreferences({ user_id: "user_1" });
    const updated = await updateUserPreferences("user_1", { default_currency: "COP" });
    expect(updated?.default_currency).toBe("COP");
  });

  it("updateUserPreferences returns null for a user with no row", async () => {
    expect(await updateUserPreferences("user_1", { default_currency: "COP" })).toBeNull();
  });
});
