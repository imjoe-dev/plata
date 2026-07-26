import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import {
  setupTestDB,
  resetTestDB,
  seedUser,
  closeTestDB,
} from "@/lib/repositories/__tests__/db-helper";
import { createDefaultUserPreferences } from "@/lib/auth/hooks";
import { getUserPreferencesByUserId } from "@/lib/repositories/user-preferences";

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
});

describe("createDefaultUserPreferences", () => {
  it("creates a user_preferences row with the expected default currency", async () => {
    await createDefaultUserPreferences("user_1");
    const prefs = await getUserPreferencesByUserId("user_1");
    expect(prefs?.default_currency).toBe("USD");
  });
});
