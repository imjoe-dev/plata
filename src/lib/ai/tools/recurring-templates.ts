import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import {
  RecurringTemplate,
  RecurringTemplateListQuery,
  RecurringTemplatePatch,
} from "@/lib/schemas/recurring-templates";

export const RecurringTemplateRow = z.object({
  id: z.string(),
  amount: z
    .number()
    .meta({ description: "Amount in major currency units, e.g. 12.50 for $12.50." }),
  currency: z.string(),
  type: z.enum(["expense", "income"]),
  description: z.string(),
  category_id: z.string().nullable(),
  cadence: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  next_due_date: z.string().nullable(),
  last_insertion_date: z.string().nullable(),
  status: z.enum(["active", "paused", "completed", "failed"]),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type RecurringTemplateRow = z.infer<typeof RecurringTemplateRow>;

const AmountInput = z
  .number()
  .positive()
  .meta({ description: "Amount in major currency units, e.g. 12.50 for $12.50." });

export const ListRecurringTemplatesInput = z.object({
  status: RecurringTemplateListQuery.shape.status?.meta({
    description: "Filter by status: active, paused, completed, or failed.",
  }),
});

export const CreateRecurringTemplateInput = RecurringTemplate.omit({ amount: true }).extend({
  amount: AmountInput,
  currency: RecurringTemplate.shape.currency.meta({ description: "ISO 4217 currency code." }),
  type: RecurringTemplate.shape.type.meta({ description: "expense or income." }),
  description: RecurringTemplate.shape.description.meta({
    description: "Human-readable description.",
  }),
  categoryId: RecurringTemplate.shape.categoryId?.meta({ description: "Optional category id." }),
  cadence: RecurringTemplate.shape.cadence.meta({
    description: "How often the template recurs.",
  }),
  nextDueDate: z.string().nullable().optional().meta({
    description: "Optional ISO date for the next due date.",
  }),
  status: RecurringTemplate.shape.status.meta({ description: "Template status." }),
  startDate: z.string().nullable().optional().meta({ description: "Optional ISO start date." }),
  endDate: z.string().nullable().optional().meta({ description: "Optional ISO end date." }),
});

export const IdInput = z.object({ id: z.string().meta({ description: "Recurring template id." }) });

export const UpdateRecurringTemplateInput = RecurringTemplatePatch.omit({
  amount: true,
  nextDueDate: true,
  startDate: true,
  endDate: true,
}).extend({
  id: z.string().meta({ description: "Recurring template id." }),
  amount: AmountInput.optional(),
  nextDueDate: z.string().nullable().optional().meta({
    description: "Optional ISO date for the next due date.",
  }),
  startDate: z.string().nullable().optional().meta({ description: "Optional ISO start date." }),
  endDate: z.string().nullable().optional().meta({ description: "Optional ISO end date." }),
});

export const listRecurringTemplatesDef = toolDefinition({
  name: "list_recurring_templates",
  description: "List recurring templates for the current user, optionally filtered by status.",
  inputSchema: ListRecurringTemplatesInput,
  outputSchema: z.array(RecurringTemplateRow),
});

export const createRecurringTemplateDef = toolDefinition({
  name: "create_recurring_template",
  description: "Create a new recurring template. Amount is in major currency units.",
  inputSchema: CreateRecurringTemplateInput,
  outputSchema: RecurringTemplateRow,
  needsApproval: true,
});

export const getRecurringTemplateDef = toolDefinition({
  name: "get_recurring_template",
  description: "Get a single recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
});

export const updateRecurringTemplateDef = toolDefinition({
  name: "update_recurring_template",
  description: "Update an existing recurring template by id. Amount is in major currency units.",
  inputSchema: UpdateRecurringTemplateInput,
  outputSchema: RecurringTemplateRow,
  needsApproval: true,
});

export const deleteRecurringTemplateDef = toolDefinition({
  name: "delete_recurring_template",
  description: "Soft-delete a recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
  needsApproval: true,
});

export const activateRecurringTemplateDef = toolDefinition({
  name: "activate_recurring_template",
  description: "Activate a paused recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
  needsApproval: true,
});

export const pauseRecurringTemplateDef = toolDefinition({
  name: "pause_recurring_template",
  description: "Pause an active recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
  needsApproval: true,
});

export const recurringTemplateToolDefs = [
  listRecurringTemplatesDef,
  createRecurringTemplateDef,
  getRecurringTemplateDef,
  updateRecurringTemplateDef,
  deleteRecurringTemplateDef,
  activateRecurringTemplateDef,
  pauseRecurringTemplateDef,
] as const;
