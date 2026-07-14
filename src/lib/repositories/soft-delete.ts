import { and, eq, isNull } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";

import { getDB } from "@/db";

type SoftDeleteTable = SQLiteTable & {
  id: SQLiteColumn;
  user_id: SQLiteColumn;
  deleted_at: SQLiteColumn;
};

export function createSoftDeleteRepo<T extends SoftDeleteTable>(table: T) {
  type Row = T["$inferSelect"];
  type Insert = T["$inferInsert"];

  return {
    async create(input: Insert): Promise<Row> {
      const [row] = await getDB().insert(table).values(input).returning();
      return row as Row;
    },

    async getById(userId: string, id: string): Promise<Row | null> {
      const [row] = await getDB()
        .select()
        .from(table)
        .where(and(eq(table.id, id), eq(table.user_id, userId), isNull(table.deleted_at)));
      return (row as Row) ?? null;
    },

    async update(userId: string, id: string, patch: Partial<Insert>): Promise<Row | null> {
      const [row] = await getDB()
        .update(table)
        .set(patch)
        .where(and(eq(table.id, id), eq(table.user_id, userId), isNull(table.deleted_at)))
        .returning();
      return (row as Row) ?? null;
    },

    async softDelete(userId: string, id: string): Promise<Row | null> {
      const [row] = await getDB()
        .update(table)
        .set({ deleted_at: new Date() } as Partial<Insert>)
        .where(and(eq(table.id, id), eq(table.user_id, userId), isNull(table.deleted_at)))
        .returning();
      return (row as Row) ?? null;
    },
  };
}
