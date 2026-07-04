import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { runBatch } from "@/lib/db/transaction";

const batch = vi.fn();
vi.mock("@/db", () => ({
  getDB: () => ({ batch }),
}));

beforeEach(() => {
  batch.mockReset();
});

describe("runBatch", () => {
  it("resolves with success when db.batch resolves", async () => {
    batch.mockResolvedValueOnce(undefined);
    const stmt = { query: "insert" };
    await expect(runBatch([stmt])).resolves.toEqual({ success: true });
    expect(batch).toHaveBeenCalledWith([stmt]);
  });

  it("throws InternalError wrapping the underlying error when db.batch rejects", async () => {
    const cause = new Error("D1 batch failed");
    batch.mockRejectedValueOnce(cause);
    await expect(runBatch([{ query: "update" }])).rejects.toMatchObject({
      name: "InternalError",
      status: 500,
      cause,
    });
  });
});
