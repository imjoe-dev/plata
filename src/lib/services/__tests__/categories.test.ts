import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InternalError, NotFoundError } from "@/lib/errors";

vi.mock("@/lib/repositories/category", () => ({
  createCategory: vi.fn(),
  getCategoryById: vi.fn(),
  listCategories: vi.fn(),
  updateCategory: vi.fn(),
  softDeleteCategory: vi.fn(),
}));

import * as repo from "@/lib/repositories/category";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "@/lib/services/categories";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("category service", () => {
  it("createCategory generates an id and delegates to the repo", async () => {
    vi.mocked(repo.createCategory).mockResolvedValueOnce({
      id: "x",
      name: "A",
      type: "expense",
    } as any);
    await createCategory("user_1", { name: "A", type: "expense" });
    const [, payload] = vi.mocked(repo.createCategory).mock.calls[0];
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.user_id).toBe("user_1");
    expect(payload.name).toBe("A");
  });

  it("createCategory throws InternalError when repo returns null", async () => {
    vi.mocked(repo.createCategory).mockResolvedValueOnce(null as any);
    await expect(createCategory("user_1", { name: "A", type: "expense" })).rejects.toBeInstanceOf(
      InternalError,
    );
  });

  it("createCategory rethrows a unique-constraint error as ConflictError(409)", async () => {
    const dbErr = new Error("SQLITE_CONSTRAINT_UNIQUE: categories_name_user_id_unique");
    vi.mocked(repo.createCategory).mockRejectedValueOnce(dbErr);
    await expect(createCategory("user_1", { name: "A", type: "expense" })).rejects.toMatchObject({
      status: 409,
      constraint: "categories_name_user_id_unique",
      field: "name",
    });
  });

  it("getCategory throws NotFoundError when repo returns null", async () => {
    vi.mocked(repo.getCategoryById).mockResolvedValueOnce(null);
    await expect(getCategory("user_1", "cat_x")).rejects.toMatchObject({
      status: 404,
      resource: "category",
      id: "cat_x",
    });
  });

  it("listCategories delegates straight through", async () => {
    vi.mocked(repo.listCategories).mockResolvedValueOnce([{ id: "c1" } as any]);
    await expect(listCategories("user_1")).resolves.toEqual([{ id: "c1" }]);
  });

  it("updateCategory throws NotFound when repo returns null", async () => {
    vi.mocked(repo.updateCategory).mockResolvedValueOnce(null);
    await expect(updateCategory("user_1", "c1", { name: "B" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("deleteCategory throws NotFound when repo returns null", async () => {
    vi.mocked(repo.softDeleteCategory).mockResolvedValueOnce(null);
    await expect(deleteCategory("user_1", "c1")).rejects.toBeInstanceOf(NotFoundError);
  });
});
