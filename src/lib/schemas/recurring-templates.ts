import { z } from "zod";

import { currencySchema, dollarsToCentsSchema } from "@/lib/currency";

export const RecurringTemplate = z.object({
  amount: dollarsToCentsSchema,
  // No default here: an omitted currency is resolved by the service layer from the user's
  // default_currency (see createCurrencyResolver in services/user-preferences.ts), not by Zod.
  currency: currencySchema.optional(),
  type: z.enum(["expense", "income"]).meta({ description: "expense or income." }),
  description: z.string().min(1).meta({ description: "Human-readable description." }),
  categoryId: z.string().nullable().optional().meta({ description: "Optional category id." }),
  cadence: z
    .enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"])
    .meta({ description: "How often the template recurs." }),
  nextDueDate: z.coerce.date().nullable().optional(),
  status: z
    .enum(["active", "paused", "completed", "failed"])
    .meta({ description: "Template status." }),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export type RecurringTemplate = z.infer<typeof RecurringTemplate>;

export const RecurringTemplatePatch = RecurringTemplate.partial();

export type RecurringTemplatePatch = z.infer<typeof RecurringTemplatePatch>;

export const RecurringTemplateListQuery = z.object({
  status: z
    .enum(["active", "paused", "completed", "failed"])
    .optional()
    .meta({ description: "Filter by status: active, paused, completed, or failed." }),
});

export type RecurringTemplateListQuery = z.infer<typeof RecurringTemplateListQuery>;
