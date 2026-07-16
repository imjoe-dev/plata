import { and, eq, isNull } from "drizzle-orm";

import { getDB } from "@/db";
import { categories } from "@/db/schema";
import { createSoftDeleteRepo } from "./soft-delete";

type CategoryRow = typeof categories.$inferSelect;
type CategoryInsert = typeof categories.$inferInsert;

const categoryRepo = createSoftDeleteRepo(categories);

export function createCategory(input: CategoryInsert) {
  return categoryRepo.create(input);
}
export function getCategoryById(userId: string, id: string) {
  return categoryRepo.getById(userId, id);
}
export function updateCategory(userId: string, id: string, patch: Partial<CategoryInsert>) {
  return categoryRepo.update(userId, id, patch);
}
export function softDeleteCategory(userId: string, id: string) {
  return categoryRepo.softDelete(userId, id);
}

export async function listCategories(userId: string): Promise<CategoryRow[]> {
  return getDB()
    .select()
    .from(categories)
    .where(and(eq(categories.user_id, userId), isNull(categories.deleted_at)));
}
