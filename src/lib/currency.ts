import { z } from "zod";

export const dollarsToCentsSchema = z
  .number()
  .positive()
  .transform((v) => Math.round(v * 100));

export function toDollars<T extends { amount: number }>(row: T): T {
  return { ...row, amount: row.amount / 100 };
}
