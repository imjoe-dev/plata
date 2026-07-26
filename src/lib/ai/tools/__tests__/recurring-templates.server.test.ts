import type { ToolExecutionContext } from "@tanstack/ai";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ToolContext } from "@/lib/ai/tools/context";
import { InternalError, NotFoundError } from "@/lib/errors";

vi.mock("@/lib/services/recurring-templates", () => ({
  listRecurringTemplates: vi.fn(),
  createRecurringTemplate: vi.fn(),
  createRecurringTemplates: vi.fn(),
  getRecurringTemplate: vi.fn(),
  updateRecurringTemplate: vi.fn(),
  deleteRecurringTemplate: vi.fn(),
  pauseTemplate: vi.fn(),
  activateTemplate: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import { env } from "cloudflare:workers";

import {
  activateRecurringTemplateServerHandler,
  createRecurringTemplateServerHandler,
  createRecurringTemplatesServerHandler,
  deleteRecurringTemplateServerHandler,
  getRecurringTemplateServerHandler,
  listRecurringTemplatesServerHandler,
  pauseRecurringTemplateServerHandler,
  recurringTemplateServerTools,
  updateRecurringTemplateServerHandler,
} from "@/lib/ai/tools/recurring-templates";
import * as svc from "@/lib/services/recurring-templates";

const limitSpy = vi.mocked(
  (env as unknown as { MUTATION_RATE_LIMITER: { limit: unknown } }).MUTATION_RATE_LIMITER.limit as (
    ...args: unknown[]
  ) => Promise<{ success: boolean }>,
);

function ctx(userId = "u1"): ToolExecutionContext<ToolContext> {
  return { context: { userId }, emitCustomEvent: vi.fn() };
}

/** A full-shape D1 row (as `serializeTemplateRow` expects), overridable per test. */
function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    amount: 1000,
    currency: "USD",
    type: "expense",
    description: "Rent",
    category_id: null,
    cadence: "monthly",
    next_due_date: null,
    last_insertion_date: null,
    status: "active",
    start_date: null,
    end_date: null,
    user_id: "u1",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    deleted_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  limitSpy.mockResolvedValue({ success: true });
});

describe("listRecurringTemplatesServerHandler", () => {
  it("scopes to userId, forwards the status filter, and converts amounts to major units", async () => {
    vi.mocked(svc.listRecurringTemplates).mockResolvedValueOnce([dbRow({ amount: 1500 })] as never);

    const result = await listRecurringTemplatesServerHandler({ status: "active" }, ctx("u1"));

    expect(result).toEqual([expect.objectContaining({ id: "r1", amount: 15 })]);
    expect(svc.listRecurringTemplates).toHaveBeenCalledWith("u1", { status: "active" });
  });
});

describe("createRecurringTemplateServerHandler", () => {
  it("checks the mutation rate limit, converts dollars to cents and date strings to Dates before calling the service, and converts the response to major units", async () => {
    vi.mocked(svc.createRecurringTemplate).mockResolvedValueOnce(dbRow({ amount: 1250 }) as never);

    const result = await createRecurringTemplateServerHandler(
      {
        amount: 12.5,
        currency: "USD",
        type: "expense",
        description: "Rent",
        cadence: "monthly",
        status: "active",
        nextDueDate: "2026-08-01T00:00:00.000Z",
      },
      ctx("u1"),
    );

    expect(result).toEqual(expect.objectContaining({ id: "r1", amount: 12.5 }));
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });

    const [userId, payload] = vi.mocked(svc.createRecurringTemplate).mock.calls[0] as [
      string,
      { amount: number; nextDueDate: Date | null },
    ];
    expect(userId).toBe("u1");
    expect(payload.amount).toBe(1250);
    expect(payload.nextDueDate).toBeInstanceOf(Date);
    expect(payload.nextDueDate?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("does not call the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });

    await expect(
      createRecurringTemplateServerHandler(
        {
          amount: 12.5,
          type: "expense",
          description: "Rent",
          cadence: "monthly",
          status: "active",
        },
        ctx("u1"),
      ),
    ).rejects.toThrow();
    expect(svc.createRecurringTemplate).not.toHaveBeenCalled();
  });
});

describe("createRecurringTemplatesServerHandler", () => {
  it("checks the mutation rate limit exactly once regardless of item count, and returns every created row in major units", async () => {
    vi.mocked(svc.createRecurringTemplates).mockResolvedValueOnce([
      dbRow({ id: "r1", amount: 1250 }),
      dbRow({ id: "r2", amount: 500 }),
    ] as never);

    const result = await createRecurringTemplatesServerHandler(
      {
        templates: [
          {
            amount: 12.5,
            currency: "USD",
            type: "expense",
            description: "Rent",
            cadence: "monthly",
            status: "active",
          },
          {
            amount: 5,
            currency: "USD",
            type: "expense",
            description: "Gym",
            cadence: "monthly",
            status: "active",
          },
        ],
      },
      ctx("u1"),
    );

    expect(limitSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({ id: "r1", amount: 12.5 }),
      expect.objectContaining({ id: "r2", amount: 5 }),
    ]);
    const [userId, payloads] = vi.mocked(svc.createRecurringTemplates).mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(userId).toBe("u1");
    expect(payloads).toHaveLength(2);
  });

  it("does not call the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });

    await expect(
      createRecurringTemplatesServerHandler(
        {
          templates: [
            {
              amount: 12.5,
              type: "expense",
              description: "Rent",
              cadence: "monthly",
              status: "active",
            },
          ],
        },
        ctx("u1"),
      ),
    ).rejects.toThrow();
    expect(svc.createRecurringTemplates).not.toHaveBeenCalled();
  });
});

