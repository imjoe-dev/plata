import { describe, expect, it } from "vite-plus/test";

import { Category } from "@/lib/schemas/categories";
import { Transaction } from "@/lib/schemas/transactions";
import { RecurringTemplate } from "@/lib/schemas/recurring-templates";

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
