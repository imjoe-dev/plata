import { clientTools } from "@tanstack/ai-client";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/ai/fetch";
import {
  createCategoryDef,
  deleteCategoryDef,
  getCategoryDef,
  listCategoriesDef,
  updateCategoryDef,
  type CategoryRow,
} from "./categories";

export async function listCategoriesHandler(): Promise<CategoryRow[]> {
  return apiGet<CategoryRow[]>("/api/categories");
}

export async function createCategoryHandler(input: {
  name: string;
  type: "expense" | "income" | "both";
  color?: string;
  icon?: string;
}): Promise<CategoryRow> {
  return apiPost<CategoryRow>("/api/categories", input);
}

export async function getCategoryHandler(input: { id: string }): Promise<CategoryRow> {
  return apiGet<CategoryRow>(`/api/categories/${input.id}`);
}

export async function updateCategoryHandler(input: {
  id: string;
  name?: string;
  type?: "expense" | "income" | "both";
  color?: string;
  icon?: string;
}): Promise<CategoryRow> {
  const { id, ...patch } = input;
  return apiPatch<CategoryRow>(`/api/categories/${id}`, patch);
}

export async function deleteCategoryHandler(input: { id: string }): Promise<CategoryRow> {
  return apiDelete<CategoryRow>(`/api/categories/${input.id}`);
}

const listCategories = listCategoriesDef.client(listCategoriesHandler);
const createCategory = createCategoryDef.client(createCategoryHandler);
const getCategory = getCategoryDef.client(getCategoryHandler);
const updateCategory = updateCategoryDef.client(updateCategoryHandler);
const deleteCategory = deleteCategoryDef.client(deleteCategoryHandler);

export const allClientTools = clientTools(
  listCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
);
