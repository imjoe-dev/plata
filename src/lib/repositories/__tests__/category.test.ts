import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { setupTestDB, resetTestDB, seedUser, closeTestDB } from "./db-helper";
import {
  createCategory,
  getCategoryById,
  listCategories,
  softDeleteCategory,
  updateCategory,
} from "@/lib/repositories/category";

beforeAll(async () => {
  await setupTestDB();
});
afterAll(() => closeTestDB());
beforeEach(() => {
  resetTestDB();
  seedUser("user_1");
  seedUser("user_2");
});

describe("category repository", () => {
  it("creates and retrieves a category scoped by user", async () => {
    const created = await createCategory({
      id: "cat_1",
      name: "Groceries",
      type: "expense",
      user_id: "user_1",
    });
    expect(created.id).toBe("cat_1");
    const got = await getCategoryById("user_1", "cat_1");
    expect(got?.name).toBe("Groceries");
  });

  it("does not leak a category across users", async () => {
    await createCategory({
      id: "cat_1",
      name: "Groceries",
      type: "expense",
      user_id: "user_1",
    });
    expect(await getCategoryById("user_2", "cat_1")).toBeNull();
  });

  it("lists only the calling user's categories", async () => {
    await createCategory({ id: "cat_1", name: "A", type: "expense", user_id: "user_1" });
    await createCategory({ id: "cat_2", name: "B", type: "expense", user_id: "user_2" });
    const list = await listCategories("user_1");
    expect(list.map((c) => c.id)).toEqual(["cat_1"]);
  });

  it("soft-deletes and excludes the row from reads", async () => {
    await createCategory({ id: "cat_1", name: "A", type: "expense", user_id: "user_1" });
    const deleted = await softDeleteCategory("user_1", "cat_1");
    expect(deleted?.deleted_at).toBeTruthy();
    expect(await getCategoryById("user_1", "cat_1")).toBeNull();
    expect(await listCategories("user_1")).toEqual([]);
  });

  it("updateCategory returns null when the row belongs to another user", async () => {
    await createCategory({ id: "cat_1", name: "A", type: "expense", user_id: "user_1" });
    const res = await updateCategory("user_2", "cat_1", { name: "B" });
    expect(res).toBeNull();
  });
});
