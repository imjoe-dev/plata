import { clientTools } from "@tanstack/ai-client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/ai/fetch";
import {
  createCategoryDef,
  deleteCategoryDef,
  getCategoryDef,
  listCategoriesDef,
  updateCategoryDef,
  type CategoryRow,
} from "./categories";
import {
  createTransactionDef,
  deleteTransactionDef,
  getTransactionDef,
  listTransactionsDef,
  updateTransactionDef,
  type TransactionRow,
} from "./transactions";

type TxRow = { id: string; amount: number; [k: string]: unknown };

function toDollars<T extends { amount: number }>(row: T): T {
  return { ...row, amount: row.amount / 100 };
}

export async function listCategoriesHandler(): Promise<CategoryRow[]> {
  return apiGet<CategoryRow[]>("/api/categories");
}

export async function createCategoryHandler(input: {
  name: string;
  type: "expense" | "income" | "both";
  color?: string;
  icon?: string;
}): Promise<CategoryRow> {
  return apiPost<CategoryRow>("/api/categories", input);
}

export async function getCategoryHandler(input: { id: string }): Promise<CategoryRow> {
  return apiGet<CategoryRow>(`/api/categories/${input.id}`);
}

export async function updateCategoryHandler(input: {
  id: string;
  name?: string;
  type?: "expense" | "income" | "both";
  color?: string;
  icon?: string;
}): Promise<CategoryRow> {
  const { id, ...patch } = input;
  return apiPatch<CategoryRow>(`/api/categories/${id}`, patch);
}

export async function deleteCategoryHandler(input: { id: string }): Promise<CategoryRow> {
  return apiDelete<CategoryRow>(`/api/categories/${input.id}`);
}

const listCategories = listCategoriesDef.client(listCategoriesHandler);
const createCategory = createCategoryDef.client(createCategoryHandler);
const getCategory = getCategoryDef.client(getCategoryHandler);
const updateCategory = updateCategoryDef.client(updateCategoryHandler);
const deleteCategory = deleteCategoryDef.client(deleteCategoryHandler);

export async function listTransactionsHandler(input: {
  from?: unknown;
  to?: unknown;
  type?: "expense" | "income";
  categoryId?: string;
}): Promise<TransactionRow[]> {
  const rows = await apiGet<TxRow[]>(
    "/api/transactions",
    input as unknown as Parameters<typeof apiGet>[1],
  );
  return rows.map(toDollars) as unknown as TransactionRow[];
}

export async function createTransactionHandler(input: {
  amount: number;
  currency?: string;
  type: "expense" | "income";
  description: string;
  date: unknown;
  categoryId?: string | null;
  recurringTemplateId?: string | null;
  source?: "manual" | "chat" | "csv_import";
  notes?: string | null;
}): Promise<TransactionRow> {
  const row = await apiPost<TxRow>("/api/transactions", input);
  return toDollars(row) as unknown as TransactionRow;
}

export async function getTransactionHandler(input: { id: string }): Promise<TransactionRow> {
  const row = await apiGet<TxRow>(`/api/transactions/${input.id}`);
  return toDollars(row) as unknown as TransactionRow;
}

export async function updateTransactionHandler(input: {
  id: string;
  amount?: number;
  currency?: string;
  type?: "expense" | "income";
  description?: string;
  date?: unknown;
  categoryId?: string | null;
  recurringTemplateId?: string | null;
  source?: "manual" | "chat" | "csv_import";
  notes?: string | null;
}): Promise<TransactionRow> {
  const { id, ...patch } = input;
  const row = await apiPatch<TxRow>(`/api/transactions/${id}`, patch);
  return toDollars(row) as unknown as TransactionRow;
}

export async function deleteTransactionHandler(input: { id: string }): Promise<TransactionRow> {
  const row = await apiDelete<TxRow>(`/api/transactions/${input.id}`);
  return toDollars(row) as unknown as TransactionRow;
}

const listTransactions = listTransactionsDef.client(listTransactionsHandler);
const createTransaction = createTransactionDef.client(createTransactionHandler);
const getTransaction = getTransactionDef.client(getTransactionHandler);
const updateTransaction = updateTransactionDef.client(updateTransactionHandler);
const deleteTransaction = deleteTransactionDef.client(deleteTransactionHandler);

export const allClientTools = clientTools(
  listCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  listTransactions,
  createTransaction,
  getTransaction,
  updateTransaction,
  deleteTransaction,
);
