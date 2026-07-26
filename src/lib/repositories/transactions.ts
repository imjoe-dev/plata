import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";

import { getDB } from "@/db";
import { transactions } from "@/db/schema";
import type { Pagination, PaginatedListResult } from "@/lib/schemas/transactions";
import { createSoftDeleteRepo } from "./soft-delete";

type TransactionRow = typeof transactions.$inferSelect;
type TransactionInsert = typeof transactions.$inferInsert;

export type ListFilters = {
  from?: Date;
  to?: Date;
  type?: "expense" | "income";
  categoryId?: string;
};

const transactionRepo = createSoftDeleteRepo(transactions);

export function createTransaction(input: TransactionInsert) {
  return transactionRepo.create(input);
}
export function getTransactionById(userId: string, id: string) {
  return transactionRepo.getById(userId, id);
}
export function updateTransaction(userId: string, id: string, patch: Partial<TransactionInsert>) {
  return transactionRepo.update(userId, id, patch);
}
export function softDeleteTransaction(userId: string, id: string) {
  return transactionRepo.softDelete(userId, id);
}

export async function listTransactions(
  userId: string,
  filters: ListFilters,
  pagination: Pagination,
): Promise<PaginatedListResult<TransactionRow>> {
  const conds = [eq(transactions.user_id, userId), isNull(transactions.deleted_at)];
  if (filters.from) conds.push(gte(transactions.date, filters.from));
  if (filters.to) conds.push(lte(transactions.date, filters.to));
  if (filters.type) conds.push(eq(transactions.type, filters.type));
  if (filters.categoryId) conds.push(eq(transactions.category_id, filters.categoryId));
  const where = and(...conds);
  const db = getDB();

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.created_at))
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit),
    db.$count(transactions, where),
  ]);

  return { rows, total };
}

export function buildInsertTransaction(input: TransactionInsert) {
  return getDB().insert(transactions).values(input).returning();
}
