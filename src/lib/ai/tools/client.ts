import { clientTools } from "@tanstack/ai-client";
import { z } from "zod";

import { apiDelete, apiGet, apiGetWithMeta, apiPatch, apiPost } from "@/lib/ai/fetch";
import { toDollars } from "@/lib/currency";
import {
  createTransactionDef,
  CreateTransactionInput,
  deleteTransactionDef,
  getTransactionDef,
  IdInput as TransactionIdInput,
  listTransactionsDef,
  ListTransactionsInput,
  ListTransactionsOutput,
  type TransactionRow,
  updateTransactionDef,
  UpdateTransactionInput,
} from "./transactions";
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

export async function listTransactionsHandler(
  input: z.input<typeof ListTransactionsInput>,
): Promise<z.infer<typeof ListTransactionsOutput>> {
  const { data, meta } = await apiGetWithMeta<TransactionRow[]>("/api/transactions", {
    from: input.from,
    to: input.to,
    type: input.type,
    categoryId: input.categoryId,
    page: input.page,
    limit: input.limit,
  });

  type PaginationMeta = {
    count: number;
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  const paginationMeta = meta as PaginationMeta;

  return {
    transactions: data.map(toDollars),
    page: paginationMeta.page,
    limit: paginationMeta.limit,
    total: paginationMeta.total,
    hasMore: paginationMeta.hasMore,
  };
}

export async function createTransactionHandler(
  input: z.input<typeof CreateTransactionInput>,
): Promise<TransactionRow> {
  const row = await apiPost<TransactionRow>("/api/transactions", input);
  return toDollars(row);
}

export async function getTransactionHandler(
  input: z.input<typeof TransactionIdInput>,
): Promise<TransactionRow> {
  const row = await apiGet<TransactionRow>(`/api/transactions/${input.id}`);
  return toDollars(row);
}

export async function updateTransactionHandler(
  input: z.input<typeof UpdateTransactionInput>,
): Promise<TransactionRow> {
  const { id, ...patch } = input;
  const row = await apiPatch<TransactionRow>(`/api/transactions/${id}`, patch);
  return toDollars(row);
}

export async function deleteTransactionHandler(
  input: z.input<typeof TransactionIdInput>,
): Promise<TransactionRow> {
  const row = await apiDelete<TransactionRow>(`/api/transactions/${input.id}`);
  return toDollars(row);
}

const transactionClientTools = [
  listTransactionsDef.client(listTransactionsHandler),
  createTransactionDef.client(createTransactionHandler),
  getTransactionDef.client(getTransactionHandler),
  updateTransactionDef.client(updateTransactionHandler),
  deleteTransactionDef.client(deleteTransactionHandler),
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

export const allClientTools = clientTools(
  ...transactionClientTools,
  ...recurringTemplateClientTools,
);
