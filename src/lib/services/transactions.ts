import {
  createTransaction as repoCreate,
  getTransactionById as repoGetById,
  listTransactions as repoList,
  softDeleteTransaction as repoSoftDelete,
  updateTransaction as repoUpdate,
  type ListFilters,
} from "@/lib/repositories/transactions";
import { getCategoryById } from "@/lib/repositories/category";
import { getRecurringTemplateById } from "@/lib/repositories/recurring-templates";
import { InternalError, NotFoundError } from "@/lib/errors";
import type { Transaction } from "@/lib/schemas/transactions";

export async function createTransaction(userId: string, input: Transaction) {
  if (input.categoryId) {
    const cat = await getCategoryById(userId, input.categoryId);
    if (!cat) throw new NotFoundError("category", input.categoryId);
  }
  if (input.recurringTemplateId) {
    const tpl = await getRecurringTemplateById(userId, input.recurringTemplateId);
    if (!tpl) throw new NotFoundError("recurring_template", input.recurringTemplateId);
  }

  const payload = {
    id: crypto.randomUUID(),
    amount: input.amount,
    currency: input.currency,
    type: input.type,
    description: input.description,
    date: input.date,
    category_id: input.categoryId ?? null,
    recurring_template_id: input.recurringTemplateId ?? null,
    user_id: userId,
    source: input.source,
    notes: input.notes ?? null,
  };

  const row = await repoCreate(userId, payload);
  if (!row) throw new InternalError("createTransaction returned no row");
  return row;
}

export async function getTransaction(userId: string, id: string) {
  const row = await repoGetById(userId, id);
  if (!row) throw new NotFoundError("transaction", id);
  return row;
}

export async function listTransactions(userId: string, filters: ListFilters = {}) {
  return repoList(userId, filters);
}

export async function updateTransaction(userId: string, id: string, patch: Partial<Transaction>) {
  const row = await repoUpdate(userId, id, patch as Record<string, unknown>);
  if (!row) throw new NotFoundError("transaction", id);
  return row;
}

export async function deleteTransaction(userId: string, id: string) {
  const row = await repoSoftDelete(userId, id);
  if (!row) throw new NotFoundError("transaction", id);
  return row;
}
