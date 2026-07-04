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
  nextDueDate: z.coerce.date().nullable().optional(),
  status: z.enum(["active", "paused", "completed", "failed"]),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export type RecurringTemplate = z.infer<typeof RecurringTemplate>;

export const RecurringTemplatePatch = RecurringTemplate.omit({ currency: true })
  .partial()
  .extend({ currency: z.string().length(3).optional() });

export type RecurringTemplatePatch = z.infer<typeof RecurringTemplatePatch>;

export const RecurringTemplateListQuery = z.object({
  status: z.enum(["active", "paused", "completed", "failed"]).optional(),
});

export type RecurringTemplateListQuery = z.infer<typeof RecurringTemplateListQuery>;
