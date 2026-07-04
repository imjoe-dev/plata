import { and, eq, isNull } from "drizzle-orm";

import { getDB } from "@/db";
import { categories } from "@/db/schema";

type CategoryRow = typeof categories.$inferSelect;
type CategoryInsert = typeof categories.$inferInsert;

export async function createCategory(_userId: string, input: CategoryInsert) {
  const [row] = await getDB().insert(categories).values(input).returning();
  return row;
}

export async function getCategoryById(userId: string, id: string): Promise<CategoryRow | null> {
  const [row] = await getDB()
    .select()
    .from(categories)
    .where(
      and(eq(categories.id, id), eq(categories.user_id, userId), isNull(categories.deleted_at)),
    );
  return row ?? null;
}

export async function listCategories(userId: string): Promise<CategoryRow[]> {
  return getDB()
    .select()
    .from(categories)
    .where(and(eq(categories.user_id, userId), isNull(categories.deleted_at)));
}

export async function updateCategory(
  userId: string,
  id: string,
  patch: Partial<CategoryInsert>,
): Promise<CategoryRow | null> {
  const [row] = await getDB()
    .update(categories)
    .set(patch)
    .where(and(eq(categories.id, id), eq(categories.user_id, userId)))
    .returning();
  return row ?? null;
}

export async function softDeleteCategory(userId: string, id: string): Promise<CategoryRow | null> {
  const [row] = await getDB()
    .update(categories)
    .set({ deleted_at: new Date() })
    .where(and(eq(categories.id, id), eq(categories.user_id, userId)))
    .returning();
  return row ?? null;
}
