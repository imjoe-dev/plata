import { clientTools } from "@tanstack/ai-client";
import { z } from "zod";

import { apiDelete, apiGet, apiGetWithMeta, apiPatch, apiPost } from "@/lib/ai/fetch";
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

export const allClientTools = clientTools(...categoryClientTools, ...transactionClientTools);
