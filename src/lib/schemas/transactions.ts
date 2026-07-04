import { z } from "zod";

export const Transaction = z.object({
  amount: z
    .number()
    .positive()
    .transform((v) => Math.round(v * 100)),
  currency: z.string().length(3).default("USD"),
  type: z.enum(["expense", "income"]),
  description: z.string().min(1),
  date: z.date(),
  categoryId: z.string().nullable().optional(),
  recurringTemplateId: z.string().nullable().optional(),
  source: z.enum(["manual", "chat", "csv_import"]),
  notes: z.string().nullable().optional(),
});

export type Transaction = z.infer<typeof Transaction>;
