import { convertSchemaToJsonSchema } from "@tanstack/ai";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("cloudflare:workers", () => ({
  env: { MUTATION_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } },
}));

import {
  TransactionRow,
  createTransactionDef,
  deleteTransactionDef,
  getTransactionDef,
  listTransactionsDef,
  updateTransactionDef,
} from "@/lib/ai/tools/transactions";

describe("transactions tool definitions", () => {
  it("exposes five tools with stable names", () => {
    expect(listTransactionsDef.name).toBe("list_transactions");
    expect(createTransactionDef.name).toBe("create_transaction");
    expect(getTransactionDef.name).toBe("get_transaction");
    expect(updateTransactionDef.name).toBe("update_transaction");
    expect(deleteTransactionDef.name).toBe("delete_transaction");
  });

  it("create_transaction accepts a positive amount in major units and does NOT transform to cents", () => {
    const parsed = createTransactionDef.inputSchema!.safeParse({
      amount: 9.99,
      type: "expense",
      description: "Lunch",
      date: "2026-07-01T00:00:00.000Z",
      source: "manual",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(9.99);
      expect(parsed.data.currency).toBe("USD");
    }
  });

  it("create_transaction rejects a non-positive amount", () => {
    const parsed = createTransactionDef.inputSchema!.safeParse({
      amount: -5,
      type: "expense",
      description: "x",
      date: "2026-07-01T00:00:00.000Z",
      source: "manual",
    });
    expect(parsed.success).toBe(false);
  });

  it("create_transaction defaults source to 'chat' when omitted", () => {
    const parsed = createTransactionDef.inputSchema!.safeParse({
      amount: 10,
      type: "expense",
      description: "x",
      date: "2026-07-01T00:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.source).toBe("chat");
  });

  it("list_transactions accepts optional date/type/categoryId filters", () => {
    expect(
      listTransactionsDef.inputSchema!.safeParse({
        from: "2026-01-01T00:00:00.000Z",
        type: "income",
      }).success,
    ).toBe(true);
    expect(listTransactionsDef.inputSchema!.safeParse({ type: "nope" }).success).toBe(false);
  });

  it("list_transactions treats null from/to as not provided", () => {
    const parsed = listTransactionsDef.inputSchema!.safeParse({ from: null, to: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.from).toBeUndefined();
      expect(parsed.data.to).toBeUndefined();
    }
  });

  it("list_transactions treats empty-string from/to as not provided", () => {
    const parsed = listTransactionsDef.inputSchema!.safeParse({ from: "", to: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.from).toBeUndefined();
      expect(parsed.data.to).toBeUndefined();
    }
  });

  it("list_transactions treats null page/limit as not provided", () => {
    const parsed = listTransactionsDef.inputSchema!.safeParse({ page: null, limit: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBeUndefined();
      expect(parsed.data.limit).toBeUndefined();
    }
  });

  it("list_transactions accepts optional page/limit as positive integers", () => {
    const parsed = listTransactionsDef.inputSchema!.safeParse({ page: 2, limit: 50 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.limit).toBe(50);
    }
  });

  it("list_transactions accepts a request with no filters or pagination at all", () => {
    expect(listTransactionsDef.inputSchema!.safeParse({}).success).toBe(true);
  });

  it("list_transactions rejects a non-positive page and an out-of-range limit", () => {
    expect(listTransactionsDef.inputSchema!.safeParse({ page: 0 }).success).toBe(false);
    expect(listTransactionsDef.inputSchema!.safeParse({ limit: 0 }).success).toBe(false);
    expect(listTransactionsDef.inputSchema!.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("generates a JSON schema for the LLM where type keeps its enum constraint", () => {
    const jsonSchema = convertSchemaToJsonSchema(listTransactionsDef.inputSchema) as {
      properties: Record<string, { type?: string; enum?: unknown[] }>;
    };
    expect(jsonSchema.properties.type?.enum).toEqual(["expense", "income"]);
    expect(jsonSchema.properties.type?.type).toBe("string");
    expect(jsonSchema.properties.page?.type).toBe("integer");
    expect(jsonSchema.properties.limit?.type).toBe("integer");
  });

  it("update_transaction requires an id and makes amount optional", () => {
    expect(updateTransactionDef.inputSchema!.safeParse({ id: "t1" }).success).toBe(true);
    expect(updateTransactionDef.inputSchema!.safeParse({ id: "t1", amount: 5 }).success).toBe(true);
    expect(updateTransactionDef.inputSchema!.safeParse({ amount: 5 }).success).toBe(false);
  });

  it("TransactionRow validates a row and reports amount in major units", () => {
    const row = {
      id: "t1",
      amount: 9.99,
      currency: "USD",
      type: "expense",
      description: "Lunch",
      date: "2026-07-01T00:00:00.000Z",
      category_id: null,
      user_id: "u1",
      recurring_template_id: null,
      source: "chat",
      notes: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
    };
    expect(TransactionRow.safeParse(row).success).toBe(true);
  });

  it("mutating tools (create, update, delete) have needsApproval set to true", () => {
    expect(createTransactionDef.needsApproval).toBe(true);
    expect(updateTransactionDef.needsApproval).toBe(true);
    expect(deleteTransactionDef.needsApproval).toBe(true);
  });

  it("read-only tools (list, get) have no needsApproval field", () => {
    expect(listTransactionsDef.needsApproval).toBeUndefined();
    expect(getTransactionDef.needsApproval).toBeUndefined();
  });

  it("list_transactions output schema returns a paginated result object", () => {
    const output = {
      transactions: [
        {
          id: "t1",
          amount: 9.99,
          currency: "USD",
          type: "expense",
          description: "Lunch",
          date: "2026-07-01T00:00:00.000Z",
          category_id: null,
          user_id: "u1",
          recurring_template_id: null,
          source: "chat",
          notes: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      page: 1,
      limit: 20,
      total: 50,
      hasMore: true,
    };
    const parsed = listTransactionsDef.outputSchema!.safeParse(output);
    expect(parsed.success).toBe(true);
  });

  it("list_transactions output schema validates hasMore as boolean", () => {
    const output = {
      transactions: [],
      page: 1,
      limit: 20,
      total: 0,
      hasMore: false,
    };
    const parsed = listTransactionsDef.outputSchema!.safeParse(output);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hasMore).toBe(false);
    }
  });
});
