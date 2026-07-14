import { describe, expect, it } from "vite-plus/test";

import { dollarsToCentsSchema, toDollars } from "@/lib/currency";

describe("dollarsToCentsSchema", () => {
  it("converts dollars to cents", () => {
    expect(dollarsToCentsSchema.parse(9.99)).toBe(999);
    expect(dollarsToCentsSchema.parse(12.5)).toBe(1250);
  });

  it("rejects non-positive amounts", () => {
    expect(dollarsToCentsSchema.safeParse(0).success).toBe(false);
    expect(dollarsToCentsSchema.safeParse(-5).success).toBe(false);
  });
});

describe("toDollars", () => {
  it("converts cents back to dollars", () => {
    expect(toDollars({ amount: 999 }).amount).toBe(9.99);
    expect(toDollars({ amount: 1250 }).amount).toBe(12.5);
  });

  it("round-trips through both directions", () => {
    const cents = dollarsToCentsSchema.parse(42.5);
    expect(toDollars({ amount: cents }).amount).toBe(42.5);
  });

  it("preserves other fields on the row", () => {
    expect(toDollars({ amount: 999, id: "t1" })).toEqual({ amount: 9.99, id: "t1" });
  });
});
