import { z } from "zod";

export const Transaction = z.object({
  amount: z
    .number()
    .positive()
    .transform((v) => Math.round(v * 100)),
  currency: z.string().length(3).default("USD"),
  type: z.enum(["expense", "income"]),
  description: z.string().min(1),
  date: z.coerce.date(),
  categoryId: z.string().nullable().optional(),
  recurringTemplateId: z.string().nullable().optional(),
  source: z.enum(["manual", "chat", "csv_import"]),
  notes: z.string().nullable().optional(),
});

export type Transaction = z.infer<typeof Transaction>;

export const TransactionPatch = Transaction.omit({ currency: true })
  .partial()
  .extend({ currency: z.string().length(3).optional() });

export type TransactionPatch = z.infer<typeof TransactionPatch>;

export const TransactionListQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.enum(["expense", "income"]).optional(),
  categoryId: z.string().optional(),
});

export type TransactionListQuery = z.infer<typeof TransactionListQuery>;
