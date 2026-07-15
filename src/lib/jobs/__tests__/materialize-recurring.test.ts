import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { materializeRecurring } from "../materialize-recurring";

vi.mock("@/lib/services/recurring-templates", () => ({
  runScheduledMaterialization: vi.fn(),
}));

describe("materializeRecurring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls runScheduledMaterialization with the correct timestamp from controller.scheduledTime", async () => {
    const { runScheduledMaterialization } = await import("@/lib/services/recurring-templates");
    const mockRunScheduledMaterialization = vi.mocked(runScheduledMaterialization);
    mockRunScheduledMaterialization.mockResolvedValue({
      processedTemplates: 5,
      occurrencesCreated: 8,
      failedTemplates: 0,
    });

    // Epoch millis for a specific time: 2026-01-15T10:30:00Z = 1768462200000
    const scheduledTimeMs = 1768462200000;
    const expectedDate = new Date(scheduledTimeMs);

    const mockController = {
      scheduledTime: scheduledTimeMs,
      cron: "0 * * * *",
      noRetry: vi.fn(),
    } as any;

    const mockEnv = {} as any;
    const mockCtx = {
      waitUntil: vi.fn(),
    } as any;

    await materializeRecurring(mockController, mockEnv, mockCtx);

    expect(mockRunScheduledMaterialization).toHaveBeenCalledOnce();
    expect(mockRunScheduledMaterialization).toHaveBeenCalledWith(expectedDate);
  });

  it("wraps the promise with ctx.waitUntil", async () => {
    const { runScheduledMaterialization } = await import("@/lib/services/recurring-templates");
    const mockRunScheduledMaterialization = vi.mocked(runScheduledMaterialization);
    mockRunScheduledMaterialization.mockResolvedValue({
      processedTemplates: 0,
      occurrencesCreated: 0,
      failedTemplates: 0,
    });

    const mockController = {
      scheduledTime: Date.now(),
      cron: "0 * * * *",
      noRetry: vi.fn(),
    } as any;

    const mockEnv = {} as any;
    const mockCtx = {
      waitUntil: vi.fn(),
    } as any;

    await materializeRecurring(mockController, mockEnv, mockCtx);

    expect(mockCtx.waitUntil).toHaveBeenCalledOnce();
    const waitUntilArg = mockCtx.waitUntil.mock.calls[0][0];
    expect(waitUntilArg instanceof Promise).toBe(true);
  });
});
