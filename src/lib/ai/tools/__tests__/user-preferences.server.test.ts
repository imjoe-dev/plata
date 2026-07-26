import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/services/user-preferences", () => ({
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import { env } from "cloudflare:workers";
import * as svc from "@/lib/services/user-preferences";
import { userPreferencesServerTools } from "@/lib/ai/tools/user-preferences";

const [getTool, updateTool] = userPreferencesServerTools;

const limitSpy = vi.mocked((env as any).MUTATION_RATE_LIMITER.limit);

beforeEach(() => {
  vi.clearAllMocks();
  limitSpy.mockResolvedValue({ success: true });
});

function ctx(userId = "u1") {
  return { context: { userId } } as any;
}

function dbRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: "u1",
    default_currency: "USD" as const,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("needsApproval survives .server() binding", () => {
  it("keeps needsApproval true on the bound update tool", () => {
    expect(updateTool.needsApproval).toBe(true);
  });

  it("leaves needsApproval unset on the bound get tool", () => {
    expect(getTool.needsApproval).toBeUndefined();
  });
});

describe("get_user_preferences server tool", () => {
  it("calls getUserPreferences with the ctx userId and maps the row to ISO-string timestamps", async () => {
    vi.mocked(svc.getUserPreferences).mockResolvedValueOnce(dbRow() as any);
    const result = await getTool.execute!({}, ctx("u1"));
    expect(svc.getUserPreferences).toHaveBeenCalledWith("u1");
    expect(result).toEqual({
      user_id: "u1",
      default_currency: "USD",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
  });

  it("propagates a NotFoundError thrown by the service unchanged", async () => {
    vi.mocked(svc.getUserPreferences).mockRejectedValueOnce(
      new NotFoundError("user_preferences", "u1"),
    );
    await expect(getTool.execute!({}, ctx("u1"))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("update_user_preferences server tool", () => {
  it("checks the mutation rate limit before calling updateUserPreferences", async () => {
    vi.mocked(svc.updateUserPreferences).mockResolvedValueOnce(
      dbRow({ default_currency: "COP" }) as any,
    );
    const result = await updateTool.execute!({ defaultCurrency: "COP" }, ctx("u1"));
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });
    expect(svc.updateUserPreferences).toHaveBeenCalledWith("u1", "COP");
    expect(result).toMatchObject({ default_currency: "COP" });
  });

  it("does not call updateUserPreferences when the rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });
    await expect(updateTool.execute!({ defaultCurrency: "COP" }, ctx("u1"))).rejects.toThrow();
    expect(svc.updateUserPreferences).not.toHaveBeenCalled();
  });

  it("propagates a NotFoundError thrown by the service unchanged", async () => {
    vi.mocked(svc.updateUserPreferences).mockRejectedValueOnce(
      new NotFoundError("user_preferences", "u1"),
    );
    await expect(updateTool.execute!({ defaultCurrency: "COP" }, ctx("u1"))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
