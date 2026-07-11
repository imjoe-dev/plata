import { describe, expect, it } from "vite-plus/test";

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
});
