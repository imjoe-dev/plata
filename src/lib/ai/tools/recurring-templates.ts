import { toolDefinition, type ToolExecutionContext } from "@tanstack/ai";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { checkRateLimit } from "@/lib/api/http";
import { currencySchema, toDollars } from "@/lib/currency";
import {
  RecurringTemplate,
  RecurringTemplateListQuery,
  RecurringTemplatePatch,
} from "@/lib/schemas/recurring-templates";
import {
  activateTemplate,
  createRecurringTemplate,
  createRecurringTemplates,
  deleteRecurringTemplate,
  getRecurringTemplate,
  listRecurringTemplates,
  pauseTemplate,
  updateRecurringTemplate,
} from "@/lib/services/recurring-templates";
import type { recurring_templates } from "@/db/schema";

import type { ToolContext } from "./context";

export const RecurringTemplateRow = z.object({
  id: z.string(),
  amount: z
    .number()
    .meta({ description: "Amount in major currency units, e.g. 12.50 for $12.50." }),
  currency: currencySchema,
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
  status: RecurringTemplateListQuery.shape.status,
});

export const CreateRecurringTemplateInput = z.object({
  ...RecurringTemplate.shape,
  amount: AmountInput,
  nextDueDate: z.string().nullable().optional().meta({
    description: "Optional ISO date for the next due date.",
  }),
  startDate: z.string().nullable().optional().meta({ description: "Optional ISO start date." }),
  endDate: z.string().nullable().optional().meta({ description: "Optional ISO end date." }),
});

export const CreateRecurringTemplatesInput = z.object({
  templates: z.array(CreateRecurringTemplateInput).min(1).max(20).meta({
    description:
      "1-20 recurring templates to create together in one atomic action — either all are created, or none are.",
  }),
});

export const IdInput = z.object({ id: z.string().meta({ description: "Recurring template id." }) });