describe("getRecurringTemplateServerHandler", () => {
  it("scopes to userId and converts the response to major units", async () => {
    vi.mocked(svc.getRecurringTemplate).mockResolvedValueOnce(dbRow({ amount: 800 }) as never);

    const result = await getRecurringTemplateServerHandler({ id: "r1" }, ctx("u1"));

    expect(result).toEqual(expect.objectContaining({ id: "r1", amount: 8 }));
    expect(svc.getRecurringTemplate).toHaveBeenCalledWith("u1", "r1");
  });

  it("propagates a NotFoundError from the service unchanged", async () => {
    vi.mocked(svc.getRecurringTemplate).mockRejectedValueOnce(
      new NotFoundError("recurring_template", "r1"),
    );

    await expect(getRecurringTemplateServerHandler({ id: "r1" }, ctx("u1"))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("updateRecurringTemplateServerHandler", () => {
  it("checks the mutation rate limit, strips id, converts amount/dates, and converts the response", async () => {
    vi.mocked(svc.updateRecurringTemplate).mockResolvedValueOnce(dbRow({ amount: 2000 }) as never);

    const result = await updateRecurringTemplateServerHandler(
      { id: "r1", amount: 20, startDate: "2026-01-01T00:00:00.000Z" },
      ctx("u1"),
    );

    expect(result).toEqual(expect.objectContaining({ id: "r1", amount: 20 }));
    expect(limitSpy).toHaveBeenCalledWith({ key: "u1" });

    const [userId, id, patch] = vi.mocked(svc.updateRecurringTemplate).mock.calls[0] as [
      string,
      string,
      { amount?: number; startDate?: Date | null },
    ];
    expect(userId).toBe("u1");
    expect(id).toBe("r1");
    expect(patch.amount).toBe(2000);
    expect(patch.startDate).toBeInstanceOf(Date);
    expect((patch as Record<string, unknown>).id).toBeUndefined();
  });

  it("does not call the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });

    await expect(
      updateRecurringTemplateServerHandler({ id: "r1", amount: 20 }, ctx("u1")),
    ).rejects.toThrow();
    expect(svc.updateRecurringTemplate).not.toHaveBeenCalled();
  });
});

describe("deleteRecurringTemplateServerHandler", () => {
  it("checks the mutation rate limit, scopes to userId, and converts the response", async () => {
    vi.mocked(svc.deleteRecurringTemplate).mockResolvedValueOnce(dbRow({ amount: 100 }) as never);

    const result = await deleteRecurringTemplateServerHandler({ id: "r1" }, ctx("u1"));

    expect(result).toEqual(expect.objectContaining({ id: "r1", amount: 1 }));
    expect(svc.deleteRecurringTemplate).toHaveBeenCalledWith("u1", "r1");
  });

  it("does not call the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });

    await expect(deleteRecurringTemplateServerHandler({ id: "r1" }, ctx("u1"))).rejects.toThrow();
    expect(svc.deleteRecurringTemplate).not.toHaveBeenCalled();
  });
});

describe("activateRecurringTemplateServerHandler", () => {
  it("checks the mutation rate limit, scopes to userId, and converts the response", async () => {
    vi.mocked(svc.activateTemplate).mockResolvedValueOnce(dbRow({ amount: 500 }) as never);

    const result = await activateRecurringTemplateServerHandler({ id: "r1" }, ctx("u1"));

    expect(result).toEqual(expect.objectContaining({ id: "r1", amount: 5 }));
    expect(svc.activateTemplate).toHaveBeenCalledWith("u1", "r1");
  });

  it("does not call the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });

    await expect(activateRecurringTemplateServerHandler({ id: "r1" }, ctx("u1"))).rejects.toThrow();
    expect(svc.activateTemplate).not.toHaveBeenCalled();
  });
});

describe("pauseRecurringTemplateServerHandler", () => {
  it("checks the mutation rate limit, scopes to userId, and converts the response", async () => {
    vi.mocked(svc.pauseTemplate).mockResolvedValueOnce(dbRow({ amount: 500 }) as never);

    const result = await pauseRecurringTemplateServerHandler({ id: "r1" }, ctx("u1"));

    expect(result).toEqual(expect.objectContaining({ id: "r1", amount: 5 }));
    expect(svc.pauseTemplate).toHaveBeenCalledWith("u1", "r1");
  });

  it("propagates an InternalError from the service (e.g. pausing an already-paused template) unchanged", async () => {
    vi.mocked(svc.pauseTemplate).mockRejectedValueOnce(
      new InternalError('cannot pause a template in status "paused"'),
    );

    await expect(
      pauseRecurringTemplateServerHandler({ id: "r1" }, ctx("u1")),
    ).rejects.toBeInstanceOf(InternalError);
  });

  it("does not call the service when the mutation rate limit is exceeded", async () => {
    limitSpy.mockResolvedValueOnce({ success: false });

    await expect(pauseRecurringTemplateServerHandler({ id: "r1" }, ctx("u1"))).rejects.toThrow();
    expect(svc.pauseTemplate).not.toHaveBeenCalled();
  });
});

describe("recurringTemplateServerTools", () => {
  it("binds all eight tools for server-side execution", () => {
    expect(recurringTemplateServerTools).toHaveLength(8);
    for (const tool of recurringTemplateServerTools) {
      expect(tool.__toolSide).toBe("server");
      expect(typeof tool.execute).toBe("function");
    }
  });
});
