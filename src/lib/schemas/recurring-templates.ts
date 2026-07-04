import { z } from "zod";

export const RecurringTemplate = z.object({
  amount: z
    .number()
    .positive()
    .transform((v) => Math.round(v * 100)),
  currency: z.string().length(3).default("USD"),
  type: z.enum(["expense", "income"]),
  description: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  cadence: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  nextDueDate: z.date().nullable().optional(),
  status: z.enum(["active", "paused", "completed", "failed"]),
  startDate: z.date().nullable().optional(),
  endDate: z.date().nullable().optional(),
});

export type RecurringTemplate = z.infer<typeof RecurringTemplate>;
