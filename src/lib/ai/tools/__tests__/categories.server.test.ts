import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/services/categories", () => ({
  createCategory: vi.fn(),
  listCategories: vi.fn(),
  getCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import { env } from "cloudflare:workers";
import * as svc from "@/lib/services/categories";
import { categoryServerTools } from "@/lib/ai/tools/categories";

const [listTool, createTool, getTool, updateTool, deleteTool] = categoryServerTools;

const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);

beforeEach(() => {
  vi.clearAllMocks();
  limitSpy.mockResolvedValue({ success: true });
});

function ctx(userId = "u1") {
  return { context: { userId } } as any;
}

describe("needsApproval survives .server() binding", () => {
  it("keeps needsApproval true on the bound mutating tools", () => {
    expect(createTool.needsApproval).toBe(true);
    expect(updateTool.needsApproval).toBe(true);
    expect(deleteTool.needsApproval).toBe(true);
  });

  it("leaves needsApproval unset on the bound read-only tools", () => {
    expect(listTool.needsApproval).toBeUndefined();
    expect(getTool.needsApproval).toBeUndefined();
  });
});

// A realistic Drizzle row: Date timestamps, nullable user_id — the shape the
// service layer actually returns (see src/lib/repositories/category.ts).
function dbRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    name: "Food",
    type: "expense" as const,
    color: null,
    icon: null,
    user_id: "u1",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
    deleted_at: null,
    ...overrides,
  };
}

describe("list_categories server tool", () => {
  it("calls listCategories with the ctx userId and maps rows to ISO-string timestamps", async () => {
    vi.mocked(svc.listCategories).mockResolvedValueOnce([dbRow(), dbRow({ id: "c2" })] as any);
    const result = await listTool.execute!({}, ctx("u1"));
    expect(svc.listCategories).toHaveBeenCalledWith("u1");
    expect(result).toEqual([
      expect.objectContaining({
        id: "c1",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
        deleted_at: null,
      }),
      expect.objectContaining({ id: "c2" }),
    ]);
  });
});

describe("create_category server tool", () => {
  it("checks the mutation rate limit before calling createCategory, and returns ISO timestamps", async () => {
    vi.mocked(svc.createCategory).mockResolvedValueOnce(dbRow() as any);
    const result = await createTool.execute!({ name: "Food", type: "expense" }, ctx("u1"));
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    expect(svc.createCategory).toHaveBeenCalledWith("u1", { name: "Food", type: "expense" });
    expect(result).toMatchObject({
      id: "c1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
  });

  it("does not call createCategory when the rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });
    await expect(
      createTool.execute!({ name: "Food", type: "expense" }, ctx("u1")),
    ).rejects.toThrow();
    expect(svc.createCategory).not.toHaveBeenCalled();
  });

  it("propagates a ConflictError thrown by the service unchanged", async () => {
    const { ConflictError } = await import("@/lib/errors");
    vi.mocked(svc.createCategory).mockRejectedValueOnce(new ConflictError("uq", "name"));
    await expect(
      createTool.execute!({ name: "Food", type: "expense" }, ctx("u1")),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("get_category server tool", () => {
  it("calls getCategory with the ctx userId and the input id", async () => {
    vi.mocked(svc.getCategory).mockResolvedValueOnce(dbRow({ name: "Food" }) as any);
    const result = await getTool.execute!({ id: "c1" }, ctx("u1"));
    expect(svc.getCategory).toHaveBeenCalledWith("u1", "c1");
    expect(result).toMatchObject({ id: "c1", name: "Food" });
  });

  it("falls back to the ctx userId when the row's user_id is null", async () => {
    vi.mocked(svc.getCategory).mockResolvedValueOnce(dbRow({ user_id: null }) as any);
    const result = await getTool.execute!({ id: "c1" }, ctx("u1"));
    expect(result.user_id).toBe("u1");
  });

  it("propagates a NotFoundError thrown by the service unchanged", async () => {
    vi.mocked(svc.getCategory).mockRejectedValueOnce(new NotFoundError("category", "nope"));
    await expect(getTool.execute!({ id: "nope" }, ctx("u1"))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("update_category server tool", () => {
  it("checks the mutation rate limit, then calls updateCategory with id split from patch", async () => {
    vi.mocked(svc.updateCategory).mockResolvedValueOnce(dbRow({ name: "New" }) as any);
    const result = await updateTool.execute!({ id: "c1", name: "New" }, ctx("u1"));
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    expect(svc.updateCategory).toHaveBeenCalledWith("u1", "c1", { name: "New" });
    expect(result).toMatchObject({ id: "c1", name: "New" });
  });

  it("does not call updateCategory when the rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });
    await expect(updateTool.execute!({ id: "c1", name: "New" }, ctx("u1"))).rejects.toThrow();
    expect(svc.updateCategory).not.toHaveBeenCalled();
  });

  it("propagates a NotFoundError thrown by the service unchanged", async () => {
    vi.mocked(svc.updateCategory).mockRejectedValueOnce(new NotFoundError("category", "nope"));
    await expect(
      updateTool.execute!({ id: "nope", name: "New" }, ctx("u1")),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("delete_category server tool", () => {
  it("checks the mutation rate limit, then calls deleteCategory with the ctx userId and id", async () => {
    vi.mocked(svc.deleteCategory).mockResolvedValueOnce(
      dbRow({ deleted_at: new Date("2026-01-03T00:00:00.000Z") }) as any,
    );
    const result = await deleteTool.execute!({ id: "c1" }, ctx("u1"));
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    expect(svc.deleteCategory).toHaveBeenCalledWith("u1", "c1");
    expect(result).toMatchObject({ id: "c1", deleted_at: "2026-01-03T00:00:00.000Z" });
  });

  it("does not call deleteCategory when the rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });
    await expect(deleteTool.execute!({ id: "c1" }, ctx("u1"))).rejects.toThrow();
    expect(svc.deleteCategory).not.toHaveBeenCalled();
  });

  it("propagates a NotFoundError thrown by the service unchanged", async () => {
    vi.mocked(svc.deleteCategory).mockRejectedValueOnce(new NotFoundError("category", "nope"));
    await expect(deleteTool.execute!({ id: "nope" }, ctx("u1"))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
