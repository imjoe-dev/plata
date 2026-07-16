import { toolDefinition } from "@tanstack/ai";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { checkRateLimit } from "@/lib/api/http";
import { Category, CategoryPatch } from "@/lib/schemas/categories";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "@/lib/services/categories";
import type { ToolContext } from "./context";

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

// The service passes the Drizzle row through unchanged (Date timestamps, nullable
// user_id). Previously that row crossed a REST/JSON boundary, which serialized
// dates to ISO strings for free; calling the service in-process has no such
// boundary, so this maps the row to the tool's declared CategoryRow shape.
type CategoryServiceRow = Awaited<ReturnType<typeof listCategories>>[number];

function toCategoryRow(row: CategoryServiceRow, userId: string): CategoryRow {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    icon: row.icon,
    user_id: row.user_id ?? userId,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    deleted_at: row.deleted_at?.toISOString() ?? null,
  };
}

export const categoryServerTools = [
  listCategoriesDef.server<ToolContext>(async (_input, ctx) => {
    const rows = await listCategories(ctx.context.userId);
    return rows.map((row) => toCategoryRow(row, ctx.context.userId));
  }),
  createCategoryDef.server<ToolContext>(async (input, ctx) => {
    await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
    const row = await createCategory(ctx.context.userId, input);
    return toCategoryRow(row, ctx.context.userId);
  }),
  getCategoryDef.server<ToolContext>(async (input, ctx) => {
    const { id } = input;
    const row = await getCategory(ctx.context.userId, id);
    return toCategoryRow(row, ctx.context.userId);
  }),
  updateCategoryDef.server<ToolContext>(async (input, ctx) => {
    await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
    const { id, ...patch } = input;
    const row = await updateCategory(ctx.context.userId, id, patch);
    return toCategoryRow(row, ctx.context.userId);
  }),
  deleteCategoryDef.server<ToolContext>(async (input, ctx) => {
    await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
    const { id } = input;
    const row = await deleteCategory(ctx.context.userId, id);
    return toCategoryRow(row, ctx.context.userId);
  }),
] as const;
