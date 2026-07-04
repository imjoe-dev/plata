import { and, eq, gte, isNull, lte } from "drizzle-orm";

import { getDB } from "@/db";
import { transactions } from "@/db/schema";

type TransactionRow = typeof transactions.$inferSelect;
type TransactionInsert = typeof transactions.$inferInsert;

export type ListFilters = {
  from?: Date;
  to?: Date;
  type?: "expense" | "income";
  categoryId?: string;
};

export async function createTransaction(_userId: string, input: TransactionInsert) {
  const [row] = await getDB().insert(transactions).values(input).returning();
  return row;
}

export async function getTransactionById(
  userId: string,
  id: string,
): Promise<TransactionRow | null> {
  const [row] = await getDB()
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.user_id, userId),
        isNull(transactions.deleted_at),
      ),
    );
  return row ?? null;
}

export async function listTransactions(
  userId: string,
  filters: ListFilters = {},
): Promise<TransactionRow[]> {
  const conds = [eq(transactions.user_id, userId), isNull(transactions.deleted_at)];
  if (filters.from) conds.push(gte(transactions.date, filters.from));
  if (filters.to) conds.push(lte(transactions.date, filters.to));
  if (filters.type) conds.push(eq(transactions.type, filters.type));
  if (filters.categoryId) conds.push(eq(transactions.category_id, filters.categoryId));
  return getDB()
    .select()
    .from(transactions)
    .where(and(...conds));
}

export async function updateTransaction(
  userId: string,
  id: string,
  patch: Partial<TransactionInsert>,
): Promise<TransactionRow | null> {
  const [row] = await getDB()
    .update(transactions)
    .set(patch)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.user_id, userId),
        isNull(transactions.deleted_at),
      ),
    )
    .returning();
  return row ?? null;
}

export async function softDeleteTransaction(
  userId: string,
  id: string,
): Promise<TransactionRow | null> {
  const [row] = await getDB()
    .update(transactions)
    .set({ deleted_at: new Date() })
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.user_id, userId),
        isNull(transactions.deleted_at),
      ),
    )
    .returning();
  return row ?? null;
}

export function buildInsertTransaction(input: TransactionInsert) {
  return getDB().insert(transactions).values(input);
}
