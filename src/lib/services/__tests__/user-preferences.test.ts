import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/repositories/user-preferences", () => ({
  getUserPreferencesByUserId: vi.fn(),
  updateUserPreferences: vi.fn(),
}));

import * as repo from "@/lib/repositories/user-preferences";
import { getUserPreferences, updateUserPreferences } from "@/lib/services/user-preferences";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("user-preferences service", () => {
  it("getUserPreferences delegates straight through", async () => {
    vi.mocked(repo.getUserPreferencesByUserId).mockResolvedValueOnce({
      user_id: "user_1",
      default_currency: "USD",
    } as any);
    await expect(getUserPreferences("user_1")).resolves.toMatchObject({ default_currency: "USD" });
    expect(repo.getUserPreferencesByUserId).toHaveBeenCalledWith("user_1");
  });

  it("getUserPreferences throws NotFoundError when repo returns null", async () => {
    vi.mocked(repo.getUserPreferencesByUserId).mockResolvedValueOnce(null);
    await expect(getUserPreferences("user_1")).rejects.toMatchObject({
      status: 404,
      resource: "user_preferences",
      id: "user_1",
    });
  });

  it("updateUserPreferences passes the new currency to the repo", async () => {
    vi.mocked(repo.updateUserPreferences).mockResolvedValueOnce({
      user_id: "user_1",
      default_currency: "COP",
    } as any);
    await updateUserPreferences("user_1", "COP");
    expect(repo.updateUserPreferences).toHaveBeenCalledWith("user_1", { default_currency: "COP" });
  });

  it("updateUserPreferences throws NotFoundError when repo returns null", async () => {
    vi.mocked(repo.updateUserPreferences).mockResolvedValueOnce(null);
    await expect(updateUserPreferences("user_1", "COP")).rejects.toBeInstanceOf(NotFoundError);
  });
});
