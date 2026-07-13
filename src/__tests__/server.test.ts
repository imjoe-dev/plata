import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// Mock the framework's default server entry so we can assert `server.ts`
// delegates to it unchanged, without pulling in the real SSR pipeline.
vi.mock("@tanstack/react-start/server-entry", () => {
  const mockHandler = { fetch: vi.fn() };
  return {
    default: mockHandler,
    // Mirrors the real implementation: wraps the given entry's fetch as-is.
    createServerEntry: (entry: { fetch: (...args: Array<unknown>) => unknown }) => ({
      fetch: (...args: Array<unknown>) => entry.fetch(...args),
    }),
  };
});

vi.mock("@/lib/jobs/materialize-recurring", () => ({
  materializeRecurring: vi.fn(),
}));

import handler from "@tanstack/react-start/server-entry";
import { materializeRecurring } from "@/lib/jobs/materialize-recurring";
import serverEntry from "@/server";

describe("src/server.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetch", () => {
    it("delegates the request to the framework's default handler and returns its response unchanged", async () => {
      const request = new Request("https://example.com/");
      const response = new Response("ok", { status: 200 });
      vi.mocked(handler.fetch).mockResolvedValue(response);

      const result = await serverEntry.fetch(request);

      expect(handler.fetch).toHaveBeenCalledOnce();
      expect(handler.fetch).toHaveBeenCalledWith(request);
      expect(result).toBe(response);
    });
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
