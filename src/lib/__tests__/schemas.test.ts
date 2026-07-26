import { describe, expect, it } from "vite-plus/test";

import { Category, CategoryPatch } from "@/lib/schemas/categories";
import { Transaction, TransactionPatch, TransactionListQuery } from "@/lib/schemas/transactions";
import type { Pagination, PaginatedListResult } from "@/lib/schemas/transactions";
import {
  RecurringTemplate,
  RecurringTemplatePatch,
  RecurringTemplateListQuery,
} from "@/lib/schemas/recurring-templates";

describe("Category schema", () => {
  it("parses a valid category", () => {
    const out = Category.parse({ name: "Groceries", type: "expense" });
    expect(out).toEqual({ name: "Groceries", type: "expense" });
  });

  it("rejects an invalid type", () => {
    expect(() => Category.parse({ name: "X", type: "nope" })).toThrow();
  });
});

describe("Transaction schema", () => {
  it("coerces decimal amount to cents", () => {
    const out = Transaction.parse({
      amount: 12.34,
      type: "expense",
      description: "Lunch",
      date: new Date("2026-07-01"),
      source: "manual",
    });
    expect(out.amount).toBe(1234);
  });

  it("leaves currency undefined when omitted — the service layer resolves the default", () => {
    const out = Transaction.parse({
      amount: 1,
      type: "expense",
      description: "Lunch",
      date: new Date("2026-07-01"),
      source: "manual",
    });
    expect(out.currency).toBeUndefined();
  });

  it("rejects negative amount", () => {
    expect(() =>
      Transaction.parse({
        amount: -5,
        type: "expense",
        description: "x",
        date: new Date(),
        source: "manual",
      }),
    ).toThrow();
  });

  it("rejects an unsupported currency", () => {
    expect(() =>
      Transaction.parse({
        amount: 5,
        currency: "EUR",
        type: "expense",
        description: "x",
        date: new Date(),
        source: "manual",
      }),
    ).toThrow();
  });

  it("rejects an unsupported currency on patch", () => {
    expect(() => TransactionPatch.parse({ currency: "EUR" })).toThrow();
  });
});

describe("RecurringTemplate schema", () => {
  it("parses a valid template", () => {
    const out = RecurringTemplate.parse({
      amount: 1500,
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
    });
    expect(out.amount).toBe(150000);
  });

  it("leaves currency undefined when omitted — the service layer resolves the default", () => {
    const out = RecurringTemplate.parse({
      amount: 10,
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
    });
    expect(out.currency).toBeUndefined();
  });

  it("rejects an unknown cadence", () => {
    expect(() =>
      RecurringTemplate.parse({
        amount: 10,
        type: "income",
        description: "x",
        cadence: "fortnightly",
        status: "active",
      }),
    ).toThrow();
  });

  it("rejects an unsupported currency", () => {
    expect(() =>
      RecurringTemplate.parse({
        amount: 10,
        currency: "EUR",
        type: "income",
        description: "x",
        cadence: "monthly",
        status: "active",
      }),
    ).toThrow();
  });

  it("rejects an unsupported currency on patch", () => {
    expect(() => RecurringTemplatePatch.parse({ currency: "EUR" })).toThrow();
  });
});

describe("Transaction schema — wire readiness", () => {
  it("coerces an ISO date string to a Date", () => {
    const out = Transaction.parse({
      amount: 10,
      type: "expense",
      description: "x",
      date: "2026-07-01T00:00:00.000Z",
      source: "manual",
    });
    expect(out.date).toBeInstanceOf(Date);
  });

  it("TransactionPatch accepts a partial body", () => {
    expect(TransactionPatch.parse({ description: "Y" })).toEqual({ description: "Y" });
  });

  it("TransactionListQuery coerces from/to and validates type", () => {
    const out = TransactionListQuery.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-12-31T00:00:00.000Z",
      type: "income",
      categoryId: "c1",
    });
    expect(out.from).toBeInstanceOf(Date);
    expect(out.to).toBeInstanceOf(Date);
    expect(out.type).toBe("income");
  });

  it("TransactionListQuery rejects an unknown type", () => {
    expect(() => TransactionListQuery.parse({ type: "nope" })).toThrow();
  });
});

