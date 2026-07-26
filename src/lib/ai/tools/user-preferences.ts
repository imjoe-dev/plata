import { toolDefinition } from "@tanstack/ai";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { checkRateLimit } from "@/lib/api/http";
import { currencySchema } from "@/lib/currency";
import { UserPreferences } from "@/lib/schemas/user-preferences";
import { getUserPreferences, updateUserPreferences } from "@/lib/services/user-preferences";
import type { ToolContext } from "./context";

export const UserPreferencesRow = z.object({
  user_id: z.string(),
  default_currency: currencySchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type UserPreferencesRow = z.infer<typeof UserPreferencesRow>;

export const GetUserPreferencesInput = z.object({});

export const UpdateUserPreferencesInput = UserPreferences;

export const getUserPreferencesDef = toolDefinition({
  name: "get_user_preferences",
  description:
    "Get the current user's preferences, including their default currency. Call this at the start of a new conversation, before doing anything else.",
  inputSchema: GetUserPreferencesInput,
  outputSchema: UserPreferencesRow,
});

export const updateUserPreferencesDef = toolDefinition({
  name: "update_user_preferences",
  description:
    "Update the current user's preferences. Currently supports changing the default currency (USD or COP).",
  inputSchema: UpdateUserPreferencesInput,
  outputSchema: UserPreferencesRow,
  needsApproval: true,
});

// The service passes the Drizzle row through unchanged (Date timestamps). Previously such rows
// crossed a REST/JSON boundary, which serialized dates to ISO strings for free; calling the
// service in-process has no such boundary, so this maps the row to the tool's declared
// UserPreferencesRow shape.
type UserPreferencesServiceRow = Awaited<ReturnType<typeof getUserPreferences>>;

function toUserPreferencesRow(row: UserPreferencesServiceRow): UserPreferencesRow {
  return {
    user_id: row.user_id,
    default_currency: row.default_currency,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export const userPreferencesServerTools = [
  getUserPreferencesDef.server<ToolContext>(async (_input, ctx) => {
    const row = await getUserPreferences(ctx.context.userId);
    return toUserPreferencesRow(row);
  }),
  updateUserPreferencesDef.server<ToolContext>(async (input, ctx) => {
    await checkRateLimit(env.MUTATION_RATE_LIMITER, ctx.context.userId);
    const row = await updateUserPreferences(ctx.context.userId, input.defaultCurrency);
    return toUserPreferencesRow(row);
  }),
] as const;
