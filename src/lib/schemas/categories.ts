import { z } from "zod";

export const Category = z.object({
  name: z.string().min(1),
  type: z.enum(["expense", "income", "both"]),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export type Category = z.infer<typeof Category>;
