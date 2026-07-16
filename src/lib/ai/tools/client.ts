import { clientTools } from "@tanstack/ai-client";
import { z } from "zod";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/ai/fetch";
import { toDollars } from "@/lib/currency";
import {
  createCategoryDef,
  CreateCategoryInput,
  deleteCategoryDef,
  getCategoryDef,
  IdInput as CategoryIdInput,
  listCategoriesDef,
  type CategoryRow,
  UpdateCategoryInput,
  updateCategoryDef,
} from "./categories";
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

export async function listCategoriesHandler(): Promise<CategoryRow[]> {
  return apiGet<CategoryRow[]>("/api/categories");
}

export async function createCategoryHandler(
  input: z.input<typeof CreateCategoryInput>,
): Promise<CategoryRow> {
  return apiPost<CategoryRow>("/api/categories", input);
}

export async function getCategoryHandler(
  input: z.input<typeof CategoryIdInput>,
): Promise<CategoryRow> {
  return apiGet<CategoryRow>(`/api/categories/${input.id}`);
}

export async function updateCategoryHandler(
  input: z.input<typeof UpdateCategoryInput>,
): Promise<CategoryRow> {
  const { id, ...patch } = input;
  return apiPatch<CategoryRow>(`/api/categories/${id}`, patch);
}

export async function deleteCategoryHandler(
  input: z.input<typeof CategoryIdInput>,
): Promise<CategoryRow> {
  return apiDelete<CategoryRow>(`/api/categories/${input.id}`);
}

const categoryClientTools = [
  listCategoriesDef.client(listCategoriesHandler),
  createCategoryDef.client(createCategoryHandler),
  getCategoryDef.client(getCategoryHandler),
  updateCategoryDef.client(updateCategoryHandler),
  deleteCategoryDef.client(deleteCategoryHandler),
] as const;

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

export const allClientTools = clientTools(...categoryClientTools, ...recurringTemplateClientTools);