export const UpdateRecurringTemplateInput = z.object({
  ...RecurringTemplatePatch.shape,
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

const createRecurringTemplateBase = {
  name: "create_recurring_template",
  description: "Create a new recurring template. Amount is in major currency units.",
  inputSchema: CreateRecurringTemplateInput,
  outputSchema: RecurringTemplateRow,
} as const;

export const createRecurringTemplateDef = toolDefinition({
  ...createRecurringTemplateBase,
  needsApproval: true,
});
/** Session Approval (docs/adr/0006) variant: same tool, no approval gate. */
export const createRecurringTemplateUngatedDef = toolDefinition(createRecurringTemplateBase);

const createRecurringTemplatesBase = {
  name: "create_recurring_templates",
  description:
    "Create 1-20 recurring templates in one atomic action — either all are created, or none are. Prefer create_recurring_template for a single template. Amount is in major currency units.",
  inputSchema: CreateRecurringTemplatesInput,
  outputSchema: z.array(RecurringTemplateRow),
} as const;

export const createRecurringTemplatesDef = toolDefinition({
  ...createRecurringTemplatesBase,
  needsApproval: true,
});
/** Session Approval (docs/adr/0006) variant: same tool, no approval gate. */
export const createRecurringTemplatesUngatedDef = toolDefinition(createRecurringTemplatesBase);

export const getRecurringTemplateDef = toolDefinition({
  name: "get_recurring_template",
  description: "Get a single recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
});

const updateRecurringTemplateBase = {
  name: "update_recurring_template",
  description: "Update an existing recurring template by id. Amount is in major currency units.",
  inputSchema: UpdateRecurringTemplateInput,
  outputSchema: RecurringTemplateRow,
} as const;

export const updateRecurringTemplateDef = toolDefinition({
  ...updateRecurringTemplateBase,
  needsApproval: true,
});
/** Session Approval (docs/adr/0006) variant: same tool, no approval gate. */
export const updateRecurringTemplateUngatedDef = toolDefinition(updateRecurringTemplateBase);

// delete_recurring_template has no ungated variant: deletes always require approval (docs/adr/0006).
export const deleteRecurringTemplateDef = toolDefinition({
  name: "delete_recurring_template",
  description: "Soft-delete a recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
  needsApproval: true,
});

const activateRecurringTemplateBase = {
  name: "activate_recurring_template",
  description: "Activate a paused recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
} as const;

export const activateRecurringTemplateDef = toolDefinition({
  ...activateRecurringTemplateBase,
  needsApproval: true,
});
/** Session Approval (docs/adr/0006) variant: same tool, no approval gate. */
export const activateRecurringTemplateUngatedDef = toolDefinition(activateRecurringTemplateBase);

const pauseRecurringTemplateBase = {
  name: "pause_recurring_template",
  description: "Pause an active recurring template by id.",
  inputSchema: IdInput,
  outputSchema: RecurringTemplateRow,
} as const;

export const pauseRecurringTemplateDef = toolDefinition({
  ...pauseRecurringTemplateBase,
  needsApproval: true,
});
/** Session Approval (docs/adr/0006) variant: same tool, no approval gate. */
export const pauseRecurringTemplateUngatedDef = toolDefinition(pauseRecurringTemplateBase);

type RecurringTemplateDbRow = typeof recurring_templates.$inferSelect;

/**
 * The service layer returns the raw D1 row — date columns as `Date` objects (Drizzle's
 * `timestamp_ms` mode) and `amount` in cents. The tool's output schema is JSON-friendly:
 * ISO date strings and dollars. Serialize dates first, then convert cents to dollars via
 * `toDollars` (shared with the REST-era client handlers this replaces).
 */
function serializeTemplateRow(row: RecurringTemplateDbRow): RecurringTemplateRow {
  return toDollars({
    ...row,
    next_due_date: row.next_due_date?.toISOString() ?? null,
    last_insertion_date: row.last_insertion_date?.toISOString() ?? null,
    start_date: row.start_date?.toISOString() ?? null,
    end_date: row.end_date?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    deleted_at: row.deleted_at?.toISOString() ?? null,
  });
}

export async function listRecurringTemplatesServerHandler(
  input: z.input<typeof ListRecurringTemplatesInput>,
  ctx: ToolExecutionContext<ToolContext>,
): Promise<RecurringTemplateRow[]> {
  const rows = await listRecurringTemplates(ctx.context.userId, { status: input.status });
  return rows.map(serializeTemplateRow);
}

export async function createRecurringTemplateServerHandler(
  input: z.input<typeof CreateRecurringTemplateInput>,
  ctx: ToolExecutionContext<ToolContext>,
): Promise<RecurringTemplateRow> {
  await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
  // Re-parse through the storage schema: the tool input keeps dollars/ISO-string dates for the
  // LLM's benefit, but the service expects cents and Date objects (mirrors what the now-removed
  // REST route did via `parseBody(RecurringTemplate, request)`).
  const payload = RecurringTemplate.parse(input);
  const row = await createRecurringTemplate(ctx.context.userId, payload);
  return serializeTemplateRow(row);
}

export async function createRecurringTemplatesServerHandler(
  input: z.input<typeof CreateRecurringTemplatesInput>,
  ctx: ToolExecutionContext<ToolContext>,
): Promise<RecurringTemplateRow[]> {
  await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
  const payloads = input.templates.map((t) => RecurringTemplate.parse(t));
  const rows = await createRecurringTemplates(ctx.context.userId, payloads);
  return rows.map(serializeTemplateRow);
}

export async function getRecurringTemplateServerHandler(
  input: z.input<typeof IdInput>,
  ctx: ToolExecutionContext<ToolContext>,
): Promise<RecurringTemplateRow> {
  const row = await getRecurringTemplate(ctx.context.userId, input.id);
  return serializeTemplateRow(row);
}

export async function updateRecurringTemplateServerHandler(
  input: z.input<typeof UpdateRecurringTemplateInput>,
  ctx: ToolExecutionContext<ToolContext>,
): Promise<RecurringTemplateRow> {
  await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
  const { id, ...rest } = input;
  const patch = RecurringTemplatePatch.parse(rest);
  const row = await updateRecurringTemplate(ctx.context.userId, id, patch);
  return serializeTemplateRow(row);
}

export async function deleteRecurringTemplateServerHandler(
  input: z.input<typeof IdInput>,
  ctx: ToolExecutionContext<ToolContext>,
): Promise<RecurringTemplateRow> {
  await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
  const row = await deleteRecurringTemplate(ctx.context.userId, input.id);
  return serializeTemplateRow(row);
}

export async function activateRecurringTemplateServerHandler(
  input: z.input<typeof IdInput>,
  ctx: ToolExecutionContext<ToolContext>,
): Promise<RecurringTemplateRow> {
  await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
  const row = await activateTemplate(ctx.context.userId, input.id);
  return serializeTemplateRow(row);
}

export async function pauseRecurringTemplateServerHandler(
  input: z.input<typeof IdInput>,
  ctx: ToolExecutionContext<ToolContext>,
): Promise<RecurringTemplateRow> {
  await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
  const row = await pauseTemplate(ctx.context.userId, input.id);
  return serializeTemplateRow(row);
}

export const recurringTemplateServerTools = [
  listRecurringTemplatesDef.server<ToolContext>(listRecurringTemplatesServerHandler),
  createRecurringTemplateDef.server<ToolContext>(createRecurringTemplateServerHandler),
  createRecurringTemplatesDef.server<ToolContext>(createRecurringTemplatesServerHandler),
  getRecurringTemplateDef.server<ToolContext>(getRecurringTemplateServerHandler),
  updateRecurringTemplateDef.server<ToolContext>(updateRecurringTemplateServerHandler),
  deleteRecurringTemplateDef.server<ToolContext>(deleteRecurringTemplateServerHandler),
  activateRecurringTemplateDef.server<ToolContext>(activateRecurringTemplateServerHandler),
  pauseRecurringTemplateDef.server<ToolContext>(pauseRecurringTemplateServerHandler),
] as const;

/**
 * Session Approval (docs/adr/0006) variant: create/create_recurring_templates/update/activate/pause ungated,
 * delete still gated. Selected instead of `recurringTemplateServerTools` by the chat route when
 * a Chat Session has granted Session Approval — built once here at module scope, not per request.
 */
export const recurringTemplateServerToolsApproved = [
  listRecurringTemplatesDef.server<ToolContext>(listRecurringTemplatesServerHandler),
  createRecurringTemplateUngatedDef.server<ToolContext>(createRecurringTemplateServerHandler),
  createRecurringTemplatesUngatedDef.server<ToolContext>(createRecurringTemplatesServerHandler),
  getRecurringTemplateDef.server<ToolContext>(getRecurringTemplateServerHandler),
  updateRecurringTemplateUngatedDef.server<ToolContext>(updateRecurringTemplateServerHandler),
  deleteRecurringTemplateDef.server<ToolContext>(deleteRecurringTemplateServerHandler),
  activateRecurringTemplateUngatedDef.server<ToolContext>(activateRecurringTemplateServerHandler),
  pauseRecurringTemplateUngatedDef.server<ToolContext>(pauseRecurringTemplateServerHandler),
] as const;
