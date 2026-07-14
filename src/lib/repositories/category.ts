import { and, eq, isNull } from "drizzle-orm";

import { getDB } from "@/db";
import { categories } from "@/db/schema";
import { createSoftDeleteRepo } from "./soft-delete";

type CategoryRow = typeof categories.$inferSelect;
type CategoryInsert = typeof categories.$inferInsert;

const categoryRepo = createSoftDeleteRepo(categories);

export const createCategory = (input: CategoryInsert) => categoryRepo.create(input);
export const getCategoryById = (userId: string, id: string) => categoryRepo.getById(userId, id);
export const updateCategory = (userId: string, id: string, patch: Partial<CategoryInsert>) =>
  categoryRepo.update(userId, id, patch);
export const softDeleteCategory = (userId: string, id: string) =>
  categoryRepo.softDelete(userId, id);

export async function listCategories(userId: string): Promise<CategoryRow[]> {
  return getDB()
    .select()
    .from(categories)
    .where(and(eq(categories.user_id, userId), isNull(categories.deleted_at)));
}
