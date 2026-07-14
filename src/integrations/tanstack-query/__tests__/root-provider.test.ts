import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/components/ui/toast-manager", () => ({
  toastManager: { add: vi.fn() },
}));

import { toastManager } from "@/components/ui/toast-manager";
import { getContext } from "@/integrations/tanstack-query/root-provider";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getContext", () => {
  it("bridges query errors to an error-variant toast", async () => {
    const { queryClient } = getContext();

    await queryClient
      .fetchQuery({
        queryKey: ["boom-query"],
        queryFn: () => {
          throw new Error("You're doing that too fast");
        },
        retry: false,
      })
      .catch(() => {});

    expect(toastManager.add).toHaveBeenCalledWith({
      title: "You're doing that too fast",
      data: { variant: "error" },
    });
  });

  it("bridges mutation errors to an error-variant toast", async () => {
    const { queryClient } = getContext();

    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationFn: () => {
          throw new Error("You're doing that too fast");
        },
      })
      .execute(undefined)
      .catch(() => {});

    expect(toastManager.add).toHaveBeenCalledWith({
      title: "You're doing that too fast",
      data: { variant: "error" },
    });
  });
});
