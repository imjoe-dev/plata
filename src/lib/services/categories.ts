import {
  createCategory as repoCreate,
  getCategoryById as repoGetById,
  listCategories as repoList,
  softDeleteCategory as repoSoftDelete,
  updateCategory as repoUpdate,
} from "@/lib/repositories/category";
import { ConflictError, InternalError, NotFoundError } from "@/lib/errors";
import type { Category } from "@/lib/schemas/categories";

const UNIQUE_CONSTRAINT = /categories_name_user_id_unique/i;

function asConflictIfUnique(cause: unknown): never {
  if (cause instanceof Error && UNIQUE_CONSTRAINT.test(cause.message)) {
    throw new ConflictError("categories_name_user_id_unique", "name");
  }
  throw cause;
}

export async function createCategory(userId: string, input: Category) {
  const payload = {
    id: crypto.randomUUID(),
    name: input.name,
    type: input.type,
    color: input.color,
    icon: input.icon,
    user_id: userId,
  };
  try {
    const row = await repoCreate(userId, payload);
    if (!row) throw new InternalError("createCategory returned no row");
    return row;
  } catch (cause) {
    asConflictIfUnique(cause);
  }
}

export async function getCategory(userId: string, id: string) {
  const row = await repoGetById(userId, id);
  if (!row) throw new NotFoundError("category", id);
  return row;
}

export async function listCategories(userId: string) {
  return repoList(userId);
}

export async function updateCategory(userId: string, id: string, patch: Partial<Category>) {
  try {
    const row = await repoUpdate(userId, id, patch as Record<string, unknown>);
    if (!row) throw new NotFoundError("category", id);
    return row;
  } catch (cause) {
    asConflictIfUnique(cause);
  }
}

export async function deleteCategory(userId: string, id: string) {
  const row = await repoSoftDelete(userId, id);
  if (!row) throw new NotFoundError("category", id);
  return row;
}