describe("TransactionListQuery — null/empty preprocessing", () => {
  it("treats from: null as absent", () => {
    const out = TransactionListQuery.parse({ from: null });
    expect(out.from).toBeUndefined();
  });

  it("treats to: null as absent", () => {
    const out = TransactionListQuery.parse({ to: null });
    expect(out.to).toBeUndefined();
  });

  it("treats type: null as absent", () => {
    const out = TransactionListQuery.parse({ type: null });
    expect(out.type).toBeUndefined();
  });

  it("treats categoryId: '' as absent", () => {
    const out = TransactionListQuery.parse({ categoryId: "" });
    expect(out.categoryId).toBeUndefined();
  });

  it("treats categoryId: null as absent", () => {
    const out = TransactionListQuery.parse({ categoryId: null });
    expect(out.categoryId).toBeUndefined();
  });

  it("treats from: '' as absent (no date-parsing error)", () => {
    const out = TransactionListQuery.parse({ from: "" });
    expect(out.from).toBeUndefined();
  });

  it("treats to: '' as absent (no date-parsing error)", () => {
    const out = TransactionListQuery.parse({ to: "" });
    expect(out.to).toBeUndefined();
  });

  it("treats type: '' as absent", () => {
    const out = TransactionListQuery.parse({ type: "" });
    expect(out.type).toBeUndefined();
  });

  it("still rejects an invalid enum value for type", () => {
    expect(() => TransactionListQuery.parse({ type: "invalid" })).toThrow();
  });

  it("still rejects a malformed date for from/to", () => {
    expect(() => TransactionListQuery.parse({ from: "not-a-date" })).toThrow();
    expect(() => TransactionListQuery.parse({ to: "not-a-date" })).toThrow();
  });

  it("treats an all-null filter payload as no filters (the chat-tool crash case)", () => {
    const out = TransactionListQuery.parse({ from: null, to: null, type: null, categoryId: null });
    expect(out.from).toBeUndefined();
    expect(out.to).toBeUndefined();
    expect(out.type).toBeUndefined();
    expect(out.categoryId).toBeUndefined();
  });

  it("passes through valid values unchanged", () => {
    const out = TransactionListQuery.parse({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T00:00:00.000Z",
      type: "expense",
      categoryId: "cat_1",
    });
    expect(out.from).toBeInstanceOf(Date);
    expect(out.to).toBeInstanceOf(Date);
    expect(out.type).toBe("expense");
    expect(out.categoryId).toBe("cat_1");
  });
});

describe("TransactionListQuery — pagination fields", () => {
  it("coerces page and limit from query-string values", () => {
    const out = TransactionListQuery.parse({ page: "2", limit: "10" });
    expect(out.page).toBe(2);
    expect(out.limit).toBe(10);
  });

  it("leaves page and limit undefined when omitted", () => {
    const out = TransactionListQuery.parse({});
    expect(out.page).toBeUndefined();
    expect(out.limit).toBeUndefined();
  });

  it("treats page: null and limit: '' as absent", () => {
    const out = TransactionListQuery.parse({ page: null, limit: "" });
    expect(out.page).toBeUndefined();
    expect(out.limit).toBeUndefined();
  });

  it("rejects a non-positive page", () => {
    expect(() => TransactionListQuery.parse({ page: "0" })).toThrow();
    expect(() => TransactionListQuery.parse({ page: "-1" })).toThrow();
  });

  it("rejects a limit outside the 1-100 range", () => {
    expect(() => TransactionListQuery.parse({ limit: "0" })).toThrow();
    expect(() => TransactionListQuery.parse({ limit: "101" })).toThrow();
  });
});

describe("RecurringTemplate schema — wire readiness", () => {
  it("coerces an ISO date string for nextDueDate", () => {
    const out = RecurringTemplate.parse({
      amount: 100,
      type: "expense",
      description: "x",
      cadence: "monthly",
      status: "active",
      nextDueDate: "2026-08-01T00:00:00.000Z",
    });
    expect(out.nextDueDate).toBeInstanceOf(Date);
  });

  it("RecurringTemplatePatch accepts a partial body", () => {
    expect(RecurringTemplatePatch.parse({ status: "paused" })).toEqual({ status: "paused" });
  });

  it("RecurringTemplateListQuery validates status", () => {
    expect(RecurringTemplateListQuery.parse({ status: "active" }).status).toBe("active");
    expect(() => RecurringTemplateListQuery.parse({ status: "nope" })).toThrow();
  });
});

describe("CategoryPatch", () => {
  it("accepts a partial body", () => {
    expect(CategoryPatch.parse({ name: "B" })).toEqual({ name: "B" });
  });
});

describe("Pagination type", () => {
  it("instantiates with valid page and limit values", () => {
    const pagination: Pagination = {
      page: 1,
      limit: 20,
    };
    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBe(20);
  });

  it("accepts various valid page and limit combinations", () => {
    const pagination1: Pagination = { page: 2, limit: 50 };
    expect(pagination1.page).toBe(2);
    expect(pagination1.limit).toBe(50);

    const pagination2: Pagination = { page: 100, limit: 1 };
    expect(pagination2.page).toBe(100);
    expect(pagination2.limit).toBe(1);
  });
});

describe("PaginatedListResult type", () => {
  it("instantiates with generic Transaction type", () => {
    const result: PaginatedListResult<typeof Transaction> = {
      rows: [],
      total: 0,
    };
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("instantiates with sample transaction rows and total count", () => {
    const sampleTransaction = {
      amount: 1234,
      currency: "USD",
      type: "expense" as const,
      description: "Coffee",
      date: new Date("2026-07-01"),
      categoryId: "cat_1",
      recurringTemplateId: null,
      source: "manual" as const,
      notes: null,
    };

    const result: PaginatedListResult<typeof sampleTransaction> = {
      rows: [sampleTransaction],
      total: 50,
    };
    expect(result.rows).toHaveLength(1);
    expect(result.total).toBe(50);
    expect(result.rows[0]).toEqual(sampleTransaction);
  });

  it("instantiates with multiple rows and various totals", () => {
    interface SimpleRow {
      id: string;
      value: number;
    }

    const result: PaginatedListResult<SimpleRow> = {
      rows: [
        { id: "1", value: 100 },
        { id: "2", value: 200 },
      ],
      total: 100,
    };
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(100);
  });

  it("instantiates with empty rows but non-zero total (out-of-bounds page)", () => {
    interface Item {
      id: number;
    }

    const result: PaginatedListResult<Item> = {
      rows: [],
      total: 25,
    };
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(25);
  });
});
