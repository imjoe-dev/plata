import {
  buildInsertTransaction,
  createTransaction as repoCreate,
  getTransactionById as repoGetById,
  listTransactions as repoList,
  softDeleteTransaction as repoSoftDelete,
  updateTransaction as repoUpdate,
  type ListFilters,
} from "@/lib/repositories/transactions";
import { getCategoryById } from "@/lib/repositories/category";
import { getRecurringTemplateById } from "@/lib/repositories/recurring-templates";
import { createCurrencyResolver } from "@/lib/services/user-preferences";
import { runBatch } from "@/lib/db/transaction";
import { InternalError, NotFoundError } from "@/lib/errors";
import type { Currency } from "@/lib/currency";
import type { Transaction, Pagination, PaginatedListResult } from "@/lib/schemas/transactions";
import type { transactions } from "@/db/schema";

type TransactionRow = typeof transactions.$inferSelect;
type TransactionInsert = typeof transactions.$inferInsert;

async function validateTransactionRefs(userId: string, input: Transaction, itemIndex?: number) {
  if (input.categoryId) {
    const cat = await getCategoryById(userId, input.categoryId);
    if (!cat) throw new NotFoundError("category", input.categoryId, itemIndex);
  }
  if (input.recurringTemplateId) {
    const tpl = await getRecurringTemplateById(userId, input.recurringTemplateId);
    if (!tpl) throw new NotFoundError("recurring_template", input.recurringTemplateId, itemIndex);
  }
}

function toTransactionInsert(
  userId: string,
  input: Transaction,
  currency: Currency,
): TransactionInsert {
  return {
    id: crypto.randomUUID(),
    amount: input.amount,
    currency,
    type: input.type,
    description: input.description,
    date: input.date,
    category_id: input.categoryId ?? null,
    recurring_template_id: input.recurringTemplateId ?? null,
    user_id: userId,
    source: input.source,
    notes: input.notes ?? null,
  };
}

export async function createTransaction(userId: string, input: Transaction) {
  await validateTransactionRefs(userId, input);
  const resolveCurrency = createCurrencyResolver(userId);
  const currency = await resolveCurrency(input.currency);
  const row = await repoCreate(toTransactionInsert(userId, input, currency));
  if (!row) throw new InternalError("createTransaction returned no row");
  return row;
}

export async function createTransactions(userId: string, inputs: Transaction[]) {
  const resolveCurrency = createCurrencyResolver(userId);
  const payloads: TransactionInsert[] = [];
  for (let i = 0; i < inputs.length; i++) {
    await validateTransactionRefs(userId, inputs[i], i);
    const currency = await resolveCurrency(inputs[i].currency);
    payloads.push(toTransactionInsert(userId, inputs[i], currency));
  }

  const results = await runBatch<TransactionRow[]>(payloads.map(buildInsertTransaction));
  return results.map((rows) => {
    const row = rows[0];
    if (!row) throw new InternalError("createTransactions returned no row for one or more items");
    return row;
  });
}

export async function getTransaction(userId: string, id: string) {
  const row = await repoGetById(userId, id);
  if (!row) throw new NotFoundError("transaction", id);
  return row;
}

export async function listTransactions(
  userId: string,
  filters: ListFilters = {},
  pagination: Pagination,
): Promise<PaginatedListResult<TransactionRow>> {
  return repoList(userId, filters, pagination);
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
