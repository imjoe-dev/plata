import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import { Category, CategoryPatch } from "@/lib/schemas/categories";

export const CategoryRow = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["expense", "income", "both"]),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type CategoryRow = z.infer<typeof CategoryRow>;

export const ListCategoriesInput = z.object({});

export const CreateCategoryInput = Category;

export const IdInput = z.object({
  id: z.string().meta({ description: "Category id." }),
});

export const UpdateCategoryInput = z.object({
  ...CategoryPatch.shape,
  id: z.string().meta({ description: "Category id." }),
});

export const listCategoriesDef = toolDefinition({
  name: "list_categories",
  description: "List all categories for the current user.",
  inputSchema: ListCategoriesInput,
  outputSchema: z.array(CategoryRow),
});

export const createCategoryDef = toolDefinition({
  name: "create_category",
  description: "Create a new category.",
  inputSchema: CreateCategoryInput,
  outputSchema: CategoryRow,
  needsApproval: true,
});

export const getCategoryDef = toolDefinition({
  name: "get_category",
  description: "Get a single category by id.",
  inputSchema: IdInput,
  outputSchema: CategoryRow,
});

export const updateCategoryDef = toolDefinition({
  name: "update_category",
  description: "Update an existing category by id.",
  inputSchema: UpdateCategoryInput,
  outputSchema: CategoryRow,
  needsApproval: true,
});

export const deleteCategoryDef = toolDefinition({
  name: "delete_category",
  description: "Soft-delete a category by id.",
  inputSchema: IdInput,
  outputSchema: CategoryRow,
  needsApproval: true,
});

export const categoryToolDefs = [
  listCategoriesDef,
  createCategoryDef,
  getCategoryDef,
  updateCategoryDef,
  deleteCategoryDef,
] as const;
