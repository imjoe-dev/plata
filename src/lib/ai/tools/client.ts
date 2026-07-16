import { clientTools } from "@tanstack/ai-client";
import { z } from "zod";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/ai/fetch";
import { toDollars } from "@/lib/currency";
import {
  activateRecurringTemplateDef,
  createRecurringTemplateDef,
  CreateRecurringTemplateInput,
  deleteRecurringTemplateDef,
  getRecurringTemplateDef,
  IdInput as RecurringTemplateIdInput,
  listRecurringTemplatesDef,
  ListRecurringTemplatesInput,
  pauseRecurringTemplateDef,
  type RecurringTemplateRow,
  updateRecurringTemplateDef,
  UpdateRecurringTemplateInput,
} from "./recurring-templates";

export async function listRecurringTemplatesHandler(
  input: z.input<typeof ListRecurringTemplatesInput>,
): Promise<RecurringTemplateRow[]> {
  const rows = await apiGet<RecurringTemplateRow[]>("/api/recurring-templates", {
    status: input.status,
  });
  return rows.map(toDollars);
}

export async function createRecurringTemplateHandler(
  input: z.input<typeof CreateRecurringTemplateInput>,
): Promise<RecurringTemplateRow> {
  const row = await apiPost<RecurringTemplateRow>("/api/recurring-templates", input);
  return toDollars(row);
}

export async function getRecurringTemplateHandler(
  input: z.input<typeof RecurringTemplateIdInput>,
): Promise<RecurringTemplateRow> {
  const row = await apiGet<RecurringTemplateRow>(`/api/recurring-templates/${input.id}`);
  return toDollars(row);
}

export async function updateRecurringTemplateHandler(
  input: z.input<typeof UpdateRecurringTemplateInput>,
): Promise<RecurringTemplateRow> {
  const { id, ...patch } = input;
  const row = await apiPatch<RecurringTemplateRow>(`/api/recurring-templates/${id}`, patch);
  return toDollars(row);
}

export async function deleteRecurringTemplateHandler(
  input: z.input<typeof RecurringTemplateIdInput>,
): Promise<RecurringTemplateRow> {
  const row = await apiDelete<RecurringTemplateRow>(`/api/recurring-templates/${input.id}`);
  return toDollars(row);
}

export async function activateRecurringTemplateHandler(
  input: z.input<typeof RecurringTemplateIdInput>,
): Promise<RecurringTemplateRow> {
  const row = await apiPost<RecurringTemplateRow>(
    `/api/recurring-templates/${input.id}/activate`,
    undefined,
  );
  return toDollars(row);
}

export async function pauseRecurringTemplateHandler(
  input: z.input<typeof RecurringTemplateIdInput>,
): Promise<RecurringTemplateRow> {
  const row = await apiPost<RecurringTemplateRow>(
    `/api/recurring-templates/${input.id}/pause`,
    undefined,
  );
  return toDollars(row);
}

const recurringTemplateClientTools = [
  listRecurringTemplatesDef.client(listRecurringTemplatesHandler),
  createRecurringTemplateDef.client(createRecurringTemplateHandler),
  getRecurringTemplateDef.client(getRecurringTemplateHandler),
  updateRecurringTemplateDef.client(updateRecurringTemplateHandler),
  deleteRecurringTemplateDef.client(deleteRecurringTemplateHandler),
  activateRecurringTemplateDef.client(activateRecurringTemplateHandler),
  pauseRecurringTemplateDef.client(pauseRecurringTemplateHandler),
] as const;

export const allClientTools = clientTools(...recurringTemplateClientTools);
