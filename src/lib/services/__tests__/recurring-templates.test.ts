import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InternalError, NotFoundError } from "@/lib/errors";

vi.mock("@/lib/repositories/recurring-templates", () => ({
  createRecurringTemplate: vi.fn(),
  getRecurringTemplateById: vi.fn(),
  listRecurringTemplates: vi.fn(),
  updateRecurringTemplate: vi.fn(),
  softDeleteRecurringTemplate: vi.fn(),
  listDueTemplates: vi.fn(),
}));
vi.mock("@/lib/repositories/category", () => ({
  getCategoryById: vi.fn(),
}));

import * as recRepo from "@/lib/repositories/recurring-templates";
import * as catRepo from "@/lib/repositories/category";
import {
  activateTemplate,
  createRecurringTemplate,
  deleteRecurringTemplate,
  getRecurringTemplate,
  pauseTemplate,
  updateRecurringTemplate,
} from "@/lib/services/recurring-templates";

const validInput = {
  amount: 1500,
  currency: "USD",
  type: "expense" as const,
  description: "Rent",
  cadence: "monthly" as const,
  status: "active" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recurring-templates service", () => {
  it("creates a template with no FK refs", async () => {
    vi.mocked(recRepo.createRecurringTemplate).mockResolvedValueOnce({ id: "r1" } as any);
    await createRecurringTemplate("user_1", validInput);
    const [, payload] = vi.mocked(recRepo.createRecurringTemplate).mock.calls[0];
    expect(payload.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.user_id).toBe("user_1");
    expect(payload.amount).toBe(1500);
  });

  it("throws NotFound when categoryId is not owned by the user", async () => {
    vi.mocked(catRepo.getCategoryById).mockResolvedValueOnce(null);
    await expect(
      createRecurringTemplate("user_1", { ...validInput, categoryId: "c1" }),
    ).rejects.toMatchObject({
      status: 404,
      resource: "category",
    });
  });

  it("throws InternalError when repo returns null on create", async () => {
    vi.mocked(recRepo.createRecurringTemplate).mockResolvedValueOnce(null as any);
    await expect(createRecurringTemplate("user_1", validInput)).rejects.toBeInstanceOf(
      InternalError,
    );
  });

  it("get/list/update/delete throw NotFound on null", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce(null);
    vi.mocked(recRepo.updateRecurringTemplate).mockResolvedValueOnce(null);
    vi.mocked(recRepo.softDeleteRecurringTemplate).mockResolvedValueOnce(null);
    await expect(getRecurringTemplate("user_1", "r1")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateRecurringTemplate("user_1", "r1", { description: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteRecurringTemplate("user_1", "r1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pauseTemplate is legal from active", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce({
      id: "r1",
      status: "active",
    } as any);
    vi.mocked(recRepo.updateRecurringTemplate).mockResolvedValueOnce({
      id: "r1",
      status: "paused",
    } as any);
    const out = await pauseTemplate("user_1", "r1");
    expect(out.status).toBe("paused");
  });

  it("pauseTemplate throws InternalError from completed", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce({
      id: "r1",
      status: "completed",
    } as any);
    await expect(pauseTemplate("user_1", "r1")).rejects.toBeInstanceOf(InternalError);
  });

  it("activateTemplate is legal from paused", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce({
      id: "r1",
      status: "paused",
    } as any);
    vi.mocked(recRepo.updateRecurringTemplate).mockResolvedValueOnce({
      id: "r1",
      status: "active",
    } as any);
    expect((await activateTemplate("user_1", "r1")).status).toBe("active");
  });

  it("activateTemplate throws InternalError from completed", async () => {
    vi.mocked(recRepo.getRecurringTemplateById).mockResolvedValueOnce({
      id: "r1",
      status: "completed",
    } as any);
    await expect(activateTemplate("user_1", "r1")).rejects.toBeInstanceOf(InternalError);
  });
});
