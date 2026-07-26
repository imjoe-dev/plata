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
  it("resolves with the per-statement results when db.batch resolves", async () => {
    const results = [{ id: "row1" }, { id: "row2" }];
    batch.mockResolvedValueOnce(results);
    const stmts = [{ query: "insert" }, { query: "insert" }];
    await expect(runBatch(stmts)).resolves.toEqual(results);
    expect(batch).toHaveBeenCalledWith(stmts);
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
