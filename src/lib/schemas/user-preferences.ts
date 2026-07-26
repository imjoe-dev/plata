import { z } from "zod";

import { currencySchema } from "@/lib/currency";

// Not a `*Patch` (partial) schema like Category/Transaction: user_preferences has exactly
// one settable field today, so "update" always means "set it" rather than "merge in whatever
// changed."
export const UserPreferences = z.object({
  defaultCurrency: currencySchema.meta({
    description: "The user's default currency for new transactions and recurring templates.",
  }),
});

export type UserPreferences = z.infer<typeof UserPreferences>;
