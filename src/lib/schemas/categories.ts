import { z } from "zod";

export const Category = z.object({
  name: z.string().min(1).meta({ description: "Category name." }),
  type: z
    .enum(["expense", "income", "both"])
    .meta({ description: "Category type: expense, income, or both." }),
  color: z.string().nullable().optional().meta({ description: "Optional color, e.g. a hex code." }),
  icon: z.string().nullable().optional().meta({ description: "Optional icon name." }),
});

export type Category = z.infer<typeof Category>;

export const CategoryPatch = Category.partial();

export type CategoryPatch = z.infer<typeof CategoryPatch>;
