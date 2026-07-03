import { eq } from "drizzle-orm";

import { getDB } from "@/db";
import { categories, type InsertCategory } from "@/db/schema";

export async function createCategory(category: InsertCategory) {
  const response = await getDB().insert(categories).values(category).returning();
  if (response.length <= 0) {
    return null;
  }

  return response[0];
}

export async function getCategories() {
  const response = await getDB()
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      icon: categories.icon,
      created_at: categories.created_at,
    })
    .from(categories);

  return response;
}

export async function updateCategory(category: InsertCategory) {
  const response = await getDB().update(categories).set(category).returning();
  if (response.length <= 0) {
    return null;
  }

  return response;
}

export async function deleteCategory(id: string) {
  const response = await getDB().delete(categories).where(eq(categories.id, id)).returning();
  if (response.length <= 0) {
    return null;
  }

  return response[0];
}
