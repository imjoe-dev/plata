import { z } from "zod";

export const Category = z.object({
  name: z.string().min(1),
  type: z.enum(["expense", "income", "both"]),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

export type Category = z.infer<typeof Category>;

export const CategoryPatch = Category.partial();

export type CategoryPatch = z.infer<typeof CategoryPatch>;
