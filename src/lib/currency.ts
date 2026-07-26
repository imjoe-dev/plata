import { z } from "zod";

/** The only currencies Plata supports. Extend this array to add more. */
export const CURRENCY_VALUES = ["USD", "COP"] as const;
export type Currency = (typeof CURRENCY_VALUES)[number];

export const currencySchema = z
  .enum(CURRENCY_VALUES)
  .meta({ description: "Currency code: USD or COP." });

export const dollarsToCentsSchema = z
  .number()
  .positive()
  .transform((v) => Math.round(v * 100));

export function toDollars<T extends { amount: number }>(row: T): T {
  return { ...row, amount: row.amount / 100 };
}
