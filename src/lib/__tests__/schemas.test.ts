import { describe, expect, it } from "vite-plus/test";

import { Category, CategoryPatch } from "@/lib/schemas/categories";
import { Transaction, TransactionPatch, TransactionListQuery } from "@/lib/schemas/transactions";
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
    expect(out.currency).toBe("USD");
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
});

describe("RecurringTemplate schema", () => {
  it("parses a valid template and defaults currency", () => {
    const out = RecurringTemplate.parse({
      amount: 1500,
      type: "expense",
      description: "Rent",
      cadence: "monthly",
      status: "active",
    });
    expect(out.amount).toBe(150000);
    expect(out.currency).toBe("USD");
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
