import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import { categories } from "@/db/schema";
import { createSoftDeleteRepo } from "@/lib/repositories/soft-delete";

const repo = createSoftDeleteRepo(categories);

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
  seedUser("user_2");
});

describe("createSoftDeleteRepo", () => {
  it("creates and retrieves a row scoped by user", async () => {
    const created = await repo.create({
      id: "cat_1",
      name: "Groceries",
      type: "expense",
      user_id: "user_1",
    });
    expect(created.id).toBe("cat_1");
    const got = await repo.getById("user_1", "cat_1");
    expect(got?.name).toBe("Groceries");
  });

  it("does not leak a row across users", async () => {
    await repo.create({ id: "cat_1", name: "Groceries", type: "expense", user_id: "user_1" });
    expect(await repo.getById("user_2", "cat_1")).toBeNull();
  });

  it("updates a row scoped by user, and returns null for another user's row", async () => {
    await repo.create({ id: "cat_1", name: "Groceries", type: "expense", user_id: "user_1" });
    const updated = await repo.update("user_1", "cat_1", { name: "Food" });
    expect(updated?.name).toBe("Food");
    expect(await repo.update("user_2", "cat_1", { name: "Nope" })).toBeNull();
  });

  it("soft-deletes a row, excluding it from further reads", async () => {
    await repo.create({ id: "cat_1", name: "Groceries", type: "expense", user_id: "user_1" });
    const deleted = await repo.softDelete("user_1", "cat_1");
    expect(deleted?.deleted_at).toBeTruthy();
    expect(await repo.getById("user_1", "cat_1")).toBeNull();
  });

  it("returns null for softDelete on another user's row", async () => {
    await repo.create({ id: "cat_1", name: "Groceries", type: "expense", user_id: "user_1" });
    expect(await repo.softDelete("user_2", "cat_1")).toBeNull();
  });
});
