import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// The framework's own createServerEntry pulls in the real SSR pipeline; stubbed out here just
// so importing @/server doesn't drag that in. Not used to assert any fetch behavior.
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: vi.fn() },
  createServerEntry: (entry: unknown) => entry,
}));

vi.mock("@/lib/jobs/materialize-recurring", () => ({
  materializeRecurring: vi.fn(),
}));

import { materializeRecurring } from "@/lib/jobs/materialize-recurring";
import serverEntry from "@/server";

describe("src/server.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scheduled", () => {
    it("delegates the scheduled event to materializeRecurring with the same arguments", async () => {
      vi.mocked(materializeRecurring).mockResolvedValue(undefined);

      const controller = {
        scheduledTime: Date.now(),
        cron: "0 * * * *",
        noRetry: vi.fn(),
      } as unknown as ScheduledController;
      const env = {} as Env;
      const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;

      // Calling this without it rejecting/throwing is itself part of what we're proving.
      await serverEntry.scheduled(controller, env, ctx);

      expect(materializeRecurring).toHaveBeenCalledOnce();
      expect(materializeRecurring).toHaveBeenCalledWith(controller, env, ctx);
    });
  });
});
